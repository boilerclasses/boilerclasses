#!/bin/bash
# Builds the checked-out commit and swaps it in without downtime.
# The new container starts next to the live one on the other port, and nginx
# (deploy/proxy.conf) moves traffic over only once it serves search.
# Set FORCE=true to rebuild a commit that is already running.
set -euo pipefail

proxy=boilerclasses-proxy
proxy_image=nginx:1.27.4-alpine
ports=(3001 3002)

sha=$(git rev-parse --short HEAD)
image="boilerclasses:$sha"

exists() { docker inspect "$1" > /dev/null 2>&1; }
running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

# the port nginx sends traffic to; before the proxy existed, the app held port 80 itself
# (docker cp also reads from a stopped container)
live_port=$(docker cp "$proxy:/etc/nginx/conf.d/upstream.inc" - 2>/dev/null | tar -xO 2>/dev/null | sed -nE 's/.*:([0-9]+);.*/\1/p' || true)
if [ -n "$live_port" ]; then
  live="boilerclasses-$live_port"
else
  live=boilerclasses
fi
live_image=$(docker inspect -f '{{.Config.Image}}' "$live" 2>/dev/null || true)
if [ "$live_image" = "$image" ] && [ "${FORCE:-}" != "true" ]; then
  echo "$sha is already running"
  exit 0
fi

new_port=${ports[0]}
[ "$live_port" = "$new_port" ] && new_port=${ports[1]}
new="boilerclasses-$new_port"

# the live container keeps serving through the build and the new one's startup
# NEXT_PUBLIC_SENTRY_DSN comes from the workflow's environment
docker build --build-arg NEXT_PUBLIC_SENTRY_DSN -t "$image" .
docker rm -f "$new" > /dev/null 2>&1 || true
# the volume keeps the course embedding cache across deploys
docker run -d --name "$new" --restart unless-stopped -p "127.0.0.1:$new_port:3000" \
  -v boilerclasses-embeddings:/home/server/embedding_cache "$image" > /dev/null

fetch() {
  local path=$1
  shift
  curl -s -m 10 -H "Host: boilerclasses.com" "$@" "http://127.0.0.1:$new_port$path"
}
status() { fetch "$1" -o /dev/null -w "%{http_code}"; }
serves_search() { [ "$(status '/api/search?maxlim=1')" = 200 ]; }
fully_loaded() {
  [ "$(status '/api/search-index?part=docs')" = 200 ] &&
    [ "$(status '/api/search-index?part=index')" = 200 ] &&
    fetch '/api/search-semantic?q=calculus' | grep -qE '"ready": ?true'
}
# polls until the check passes; gives up after $1 seconds or if the container exits
wait_for() {
  local deadline=$((SECONDS + $1))
  until "$2"; do
    running "$new" && [ $SECONDS -lt $deadline ] || return 1
    sleep 2
  done
}

# lexical search is up once push.py has loaded the snapshot into redis
if ! wait_for 180 serves_search; then
  echo "::error::$image failed its health check; $live keeps serving"
  docker logs --tail 40 "$new" || true
  docker rm -f "$new" > /dev/null
  exit 1
fi
# browser search and semantic search load in the background; a full re-embed
# (an empty cache volume) takes ~30 min, so don't hold the deploy for that
if ! wait_for 300 fully_loaded; then
  echo "::warning::$image is serving, but browser or semantic search is still loading"
fi

conf=$(mktemp -d)
trap 'rm -rf "$conf"' EXIT
cp deploy/proxy.conf "$conf/default.conf"
echo "server 127.0.0.1:$new_port;" > "$conf/upstream.inc"
docker run --rm -v "$conf:/etc/nginx/conf.d:ro" "$proxy_image" nginx -t -q

if exists "$proxy" && [ "$(docker inspect -f '{{.Config.Image}}' "$proxy")" != "$proxy_image" ]; then
  # a new nginx version needs a new container, so the site drops for about a second
  docker rm -f "$proxy" > /dev/null
fi
if ! exists "$proxy"; then
  docker create --name "$proxy" --network host --restart unless-stopped \
    -v boilerclasses-proxy-conf:/etc/nginx/conf.d "$proxy_image" > /dev/null
fi
docker cp "$conf/." "$proxy:/etc/nginx/conf.d/"

if running "$proxy"; then
  # old nginx workers finish their requests on the old container
  docker exec "$proxy" nginx -s reload
else
  # the first deploy behind the proxy, or a version change: port 80 has to be freed first
  [ "$live" = boilerclasses ] && docker rm -f boilerclasses > /dev/null 2>&1 || true
  docker start "$proxy" > /dev/null
fi
echo "Deployed $sha on port $new_port"

if [ "$live" != "$new" ] && exists "$live"; then
  sleep 15
  docker rm -f "$live" > /dev/null
fi
# keep the new image and the one it replaced (for a rollback), drop older builds
docker image ls boilerclasses --format '{{.Repository}}:{{.Tag}}' |
  grep -vxF -e "$image" -e "${live_image:-$image}" | xargs -r docker rmi > /dev/null || true
docker image prune -f > /dev/null
