#!/bin/sh
# Download the harmonized data snapshot pinned in data.lock to server/classes_out.json
# (and the sections snapshot pinned in sections.lock to server/sections_out.json)
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

# sections.lock is created by the first pipeline run that has section data
if [ -f ../sections.lock ]; then
  SHA=$(cat ../sections.lock)
  curl -fsSL "https://boilerclasses-bucket.s3.amazonaws.com/snapshots/${SHA}.json" -o sections_out.json
  if command -v sha256sum >/dev/null; then
    echo "${SHA}  sections_out.json" | sha256sum -c -
  else
    echo "${SHA}  sections_out.json" | shasum -a 256 -c -
  fi
fi
