#!/bin/sh
# Download the harmonized data snapshot pinned in data.lock to server/classes_out.json
# (and the sections and term data snapshots pinned in sections.lock and termdata.lock to
# server/sections_out.json and server/termdata_out.json)
# and verify their hashes. Used by the Dockerfile and for local dev.
set -e
cd "$(dirname "$0")"

SHA=$(cat ../data.lock)
curl -fsSL "https://boilerclasses-bucket.s3.amazonaws.com/snapshots/${SHA}.json" -o classes_out.json

if command -v sha256sum >/dev/null; then
  echo "${SHA}  classes_out.json" | sha256sum -c -
else
  echo "${SHA}  classes_out.json" | shasum -a 256 -c -
fi

# sections.lock and termdata.lock are created by the first pipeline run that has that data
for name in sections termdata; do
  if [ -f "../${name}.lock" ]; then
    SHA=$(cat "../${name}.lock")
    curl -fsSL "https://boilerclasses-bucket.s3.amazonaws.com/snapshots/${SHA}.json" -o "${name}_out.json"
    if command -v sha256sum >/dev/null; then
      echo "${SHA}  ${name}_out.json" | sha256sum -c -
    else
      echo "${SHA}  ${name}_out.json" | shasum -a 256 -c -
    fi
  fi
done
