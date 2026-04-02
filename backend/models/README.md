# backend/models

This folder is for the generated recommendation model pickle used by the backend.

Files
- `movie_similarity.pkl` — Pickled model containing a small `movies` DataFrame, `sim_matrix` (cosine similarity), `indices` mapping, and `vectorizer`.

How to generate
1. Install dependencies:

```bash
pip install pandas scikit-learn jupyter
```

2. Open and run the notebook `backend/recommendation_model.ipynb` in Jupyter, or run it headless:

```bash
jupyter nbconvert --to notebook --execute backend/recommendation_model.ipynb --output executed.ipynb
```

After running, the notebook will create `backend/models/movie_similarity.pkl`. Place that file wherever your backend expects model files (the notebook writes it to this folder by default).

Notes
- Replace the sample dataset in the notebook with your full movie dataset before generating a production model.
- If your backend is Node.js and expects a different format, adapt the saving step (for example, export CSVs or JSON instead of pickle).