const express = require('express');
const router = express.Router();
const Similarity = require('../models/similarity');
const Movie = require('../models/movie');
const mongoose = require('mongoose');
const recompute = require('../services/recommendationService');

function isTeluguCandidateLocal(m) {
  if (!m) return false;
  if (m.original_language && m.original_language === 'te') return true;
  const text = `${m.title || m.name || ''} ${m.overview || ''} ${m.original_title || ''}`;
  if (/telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text)) return true;
  return false;
}

async function tmdbHasTeluguTranslation(tmdbId) {
  try {
    const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
    if (!key) return false;
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/translations?api_key=${key}`);
    const j = await res.json();
    if (!j || !Array.isArray(j.translations)) return false;
    return j.translations.some(t => t.iso_639_1 === 'te' || (t.english_name && /telugu/i.test(t.english_name)));
  } catch (e) {
    return false;
  }
}

// Simple in-memory cache to avoid DB read for frequent requests
const cache = new Map(); // key -> {ts, data}
const CACHE_TTL = 1000 * 60 * 3; // 3 minutes

router.get('/api/movies/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const cacheKey = `${id}:${limit}:${page}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return res.json({ ok: true, fromCache: true, ...cached.data });
    }

    // find similarities
    const movieObjectId = mongoose.isValidObjectId(id) ? mongoose.Types.ObjectId(id) : null;
    let simDoc = null;
    if (movieObjectId) simDoc = await Similarity.findOne({ movieId: movieObjectId }).lean().exec();

    let recommendations = [];
    if (simDoc && Array.isArray(simDoc.recommendations) && simDoc.recommendations.length > 0) {
      // paginate
      const start = (page - 1) * limit;
      const pageItems = simDoc.recommendations.slice(start, start + limit);
      const movieIds = pageItems.map(r => r.movieId);
      const movies = await Movie.find({ _id: { $in: movieIds } }).lean().exec();
      const moviesById = new Map(movies.map(m => [String(m._id), m]));

      recommendations = pageItems.map(p => {
        const m = moviesById.get(String(p.movieId));
        if (!m) return null;
        // Determine if this movie is dubbed (best-effort): original_language != 'te' but title/overview mention Telugu or 'dubbed'
        const isDubbed = (m.original_language && m.original_language !== 'te') && (
          (m.title && /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(m.title)) ||
          (m.overview && /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(m.overview))
        );

        return {
          movieId: m._id,
          tmdb_id: m.tmdb_id || null,
          id: m.tmdb_id || String(m._id),
          title: m.title,
          poster_path: m.poster_path,
          release_year: m.release_date ? (new Date(m.release_date).getFullYear()) : null,
          release_date: m.release_date || null,
          rating: m.vote_average || null,
          original_language: m.original_language || null,
          isDubbed: Boolean(isDubbed),
          score: p.score,
          sharedFeatures: p.sharedFeatures || []
        };
      }).filter(Boolean).filter(m => isTeluguCandidateLocal(m));
    }

    // Do not provide default/popular fallbacks here; only actual recommendations should be returned.
    // If none found, `recommendations` will be empty.

    const data = { ok: true, movieId: id, page, limit, recommendations };
    cache.set(cacheKey, { ts: now, data });
    return res.json(data);
  } catch (err) {
    console.error('Recommendation endpoint error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

// Additional route: lookup by TMDB id and return recommendations
router.get('/api/movies/tmdb/:tmdbId/recommendations', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const cacheKey = `tmdb:${tmdbId}:${limit}:${page}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return res.json({ ok: true, fromCache: true, ...cached.data });
    }

    // find movie by tmdb_id
    const movie = await Movie.findOne({ tmdb_id: Number(tmdbId) }).lean().exec();
    let recommendations = [];

    if (movie) {
      const simDoc = await Similarity.findOne({ movieId: movie._id }).lean().exec();
      if (simDoc && Array.isArray(simDoc.recommendations) && simDoc.recommendations.length > 0) {
        const start = (page - 1) * limit;
        const pageItems = simDoc.recommendations.slice(start, start + limit);
        const movieIds = pageItems.map(r => r.movieId);
        const movies = await Movie.find({ _id: { $in: movieIds } }).lean().exec();
        const moviesById = new Map(movies.map(m => [String(m._id), m]));

        recommendations = pageItems.map(p => {
          const m = moviesById.get(String(p.movieId));
          if (!m) return null;
          const isDubbed = (m.original_language && m.original_language !== 'te') && (
            (m.title && /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(m.title)) ||
            (m.overview && /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(m.overview))
          );
          return {
            movieId: m._id,
            tmdb_id: m.tmdb_id || null,
            id: m.tmdb_id || String(m._id),
            title: m.title,
            poster_path: m.poster_path,
            release_year: m.release_date ? (new Date(m.release_date).getFullYear()) : null,
            release_date: m.release_date || null,
            rating: m.vote_average || null,
            original_language: m.original_language || null,
            isDubbed: Boolean(isDubbed),
            score: p.score,
            sharedFeatures: p.sharedFeatures || []
          };
        }).filter(Boolean);
      }
    }

    // fallback if none
    if (recommendations.length === 0) {
      // Try on-the-fly TF-IDF + cosine using TMDB if API key available
      try {
        const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
        if (TMDB_KEY && movie && movie.tmdb_id) {
          // fetch seed full details
          const fetchFull = async (id) => {
            try {
              const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,keywords`;
              const r = await fetch(url);
              return await r.json();
            } catch (e) { return null; }
          };

          const seed = await fetchFull(movie.tmdb_id);
          if (seed) {
            // get candidate ids from TMDB similar
            const simRes = await fetch(`https://api.themoviedb.org/3/movie/${seed.id}/similar?api_key=${TMDB_KEY}&language=en-US&page=1`);
            const simJson = await simRes.json();
            const candidateList = (simJson.results || []).slice(0, 40).map(r => r.id);
            if (candidateList.length > 0) {
              // fetch candidate details in batches
              const candDetails = [];
              for (let i = 0; i < candidateList.length; i += 20) {
                const batch = candidateList.slice(i, i + 20);
                const prom = await Promise.all(batch.map(id => fetchFull(id)));
                prom.forEach(p => { if (p) candDetails.push(p); });
              }

              // build docs and compute TF-IDF vectors using service helpers
              const docs = [];
              const seedDocText = recompute.buildDocument(seed);
              docs.push({ id: 'seed', text: seedDocText, meta: seed });
              candDetails.forEach(c => docs.push({ id: String(c.id), text: recompute.buildDocument(c), meta: c }));

              const tokenize = recompute.tokenize;
              const tokenized = docs.map(d => ({ id: d.id, toks: tokenize(d.text) }));
              const tfs = tokenized.map(t => ({ id: t.id, tf: recompute.termFrequency ? recompute.termFrequency(t.toks) : (function(){const tf={};t.toks.forEach(x=>tf[x]=(tf[x]||0)+1);const L=t.toks.length||1;Object.keys(tf).forEach(k=>tf[k]=tf[k]/L);return tf;})() }));
              const df = Object.create(null);
              tokenized.forEach(t => { const seen = new Set(); t.toks.forEach(tok => { if (!seen.has(tok)) { seen.add(tok); df[tok] = (df[tok] || 0) + 1; } }); });
              const Ndoc = tokenized.length;
              const idf = Object.create(null);
              Object.keys(df).forEach(k => { idf[k] = Math.log(Ndoc / (1 + df[k])); });

              const vectors = tfs.map(({ id, tf }) => {
                const vec = Object.create(null);
                Object.keys(tf).forEach(term => { vec[term] = tf[term] * (idf[term] || 0); });
                const norm = recompute.vectorNorm ? recompute.vectorNorm(vec) : (function(){let s=0;for(const k in vec)s+=vec[k]*vec[k];return Math.sqrt(s);})();
                return { id, vec, norm };
              });

              const seedVec = vectors.find(v => v.id === 'seed');
              if (seedVec) {
                const dotProduct = recompute.dotProduct || function(a,b){let s=0;const kb=new Set(Object.keys(b));Object.keys(a).forEach(k=>{if(kb.has(k))s+=a[k]*b[k];});return s;};
                const cands = vectors.filter(v => v.id !== 'seed' && v.norm > 0).map(v => {
                  const dot = dotProduct(seedVec.vec, v.vec);
                  const score = dot / (seedVec.norm * v.norm + 1e-12);
                  return { id: v.id, score };
                }).filter(x => isFinite(x.score) && x.score > 0).sort((a,b)=>b.score - a.score).slice(0, limit*2);

                const out = [];
                for (const c of cands) {
                  const meta = candDetails.find(d => String(d.id) === c.id) || {};
                  // ensure Telugu-only
                  const isTel = (meta.original_language === 'te') || await tmdbHasTeluguTranslation(Number(c.id)) || /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test((meta.title || '') + ' ' + (meta.overview || ''));
                  if (!isTel) continue;
                  out.push({ movieId: null, tmdb_id: Number(c.id), id: Number(c.id), title: meta.title || meta.name, poster_path: meta.poster_path, release_year: meta.release_date ? (new Date(meta.release_date).getFullYear()) : null, release_date: meta.release_date || null, rating: meta.vote_average || null, original_language: meta.original_language || null, isDubbed: Boolean(meta.original_language && meta.original_language !== 'te' && /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test((meta.title||'')+' '+(meta.overview||''))), score: Number(c.score.toFixed(6)), sharedFeatures: [] });
                  if (out.length >= limit) break;
                }

                if (out.length > 0) {
                  recommendations = out;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('On-the-fly TMDB TF-IDF error', e);
      }

      // Do not provide default/popular fallbacks here; only actual recommendations should be returned.
      // If none found, `recommendations` will be empty.

    const data = { ok: true, tmdbId, page, limit, recommendations };
    cache.set(cacheKey, { ts: now, data });
    return res.json(data);
  } catch (err) {
    console.error('TMDB lookup recommendations error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});
