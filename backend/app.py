import os
import json
from datetime import datetime

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from flask import Flask, request, jsonify
from flask_cors import CORS


# Beginner-friendly Flask app that loads dataset ONCE at startup
# - Place your dataset at `backend/movies.csv`
# - No external HTTP calls are made inside route handlers
# - Use `update_data.py` to fetch/update the CSV separately


BASE_DIR = os.path.dirname(__file__)
MOVIES_CSV = os.path.join(BASE_DIR, 'movies.csv')


def safe_convert_to_list(x):
    if isinstance(x, list):
        return x
    if pd.isna(x):
        return []
    if isinstance(x, str):
        try:
            return json.loads(x)
        except Exception:
            return [s.strip() for s in x.split(',')] if x else []
    return []


def combine_features_row(row):
    title_weight = 3
    overview_weight = 2
    genres_weight = 2
    actors_weight = 1.5
    directors_weight = 2
    keywords_weight = 1.5

    title_text = str(row.get('title', '')) * int(title_weight)
    overview_text = str(row.get('overview', '')) * int(overview_weight)
    genres_text = (' '.join(row.get('genres', []) ) + ' ') * int(genres_weight)
    actors_text = (' '.join(row.get('actors', []) ) + ' ') * int(actors_weight)
    directors_text = (' '.join(row.get('directors', []) ) + ' ') * int(directors_weight)
    keywords_text = (' '.join(row.get('keywords', []) ) + ' ') * int(keywords_weight)

    return ' '.join([title_text.lower(), overview_text.lower(), genres_text.lower(), actors_text.lower(), directors_text.lower(), keywords_text.lower()])


