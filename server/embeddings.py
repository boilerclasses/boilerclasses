import os
import hashlib
import sqlite3
from functools import lru_cache
from pathlib import Path

import numpy as np


MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384
VECTOR_INDEX_NAME = "idx:classes:vector"
VECTOR_FIELD_NAME = "embedding"
VECTOR_KEY_PREFIX = "class-vectors:"
# Set by embed.py once every vector is loaded; push.py's flushall clears it on restart.
SEMANTIC_READY_KEY = "semantic:ready"
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
TEXT_TEMPLATE_VERSION = 1
# On the VM this directory is the boilerclasses-embeddings volume, so it survives deploys
DEFAULT_CACHE_PATH = os.getenv("EMBEDDING_CACHE", "embedding_cache/embeddings.sqlite3")
# Cosine distance past which a match is dropped. Nonsense is mostly caught by
# semantic_api's catalog-word check, so this can stay loose enough to keep real matches.
# Tuned for bge-small-en-v1.5 on 128 student-style queries with known answers (48 for
# tuning, 80 held out) and 30 nonsense ones: 121/128 right in the top 8, and only
# nonsense made of real words ("test") gets through. Retune if the model or text template changes.
SEMANTIC_MAX_DISTANCE = float(os.getenv("SEMANTIC_MAX_DISTANCE", "0.38"))
# Ranking nudges, subtracted from the distance. Many specialized courses sit about as
# close to a query as the course most students mean, so commonly offered courses
# (by semesters taught, scaled 0-1) and 100-200 level courses win near-ties.
POPULARITY_WEIGHT = 0.03
INTRO_WEIGHT = 0.01
# Nearest courses considered before re-ranking.
SEMANTIC_CANDIDATES = 50


@lru_cache(maxsize=1)
def load_embedding_model():
    # imported here so scripts that only need the constants don't load onnxruntime
    from fastembed import TextEmbedding

    configured_threads = os.getenv("EMBEDDING_THREADS")
    threads = int(configured_threads) if configured_threads else None
    return TextEmbedding(model_name=MODEL_NAME, threads=threads)


def course_embedding_text(course):
    code = f"{course['subjectCode']} {course['courseCode']}"
    title = course.get("title", "").strip()
    description = course.get("description", "").strip()
    return f"Course: {code}. Title: {title}. Description: {description}"


def course_text_hash(text):
    # the model and template are part of the key, so changing either re-embeds everything
    return hashlib.sha256(f"{MODEL_NAME}\n{TEXT_TEMPLATE_VERSION}\n{text}".encode()).hexdigest()


def open_cache(path=DEFAULT_CACHE_PATH):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE IF NOT EXISTS vectors (hash TEXT PRIMARY KEY, vector BLOB NOT NULL)")
    return db


def embed_texts(texts, batch_size=64):
    embeddings = np.asarray(list(load_embedding_model().embed(
        texts,
        batch_size=batch_size,
    )), dtype=np.float32)
    if embeddings.shape != (len(texts), EMBEDDING_DIM):
        raise ValueError(f"Unexpected course embedding shape: {embeddings.shape}")
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings


def embed_query(query):
    embeddings = list(load_embedding_model().embed([QUERY_INSTRUCTION + query]))
    embedding = np.asarray(embeddings[0], dtype=np.float32)
    if embedding.shape != (EMBEDDING_DIM,):
        raise ValueError(f"Unexpected query embedding shape: {embedding.shape}")
    embedding /= np.linalg.norm(embedding)
    return embedding
