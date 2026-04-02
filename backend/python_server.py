from flask import Flask, jsonify
from flask_cors import CORS
import pickle
import os
import pandas as pd
import numpy as np

APP_PORT = int(os.environ.get('PYTHON_API_PORT', 5000))
PICKLE_PATH = os.path.join(os.path.dirname(__file__), 'models', 'telugu_movie_recommender.pkl')

app = Flask(__name__)
CORS(app)

model = None
movies_df = None
cosine_sim = None
indices = None
movie_titles = None

if os.path.exists(PICKLE_PATH):
    try:
        with open(PICKLE_PATH, 'rb') as f:
            model = pickle.load(f)
        # support different key names
        movies_df = model.get('movies_data') or model.get('movies_df') or model.get('movies')
        cosine_sim = model.get('cosine_sim') or model.get('sim_matrix')
        indices = model.get('indices')
        movie_titles = model.get('movie_titles')
        if isinstance(movies_df, pd.DataFrame):
            movies_df = movies_df
        else:
            # if stored as something else (e.g., pandas object pickled differently), try to coerce
            try:
                movies_df = pd.DataFrame(movies_df)
            except Exception:
                movies_df = None
        print('Loaded recommendation pickle:', PICKLE_PATH)
    except Exception as e:
        print('Failed to load pickle:', e)
else:
    print('Pickle not found at', PICKLE_PATH)


def make_rec_list(idx, top_n=10):
    global cosine_sim, movies_df
    if cosine_sim is None or movies_df is None:
        return []
    if idx < 0 or idx >= len(movies_df):
        return []
    sims = list(enumerate(cosine_sim[idx]))
    sims = sorted(sims, key=lambda x: x[1], reverse=True)
    sims = sims[1:top_n+1]
    recs = []
    for i, score in sims:
        row = movies_df.iloc[i].to_dict()
        recs.append({
            'tmdb_id': int(row.get('tmdb_id') or row.get('id') or -1),
            'title': row.get('title') or row.get('name') or '',
            'score': float(score),
            'release_date': row.get('release_date') or row.get('release_date', ''),
            'vote_average': float(row.get('vote_average') or 0)
        })
    return recs


@app.route('/api/health')
def health():
    total = len(movies_df) if movies_df is not None else 0
    return jsonify({'ok': True, 'loaded': model is not None, 'total_movies': int(total)})


@app.route('/api/movies/tmdb/<int:tmdb_id>/recommendations')
def recs_for_tmdb(tmdb_id):
    limit = int(request.args.get('limit', 10)) if 'request' in globals() else 10
    # indices mapping expected: tmdb_id -> row index
    if indices is None:
        return jsonify({'ok': False, 'error': 'Model indices not loaded'})
    key = int(tmdb_id)
    if key not in indices:
        return jsonify({'ok': True, 'recommendations': []})
    idx = indices[key]
    recs = make_rec_list(idx, top_n=limit)
    return jsonify({'ok': True, 'recommendations': recs})


if __name__ == '__main__':
    print('Starting Flask recommendation server on port', APP_PORT)
    app.run(host='0.0.0.0', port=APP_PORT)
