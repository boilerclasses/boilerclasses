# [BoilerClasses](https://www.boilerclasses.com/)

https://github.com/user-attachments/assets/2f1d7f6c-00fd-4de0-880b-80b4598cb77c

# Structure
BoilerClasses is a simple [Next.js](https://nextjs.org/) app with a few Python helper files to format and organize the data. We use a [Redis](https://redis.io/) instance to store and rapidly query all our data. 

The app runs in a [Docker](https://www.docker.com/) container on a server run by [Boilerexams](https://boilerexams.com), behind [Cloudflare](https://www.cloudflare.com/). Every push to `main` is deployed by the **Deploy** GitHub Action (`.github/workflows/deploy.yml`) on a self-hosted runner on that server. It builds the new image while the old container keeps serving, swaps them, and rolls back if the new one fails its health check. Steps to run the same container locally are below.

# Contributing
All contributions are very, very welcome! If you find a *bug* or have any *feedback*, open an [issue](https://github.com/boilerclasses/boilerclasses/issues) or a [PR](https://github.com/boilerclasses/boilerclasses/pulls), or use our [feedback form](https://docs.google.com/forms/d/e/1FAIpQLScoE5E-G7dbr7-v9dY5S7UeIoojjMTjP_XstLz38GBpib5MPA/viewform).

BoilerClasses is maintained by the [Boilerexams](https://boilerexams.com) team. If you'd like to work on it (and Boilerexams) with us regularly, [apply to join the team](https://boilerexams.com/apply)!

# Setup
You can clone this repository and run a local instance of the app in two ways (with or without Docker):

## With Docker
Make sure you have `docker` installed and the daemon running. More information about installation can be found [here](https://docs.docker.com/get-docker/). Once you get that up and running, navigate into the cloned repository and run:

```
docker build . -t boilerclasses
```
After the image is created, run:
```
docker run -it -p 3000:3000 boilerclasses
```
This will expose the container's port `3000` to your machine. Navigate to `localhost:3000` to view the app! You can edit whatever files you want locally, but you'll have to rebuild the image every time you want to view your changes. Thus, not ideal for quick changes.

## Without Docker
1. Firstly, make sure you have [python](https://www.python.org/downloads/), [node](https://nodejs.org/en/download/), and [redis](https://redis.io/docs/install/install-redis/) installed.
2. Then, navigate into the `server` directory and run:
   ```
   sh fetch_snapshot.sh
   ```
   This downloads the data snapshot pinned in `data.lock` (the same data production serves) to `server/classes_out.json` and verifies its hash. It also downloads the schedule's section times pinned in `sections.lock` to `server/sections_out.json`.
3. Now, you want to spawn a Redis instance at the port `6379`. To do this, run the following command:
   ```
   redis-server --daemonize yes
   ```
   The `daemonize` argument will make it run in the background. Alternatively, if you have docker but don't want to install redis-server, you can run:
   ```
   docker run --name boilerclasses-redis -i --rm -p 6379:6379 redis/redis-stack-server:latest redis-stack-server --save
   ```
   Functionally, both of the above commands are equivalent. 
5. Once you have that, you can push all the data from the JSON file generated in step 2 to the Redis instance. To do this, run:
   ```
   python3 push.py
   ```
6. Now, navigate back to the root directory and run:
   ```
   npm install
   npm run dev
   ```
   Now, you can make changes within the Next.js app and have them reflect in real-time at `localhost:3000`.
7. Semantic search is optional locally. For it, use the `redis/redis-stack-server` image above (it needs RediSearch), then from `server` run `pip3 install -r requirements.txt`, `python3 embed.py`, and `python3 semantic_api.py`.

### Semantic search

Lexical results show first, and semantic matches (`/api/search-semantic`) are appended below them. Each course's code, title, and description are embedded with `BAAI/bge-small-en-v1.5`. A query is embedded the same way, and the closest courses by cosine distance are returned, dropping any past `SEMANTIC_MAX_DISTANCE` in `server/embeddings.py` so nonsense queries can still show no results.

When the container starts, `embed.py` runs in the background while the site serves lexical search. Vectors are cached in SQLite by a hash of the embedded text, so only new or edited courses go through the model; grade, instructor, and term changes cost nothing. In production the cache lives on the `boilerclasses-embeddings` Docker volume, so it survives deploys. The first run embeds every course, and later deploys only embed what changed.

   PS: if you look at the Dockerfile, you can see that these exact commands are run!

# Data Collection

Data is refreshed by the **Data Pipeline** GitHub Action (`.github/workflows/data.yml`), weekly on Mondays or by hand from the Actions tab:
1. `scrape.py` scrapes the newest 2 semesters from Purdue's catalog and uploads them to our [S3 bucket](https://s3.amazonaws.com/boilerclasses). Older semesters stay as they are on S3.
2. `grades.py` converts the newest 5 semesters of grade CSVs from [BoilerGrades](https://github.com/eduxstad/boiler-grades) and uploads any that changed.
3. `harmonize.py` combines everything on S3 into one JSON file and writes `src/data/terms.json` for the frontend.
4. If the result changed, it's uploaded as `snapshots/<sha256>.json`, the hash is committed to `data.lock`, and the site is deployed. Only the snapshots from the last 10 `data.lock` commits are kept.
5. `scrape_sections.py` scrapes each term's section meeting times for the schedule. The current term's file is pinned the same way, in `sections.lock`, and served from memory by `/api/sections`.

To roll back data, revert the `data.lock` commit. `push.py` loads `classes_out.json` into Redis when the container starts.

Manual runs take two optional inputs: `terms` (e.g. `["Fall 2026"]`, or `[]` to skip scraping) and `subjects` (e.g. `CS`, a quick test scrape that uploads nothing).

Running the `scrape.py` script may cause issues, but feel free to tweak line ~42, where the driver is initialized. It is somewhat system-dependent -- that configuration should work on MacOS with a Google Chrome driver and `selenium v4.x`. If you want more clarification/help, open up an [issue](https://github.com/boilerclasses/boilerclasses/issues)!

# Acknowledgements
Inspired by [classes.wtf](https://classes.wtf) and Purdue's slow course catalogs. We'd like to also thank our friends over at [Boilerexams](https://boilerexams.com), [Purdue.io](https://purdue.io/), and [BoilerGrades](https://boilergrades.com/).
