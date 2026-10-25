set -eu

redis-server --daemonize yes --loadmodule /opt/redis-stack/lib/redisearch.so --loadmodule /opt/redis-stack/lib/rejson.so

until redis-cli ping >/dev/null 2>&1; do
  sleep 0.1
done

python3 push.py
# Semantic search: the worker answers queries, and embed.py fills in course vectors
# in the background (only courses whose text isn't cached yet hit the model)
EMBEDDING_THREADS=1 python3 semantic_api.py &
EMBEDDING_THREADS=2 nice -n 10 python3 embed.py &
# Browser search index; builds in the background so the site isn't held up.
node build_search_index.mjs &
cd ..
npm run start
