"""
Run a minimal recommender adapted from the MovieRecommendation notebook.
Saves models to `backend/models` and prints sample recommendations.

Usage: python backend/run_movie_recommender.py
"""
import os
import sys
import pickle
from datetime import datetime

try:
    import pandas as pd
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except Exception as e:
    print("Missing required packages. Install with: pip install pandas scikit-learn")
    raise

# Output folder
OUT_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(OUT_DIR, exist_ok=True)

# Small sample dataset (fallback)
sample_movies = [
    {
        'tmdb_id': 1,
        'title': 'Bahubali',
        'overview': 'Epic action drama about a legendary king and his legacy.',
        'release_date': '2015-07-10',
        'vote_average': 8.1,
        'vote_count': 12000,
        'popularity': 200.0,
        'genres': ['Action','Drama','Fantasy'],
        'runtime': 159,
        'director': 'S.S. Rajamouli',
    },
    {
        'tmdb_id': 2,
        'title': 'RRR',
        'overview': 'Two revolutionaries fight for their country in this action-packed drama.',
        'release_date': '2022-03-25',
        'vote_average': 8.0,
        'vote_count': 9000,
        'popularity': 180.0,
        'genres': ['Action','Drama'],
        'runtime': 182,
        'director': 'S.S. Rajamouli',
    },
    {
        'tmdb_id': 3,
        'title': 'Pushpa',
        'overview': 'A lorry driver rises in the world of red sandalwood smuggling.',
        'release_date': '2021-12-17',
        'vote_average': 7.2,
        'vote_count': 6000,
        'popularity': 120.0,
        'genres': ['Action','Thriller'],
        'runtime': 170,
        'director': 'Sukumar',
    }
]

# Build DataFrame
df = pd.DataFrame(sample_movies)

# Preprocess
def preprocess(df):
    d = df.copy()
    d['overview'] = d['overview'].fillna('')
    d['tagline'] = d.get('tagline','')
    d['director'] = d['director'].fillna('')
    d['release_date'] = pd.to_datetime(d['release_date'], errors='coerce')
    d['release_year'] = d['release_date'].dt.year.fillna(0).astype(int)
    def genres_str(g):
        if isinstance(g, list):
            return ' '.join(g)
        return ''
    d['genres_text'] = d['genres'].apply(genres_str)
    d['combined_features'] = (d['title'].fillna('') + ' ') + (d['overview'].fillna('') + ' ') + d['director'].fillna('') + ' ' + d['genres_text']
    return d

df_clean = preprocess(df)

# TF-IDF and cosine
vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
X = vectorizer.fit_transform(df_clean['combined_features'])
sim = cosine_similarity(X, X)

# Indices
indices = pd.Series(df_clean.index, index=df_clean['tmdb_id']).to_dict()
movie_titles = pd.Series(df_clean['title'].values, index=df_clean['tmdb_id']).to_dict()

# Save artifacts
with open(os.path.join(OUT_DIR, 'tfidf_vectorizer.pkl'), 'wb') as f:
    pickle.dump(vectorizer, f)
with open(os.path.join(OUT_DIR, 'cosine_sim.pkl'), 'wb') as f:
    pickle.dump(sim, f)
with open(os.path.join(OUT_DIR, 'indices.pkl'), 'wb') as f:
    pickle.dump(indices, f)
with open(os.path.join(OUT_DIR, 'movie_titles.pkl'), 'wb') as f:
    pickle.dump(movie_titles, f)

# Combined recommendation system pickle
recommendation_system = {
    'vectorizer': vectorizer,
    'cosine_sim': sim,
    'indices': indices,
    'movie_titles': movie_titles,
    'movies_df': df_clean,
    'metadata': {'created': datetime.now().isoformat(), 'total_movies': len(df_clean)}
}
with open(os.path.join(OUT_DIR, 'telugu_movie_recommender.pkl'), 'wb') as f:
    pickle.dump(recommendation_system, f)

print('Saved models to', OUT_DIR)

# Recommendation helpers
def recommend_by_title(title, top_n=5):
    # find tmdb id
    matches = df_clean[df_clean['title'].str.lower() == title.lower()]
    if matches.empty:
        print('Title not found:', title)
        return pd.DataFrame()
    idx = matches.index[0]
    scores = list(enumerate(sim[idx]))
    scores = sorted(scores, key=lambda x: x[1], reverse=True)[1:top_n+1]
    inds = [i for i,_ in scores]
    out = df_clean.iloc[inds][['tmdb_id','title','release_year','vote_average','director']].copy()
    out['score'] = [s for _,s in scores]
    return out

# Print sample recommendations
for t in ['Bahubali', 'RRR', 'Pushpa']:
    print('\nRecommendations for', t)
    recs = recommend_by_title(t, top_n=5)
    if recs.empty:
        print('No recommendations')
    else:
        print(recs.to_string(index=False))

print('\nDone')
