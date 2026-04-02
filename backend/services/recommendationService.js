/*
  recommendationService.js

  Responsibilities:
  - Load movie documents from MongoDB
  - Build a combined text "document" for each movie composed of: genres, top-5 cast names, director name, keywords, overview
  - Compute TF-IDF vectors for all movies and calculate cosine similarity between them
  - Persist top-N recommendations per movie into the `similarities` collection

  ML explanation (in comments):
  - TF-IDF: term frequency-inverse document frequency. It weights a term in a document by how important it is
    compared to the corpus. TF = (term count in doc) / (total terms in doc). IDF = log(N / (1 + docFreq)).
    TF-IDF = TF * IDF. This produces sparse document vectors useful for measuring document similarity.

  - Cosine similarity: given two TF-IDF vectors A and B, cosine similarity = (A.B) / (||A|| * ||B||).
    It measures the angle between vectors: 1 = identical direction, 0 = orthogonal.

  Notes:
  - Implementation below is vanilla JS without external ML libraries. It's straightforward and explainable.
  - For large datasets consider approximate nearest neighbors (ANN) or incremental updates.
*/

const Movie = require('../models/movie');
const Similarity = require('../models/similarity');
const mongoose = require('mongoose');

// small stopword list to keep vectors focused
const STOPWORDS = new Set(["the","a","an","and","or","of","in","on","for","to","with","by","from","is","are","as","at","that","this","it","be","was","were"]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
    .split(/\s+/)
    .filter(t => t && t.length > 1 && !STOPWORDS.has(t));
}

function buildDocument(movie) {
  // genres: array of strings
  const genres = Array.isArray(movie.genres) ? movie.genres.join(' ') : '';

  // cast: top 5 names
  const castNames = (movie.credits && Array.isArray(movie.credits.cast)) ? movie.credits.cast.slice(0,5).map(c => c.name).join(' ') : '';

  // director
  let director = '';
  if (movie.credits && Array.isArray(movie.credits.crew)) {
    const d = movie.credits.crew.find(c => c.job && c.job.toLowerCase() === 'director');
    director = d ? d.name : '';
  }

  // keywords
  const keywords = Array.isArray(movie.keywords) ? movie.keywords.map(k => k.name || k).join(' ') : '';

  // overview
  const overview = movie.overview || '';

  // combine
  const combined = [genres, castNames, director, keywords, overview].filter(Boolean).join(' ');
  return combined;
}

// Build TF map for a tokenized list
function termFrequency(tokens) {
  const tf = Object.create(null);
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const len = tokens.length || 1;
  Object.keys(tf).forEach(k => { tf[k] = tf[k] / len; });
  return tf;
}

// compute vector norms
function vectorNorm(vec) {
  let sum = 0;
  for (const k in vec) sum += vec[k] * vec[k];
  return Math.sqrt(sum);
}

// dot product between two sparse vectors
function dotProduct(a, b) {
  let sum = 0;
  // iterate smaller object
  const keysA = Object.keys(a);
  const keysB = new Set(Object.keys(b));
  for (const k of keysA) {
    if (keysB.has(k)) sum += a[k] * b[k];
  }
  return sum;
}

