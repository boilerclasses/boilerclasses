FROM redis/redis-stack-server:7.0.6-RC8 AS redis-stack

FROM python:3.10 AS builder

# System packages and Redis modules first: these never depend on repo contents,
# so they stay cached across every deploy.
RUN ln -sf /bin/bash /bin/sh
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates procps redis-server npm \
    && rm -rf /var/lib/apt/lists/*
COPY --from=redis-stack /opt/redis-stack/lib/redisearch.so /opt/redis-stack/lib/redisearch.so
COPY --from=redis-stack /opt/redis-stack/lib/rejson.so /opt/redis-stack/lib/rejson.so

# Dependency manifests only, so installs are cached until the manifests change.
# The query embedding model is downloaded here once instead of on every start.
WORKDIR /home/server
COPY server/requirements.txt server/embeddings.py ./
RUN pip3 install --no-cache-dir -r requirements.txt \
    && python3 -c "from embeddings import load_embedding_model; load_embedding_model()"

WORKDIR /home
COPY package.json package-lock.json ./
RUN npm ci

# Source code last: only the steps below re-run on a normal code change.
COPY . .
RUN npm run build
WORKDIR /home/server

# Data and its embeddings come from the snapshot pinned in data.lock (built by .github/workflows/data.yml)
RUN sh fetch_snapshot.sh

CMD ["/bin/sh", "script.sh"]
