"""
Script to fetch Telugu movies from TMDB and save a local `movies.csv` dataset.

Run this separately from the Flask app whenever you want to refresh the dataset:

    cd backend
    python update_data.py

The Flask `app.py` will load `movies.csv` at startup and will NOT call TMDB.
"""
import os
import time
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime

import pandas as pd


TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '3bbcbb9b9d91639fc80a860d92bb7ecc')
TMDB_BASE_URL = 'https://api.themoviedb.org/3'
BASE_DIR = os.path.dirname(__file__)
OUT_CSV = os.path.join(BASE_DIR, 'movies.csv')


def create_session_with_retries(total_retries=5, backoff_factor=0.5, status_forcelist=(429, 500, 502, 503, 504)):
    session = requests.Session()
    retries = Retry(total=total_retries, backoff_factor=backoff_factor, status_forcelist=status_forcelist, allowed_methods=["GET", "POST"])
    adapter = HTTPAdapter(max_retries=retries)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    return session


def fetch_telugu_movie_ids(max_pages=10, session=None):
    if session is None:
        session = create_session_with_retries()
    ids = set()
    page = 1
    while page <= max_pages:
        params = {
            'api_key': TMDB_API_KEY,
            'with_original_language': 'te',
            'sort_by': 'popularity.desc',
            'page': page,
            'vote_count.gte': 5
        }
        try:
            resp = session.get(f"{TMDB_BASE_URL}/discover/movie", params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"Warning: failed to fetch page {page}: {e}")
            # If a transient error occurs, back off a bit and try next page or retry loop will handle it
            time.sleep(1 + page * 0.2)
            # try to continue to next page - if API blocking persists, break to avoid long loops
            page += 1
            continue

        if 'results' not in data or not data['results']:
            break
        for m in data['results']:
            ids.add(m['id'])
        page += 1
        time.sleep(0.15)
    return list(ids)


def collect_ids_from_endpoints(session=None, max_pages=10):
    """Collect movie ids from several TMDB endpoints used by the frontend dashboard.
    This includes trending, popular, top_rated, upcoming, now_playing, and a discover
    query for Telugu originals. Returns a deduplicated list of ids.
    """
    if session is None:
        session = create_session_with_retries()

    endpoints = [
        (f"{TMDB_BASE_URL}/trending/movie/week", {}),
        (f"{TMDB_BASE_URL}/movie/top_rated", {}),
        (f"{TMDB_BASE_URL}/movie/popular", {}),
        (f"{TMDB_BASE_URL}/movie/upcoming", {}),
        (f"{TMDB_BASE_URL}/movie/now_playing", {}),
    ]

    ids = set()

    # helper to fetch pages for endpoints that support pagination
    def fetch_pages(url, params=None, pages=max_pages):
        p = 1
        while p <= pages:
            try:
                q = dict(params or {})
                q.update({'api_key': TMDB_API_KEY, 'page': p})
                resp = session.get(url, params=q, timeout=10)
                resp.raise_for_status()
                data = resp.json()
                if 'results' not in data or not data['results']:
                    break
                for m in data['results']:
                    if m and isinstance(m, dict) and 'id' in m:
                        ids.add(m['id'])
            except Exception as e:
                print(f"Warning: failed to fetch {url} page {p}: {e}")
                break
            p += 1
            time.sleep(0.12)

    # fetch from main endpoints
    for url, params in endpoints:
        fetch_pages(url, params=params, pages=max_pages)

    # discover Telugu originals explicitly (may overlap but ensures coverage)
    discover_url = f"{TMDB_BASE_URL}/discover/movie"
    discover_params = {'with_original_language': 'te', 'sort_by': 'popularity.desc', 'vote_count.gte': 5}
    fetch_pages(discover_url, params=discover_params, pages=max_pages)

    return list(ids)


def fetch_movie_details(movie_id, session=None):
    if session is None:
        session = create_session_with_retries()
    params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits,keywords,release_dates'}
    try:
        resp = session.get(f"{TMDB_BASE_URL}/movie/{movie_id}", params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"Warning: failed to fetch details for {movie_id}: {e}")
        return None
    genres = [g['name'] for g in data.get('genres', [])]
    directors = []
    actors = []
    if 'credits' in data:
        for c in data['credits'].get('crew', []):
            if c.get('job') == 'Director':
                directors.append(c.get('name'))
        for cast in data['credits'].get('cast', [])[:8]:
            actors.append(cast.get('name'))

    keywords = [kw['name'] for kw in data.get('keywords', {}).get('keywords', [])[:20]]

    return {
        'tmdb_id': int(movie_id),
        'title': data.get('title', ''),
        'original_title': data.get('original_title', ''),
        'overview': data.get('overview', ''),
        'genres': json.dumps(genres),
        'actors': json.dumps(actors),
        'directors': json.dumps(directors),
        'keywords': json.dumps(keywords),
        'release_date': data.get('release_date', ''),
        'poster_path': data.get('poster_path', ''),
        'vote_average': data.get('vote_average', 0),
        'vote_count': data.get('vote_count', 0),
        'popularity': data.get('popularity', 0),
        'original_language': data.get('original_language', ''),
        'last_updated': datetime.now().isoformat()
    }


def main():
    if not TMDB_API_KEY:
        print('Error: TMDB_API_KEY is not set. Export TMDB_API_KEY and try again.')
        return

    print('Fetching Telugu movie ids from TMDB...')
    session = create_session_with_retries()
    # collect ids from multiple dashboard-related endpoints (use 10 pages each for coverage)
    ids = collect_ids_from_endpoints(session=session, max_pages=10)
    # also include discover-based ids as backup (wider sweep, 10 pages)
    extra_ids = fetch_telugu_movie_ids(max_pages=10, session=session)
    ids = list(set(ids) | set(extra_ids))
    print(f'Found {len(ids)} ids, fetching details...')
    rows = []
    for i, mid in enumerate(ids):
        try:
            d = fetch_movie_details(mid, session=session)
            if d:
                rows.append(d)
        except Exception as e:
            print('Error fetching', mid, e)
        time.sleep(0.12)

    if rows:
        df = pd.DataFrame(rows)
        # save CSV
        df.to_csv(OUT_CSV, index=False)
        print(f'Saved {len(df)} movies to {OUT_CSV}')
    else:
        print('No rows fetched; nothing saved')


if __name__ == '__main__':
    main()
