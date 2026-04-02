"""
Extract hardcoded movie objects from the frontend Dashboard.jsx and append missing
movies to backend/movies.csv. This is a best-effort script for demo/static entries
embedded in the React source. It will not call external APIs.

Usage:
  cd backend
  python add_dashboard_movies.py
"""
import re
import os
import json
from datetime import datetime
import pandas as pd

ROOT = os.path.dirname(__file__)
FRONTEND_DASH = os.path.join(ROOT, '..', 'frontend', 'src', 'Dashboard', 'Dashboard.jsx')
CSV_PATH = os.path.join(ROOT, 'movies.csv')

PATTERN = re.compile(r"\{[^}]*?id\s*:\s*(?P<id>\d+)[^}]*?title\s*:\s*(?P<title>['\"][^'\"]+['\"])", re.DOTALL)


def load_csv(path):
    if os.path.exists(path):
        return pd.read_csv(path)
    cols = ['tmdb_id','title','overview','genres','actors','directors','writers','keywords','release_date','poster_path','vote_average','vote_count','popularity','original_language','last_updated']
    return pd.DataFrame(columns=cols)


def normalize_title(t):
    return t.strip().strip('"').strip("'")


def detect_lang_from_title(title):
    # crude detection: presence of Telugu characters
    if re.search(r"[\u0C00-\u0C7F]", title):
        return 'te'
    return 'te'


def main():
    if not os.path.exists(FRONTEND_DASH):
        print('Dashboard.jsx not found at', FRONTEND_DASH)
        return

    with open(FRONTEND_DASH, 'r', encoding='utf-8') as f:
        src = f.read()

    matches = PATTERN.finditer(src)
    found = {}
    for m in matches:
        mid = int(m.group('id'))
        title = normalize_title(m.group('title'))
        found[mid] = title

    if not found:
        print('No hardcoded movies found in Dashboard.jsx')
        return

    df = load_csv(CSV_PATH)
    existing_ids = set()
    if 'tmdb_id' in df.columns:
        existing_ids = set(df['tmdb_id'].astype(int).tolist())

    to_add = []
    now = datetime.now().isoformat()
    for mid, title in found.items():
        if mid in existing_ids:
            continue
        row = {
            'tmdb_id': mid,
            'title': title,
            'overview': '',
            'genres': json.dumps([]),
            'actors': json.dumps([]),
            'directors': json.dumps([]),
            'writers': json.dumps([]),
            'keywords': json.dumps([]),
            'release_date': '',
            'poster_path': '',
            'vote_average': 0,
            'vote_count': 0,
            'popularity': 0,
            'original_language': detect_lang_from_title(title),
            'last_updated': now
        }
        to_add.append(row)

    if not to_add:
        print('No new movies to add; dataset already contains all dashboard movies.')
        return

    new_df = pd.DataFrame(to_add)
    out_df = pd.concat([df, new_df], ignore_index=True, sort=False)
    out_df.to_csv(CSV_PATH, index=False)
    print(f'Appended {len(to_add)} movies to {CSV_PATH}')


if __name__ == '__main__':
    main()