async function computeAndStore({ topK = 20, persistTop = 50 } = {}) {
  // load movies
  const movies = await Movie.find({}).lean().exec();
  const N = movies.length;
  if (N === 0) {
    console.warn('No movies found to compute similarities');
    return;
  }

  // build docs
  const docs = movies.map(m => ({ _id: m._id, tmdb_id: m.tmdb_id, text: buildDocument(m) }));

  // tokenize and build term frequencies
  const tokenized = docs.map(d => ({ id: d._id, tokens: tokenize(d.text) }));
  const tfs = tokenized.map(t => ({ id: t.id, tf: termFrequency(t.tokens) }));

  // document frequency
  const df = Object.create(null);
  tokenized.forEach(t => {
    const seen = new Set();
    t.tokens.forEach(tok => { if (!seen.has(tok)) { seen.add(tok); df[tok] = (df[tok] || 0) + 1; } });
  });

  // compute TF-IDF vectors
  const idf = Object.create(null);
  Object.keys(df).forEach(term => { idf[term] = Math.log(N / (1 + df[term])); });

  const vectors = tfs.map(({ id, tf }) => {
    const vec = Object.create(null);
    Object.keys(tf).forEach(term => { vec[term] = tf[term] * (idf[term] || 0); });
    return { id, vec, norm: vectorNorm(vec) };
  });

  // Create map from id to index for movies
  const idToIndex = new Map();
  movies.forEach((m, idx) => idToIndex.set(String(m._id), idx));

  // compute similarities (pairwise). For efficiency compute only upper triangle and then push to lists.
  const resultsMap = new Map();
  vectors.forEach(v => resultsMap.set(String(v.id), []));

  for (let i = 0; i < vectors.length; i++) {
    const vi = vectors[i];
    if (vi.norm === 0) continue;
    for (let j = i + 1; j < vectors.length; j++) {
      const vj = vectors[j];
      if (vj.norm === 0) continue;
      const dot = dotProduct(vi.vec, vj.vec);
      const score = dot / (vi.norm * vj.norm + 1e-12);
      if (!isFinite(score) || score <= 0) continue;

      // compute shared features: genres, cast names, director, keywords intersection (best-effort)
      const mi = movies[i];
      const mj = movies[j];
      const shared = new Set();

      // genres
      (mi.genres || []).forEach(g => { if ((mj.genres || []).includes(g)) shared.add(g); });
      // top cast intersection
      const castI = (mi.credits && mi.credits.cast) ? mi.credits.cast.slice(0,5).map(c => c.name) : [];
      const castJ = (mj.credits && mj.credits.cast) ? mj.credits.cast.slice(0,5).map(c => c.name) : [];
      castI.forEach(n => { if (castJ.includes(n)) shared.add(n); });
      // director
      const dirI = (mi.credits && mi.credits.crew) ? (mi.credits.crew.find(c => c.job && c.job.toLowerCase()==='director') || {}).name : null;
      const dirJ = (mj.credits && mj.credits.crew) ? (mj.credits.crew.find(c => c.job && c.job.toLowerCase()==='director') || {}).name : null;
      if (dirI && dirJ && dirI === dirJ) shared.add(dirI);
      // keywords
      const kwI = (mi.keywords || []).map(k => (k.name || k).toString());
      const kwJ = (mj.keywords || []).map(k => (k.name || k).toString());
      kwI.forEach(k => { if (kwJ.includes(k)) shared.add(k); });

      const sharedArr = Array.from(shared).slice(0, 10);

      resultsMap.get(String(vi.id)).push({ movieId: mj._id, score, sharedFeatures: sharedArr });
      resultsMap.get(String(vj.id)).push({ movieId: mi._id, score, sharedFeatures: sharedArr });
    }
  }

  // For each movie, sort by score desc and persist top persistTop
  const bulkOps = [];
  for (const [id, recs] of resultsMap.entries()) {
    if (!recs || recs.length === 0) continue;
    recs.sort((a,b) => b.score - a.score);
    const top = recs.slice(0, persistTop).map(r => ({ movieId: r.movieId, score: Number(r.score.toFixed(6)), sharedFeatures: r.sharedFeatures }));

    bulkOps.push({
      updateOne: {
        filter: { movieId: mongoose.Types.ObjectId(id) },
        update: { $set: { recommendations: top, updatedAt: new Date() } },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await Similarity.bulkWrite(bulkOps);
  }

  return { processed: movies.length, written: bulkOps.length };
}

module.exports = {
  computeAndStore,
  buildDocument,
  tokenize,
  termFrequency,
  vectorNorm,
  dotProduct
};