def prepare_dataset(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found at {path}. Run update_data.py to create it.")
    try:
        df = pd.read_csv(path)
    except Exception:
        # fall back to the python engine which is more tolerant of embedded commas/escapes
        df = pd.read_csv(path, engine='python', escapechar='\\')
    # Normalize columns that may be stored as JSON strings
    for col in ['genres', 'actors', 'directors', 'writers', 'keywords']:
        if col in df.columns:
            df[col] = df[col].apply(safe_convert_to_list)
        else:
            df[col] = [[] for _ in range(len(df))]

    # Ensure tmdb_id column exists
    if 'tmdb_id' not in df.columns and 'id' in df.columns:
        df['tmdb_id'] = df['id']

    # Create a combined_features column if missing
    if 'combined_features' not in df.columns:
        df['combined_features'] = df.apply(combine_features_row, axis=1)

    # Fill NaNs for fields the frontend may expect
    df['title'] = df['title'].fillna('')
    df['overview'] = df['overview'].fillna('')
    return df


def build_model(df):
    # use min_df=1 so small example datasets still build without errors
    tfidf = TfidfVectorizer(stop_words='english', max_features=8000, min_df=1, ngram_range=(1, 3))
    tfidf_matrix = tfidf.fit_transform(df['combined_features'])
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    indices = pd.Series(df.index, index=df['tmdb_id']).to_dict()
    return tfidf, cosine_sim, indices


# Load dataset and build model ONCE when the server starts
print('Loading dataset...')
df = prepare_dataset(MOVIES_CSV)
print(f'Loaded {len(df)} movies from {MOVIES_CSV}')
tfidf, COSINE_SIM, INDICES = build_model(df)
print('TF-IDF model and similarity matrix built')


def get_recommendations_by_movie_id(movie_id, n=10):
    try:
        mid = int(movie_id)
    except Exception:
        return []
    if mid not in INDICES:
        return []
    idx = INDICES[mid]
    sim_scores = list(enumerate(COSINE_SIM[idx]))
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    sim_scores = sim_scores[1:n+1]
    movie_indices = [i[0] for i in sim_scores]
    recs = df.iloc[movie_indices].to_dict('records')
    out = []
    for i, rec in enumerate(recs):
        out.append({
            'tmdb_id': int(rec.get('tmdb_id')),
            'title': rec.get('title', ''),
            'original_language': rec.get('original_language', ''),
            'overview': rec.get('overview', ''),
            'poster_path': rec.get('poster_path', ''),
            'release_date': rec.get('release_date', ''),
            'vote_average': rec.get('vote_average', 0),
            'similarity_score': float(sim_scores[i][1])
        })
    return out


def get_recommendations_by_title(title, n=10):
    # find best match by contains (beginner-friendly)
    matches = df[df['title'].str.lower().str.contains(title.lower(), na=False)]
    if len(matches) > 0:
        matched = matches.iloc[0]
        mid = int(matched['tmdb_id'])
        return get_recommendations_by_movie_id(mid, n=n)

    # fallback: treat title as a text query against TF-IDF features
    try:
        query_vector = tfidf.transform([title.lower()])
        similarities = cosine_similarity(query_vector, tfidf.transform(df['combined_features']))
        sim_scores = list(enumerate(similarities[0]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[:n]
        movie_indices = [i[0] for i in sim_scores]
        recs = df.iloc[movie_indices].to_dict('records')
        out = []
        for i, rec in enumerate(recs):
            out.append({
                'tmdb_id': int(rec.get('tmdb_id')),
                'title': rec.get('title', ''),
                'original_language': rec.get('original_language', ''),
                'overview': rec.get('overview', ''),
                'poster_path': rec.get('poster_path', ''),
                'release_date': rec.get('release_date', ''),
                'vote_average': rec.get('vote_average', 0),
                'similarity_score': float(sim_scores[i][1])
            })
        return out
    except Exception:
        return []


# Flask app and routes (no external fetching in handlers)
app = Flask(__name__)
CORS(app)


@app.route('/api/recommendations/<movie>', methods=['GET'])
def api_recommendations(movie):
    # Accept either tmdb id or movie title
    n = int(request.args.get('limit', 10))
    # try id first
    try:
        mid = int(movie)
        recs = get_recommendations_by_movie_id(mid, n=n)
        if recs:
            return jsonify({'ok': True, 'query': movie, 'recommendations': recs})
        # numeric id present but no recs found in dataset -> try title param fallback
        title_q = request.args.get('title')
        if title_q:
            recs = get_recommendations_by_title(title_q, n=n)
            return jsonify({'ok': True, 'query': title_q, 'recommendations': recs})
        # else continue to treat the input as a title below
    except Exception:
        pass

    # treat `movie` as a title or text query
    recs = get_recommendations_by_title(movie, n=n)
    return jsonify({'ok': True, 'query': movie, 'recommendations': recs})


@app.route('/api/health', methods=['GET'])
def api_health():
    last_upd = df['last_updated'].max() if 'last_updated' in df.columns else 'N/A'
    return jsonify({'ok': True, 'status': 'running', 'movies_count': int(len(df)), 'last_updated': last_upd})


# Compatibility routes for older frontend endpoints
@app.route('/api/recommendations/movie/<int:movie_id>', methods=['GET'])
def api_recommendations_movie_compat(movie_id):
    try:
        n = int(request.args.get('limit', 10))
        title_q = request.args.get('title')
        if movie_id in INDICES:
            recs = get_recommendations_by_movie_id(movie_id, n=n)
            return jsonify({'ok': True, 'recommendations': recs})
        elif title_q:
            recs = get_recommendations_by_title(title_q, n=n)
            return jsonify({'ok': True, 'recommendations': recs})
        else:
            recs = get_recommendations_by_title(str(movie_id), n=n)
            return jsonify({'ok': True, 'recommendations': recs})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/movies/tmdb/<int:movie_id>/recommendations', methods=['GET'])
def api_movies_tmdb_recs_compat(movie_id):
    # older path mapping
    return api_recommendations_movie_compat(movie_id)


if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_API_PORT', 5000))
    host = os.environ.get('PYTHON_API_HOST', '0.0.0.0')
    print(f"Starting recommendation API on {host}:{port}")
    app.run(host=host, port=port, debug=False, use_reloader=False)