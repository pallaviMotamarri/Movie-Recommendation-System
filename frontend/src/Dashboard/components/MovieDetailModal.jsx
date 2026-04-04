import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './../dashboard.css';
import MovieCard from './MovieCard';
import DubbedMovieCard from './DubbedMovieCard';

export default function MovieDetailModal({ movie, onClose, genres, setSelectedMovie }) {
  const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
  const getSafeRating = (rating) => {
    if (typeof rating !== 'number' || isNaN(rating)) return '0.0';
    return rating.toFixed(1);
  };
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const getGenreNames = () => {
    if (!movie.genre_ids || movie.genre_ids.length === 0) return 'Not specified';
    const genreNames = movie.genre_ids.map(id => genres[id]).filter(name => name).join(', ');
    return genreNames || 'Not specified';
  };

  const [providers, setProviders] = useState(null);
  const [modalRecs, setModalRecs] = useState([]);
  const [modalRecsLoading, setModalRecsLoading] = useState(false);
  const [detailOverview, setDetailOverview] = useState(movie && movie.overview ? movie.overview : '');

  useEffect(() => {
    if (!movie || !movie.id) return;
    let cancelled = false;
    // simple in-memory cache + inflight coalescing for backend/TMDB requests
    const _cache = new Map();
    const _inflight = new Map();
    const cachedFetch = async (url, opts = {}, ttl = 5 * 60 * 1000) => {
      try {
        if (_cache.has(url)) {
          const { ts, data } = _cache.get(url);
          if (Date.now() - ts < ttl) return { ok: true, status: 200, json: async () => data };
        }
        if (_inflight.has(url)) return await _inflight.get(url);
        const p = (async () => {
          const res = await fetch(url, opts);
          let data = null;
          try { data = await res.json(); } catch (e) { data = null; }
          if (res && res.ok) _cache.set(url, { ts: Date.now(), data });
          _inflight.delete(url);
          return { ok: res && res.ok, status: res ? res.status : 0, json: async () => data };
        })();
        _inflight.set(url, p);
        return await p;
      } catch (e) {
        return { ok: false, status: 0, json: async () => null };
      }
    };
    const fetchProviders = async () => {
      try {
        const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
        const BASE_URL = 'https://api.themoviedb.org/3';
        const res = await fetch(`${BASE_URL}/movie/${movie.id}/watch/providers?api_key=${API_KEY}`);
        const data = await res.json();
        const results = data.results || {};
        const chosen = results['IN'] || results['US'] || results[Object.keys(results)[0]] || null;
        if (!cancelled) setProviders(chosen);
      } catch (err) {
        console.error('Error fetching providers:', err);
        if (!cancelled) setProviders(null);
      }
    };
    fetchProviders();
      // If overview is missing, fetch full movie details from TMDB
      (async () => {
        try {
          if (movie && (!movie.overview || movie.overview.trim() === '')) {
            const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
            const BASE_URL = 'https://api.themoviedb.org/3';
            if (API_KEY) {
              const detRes = await fetch(`${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}`);
              const detJson = await detRes.json();
              if (detJson && detJson.overview) {
                if (!cancelled) setDetailOverview(detJson.overview);
              }
            }
          }
        } catch (err) {
          console.warn('Could not fetch movie details for overview fallback', err);
        }
      })();

      // Fetch recommendations for modal: try backend then TMDB similar as fallback
      const fetchModalRecs = async () => {
        try {
          setModalRecsLoading(true);
          const API_BASE = import.meta.env.VITE_API_BASE || '';
          const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
          const tmdbId = movie.id || movie.tmdb_id;
          if (!tmdbId) return;

          // Backend first: /api/recommendations/:movie (app.py)
          if (API_BASE) {
            try {
              const titleParam = encodeURIComponent(movie.title || movie.name || '');
              const res = await cachedFetch(`${API_BASE}/api/recommendations/${tmdbId}?limit=6&title=${titleParam}`);
              const j = await res.json();
              if (j && j.ok && Array.isArray(j.recommendations) && j.recommendations.length > 0) {
                // prefer Telugu originals or likely dubbed
                const telugu = j.recommendations.filter(r => {
                  const lang = r.original_language || '';
                  const text = `${r.title || ''} ${r.overview || ''}`;
                  return lang === 'te' || /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text);
                }).slice(0,6).map(r => ({ id: r.tmdb_id || r.id, title: r.title || r.name, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average }));
                if (telugu.length > 0) {
                  setModalRecs(telugu);
                  return;
                }
              }
            } catch (e) {
              // continue to TMDB fallback
            }
          }

          // TMDB fallback: similar
          if (API_KEY) {
            try {
              const r = await cachedFetch(`https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
              const d = await r.json();
              if (d && Array.isArray(d.results)) {
                const tel = d.results.filter(item => {
                  const lang = item.original_language || '';
                  const text = `${item.title || ''} ${item.overview || ''}`;
                  return lang === 'te' || /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text);
                }).slice(0,6).map(item => ({ id: item.id, title: item.title, poster_path: item.poster_path, release_date: item.release_date, vote_average: item.vote_average }));
                if (tel.length > 0) setModalRecs(tel);
              }
            } catch (e) {
              // ignore
            }
          }
        } finally {
          setModalRecsLoading(false);
        }
      };

      fetchModalRecs();
    return () => { cancelled = true; };
  }, [movie && movie.id]);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <button className="modal-close" onClick={onClose}><X size={22} /></button>
        <div className="modal-hero">
          {movie.backdrop_path && (
            <img src={`${IMAGE_BASE_URL}/original${movie.backdrop_path}`} alt={movie.title} className="modal-hero-image" />
          )}
          <div className="modal-hero-overlay" />
          <div className="modal-hero-content"><h2 className="modal-title">{movie.title}</h2></div>
        </div>

        <div className="modal-content">
          <p className="modal-description">{detailOverview || movie.overview || 'Overview not available.'}</p>
          <div className="modal-details">
            <div className="details-grid">
              <div>
                <p className="detail-label">Rating</p>
                <p className="detail-value">{movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10</p>
              </div>
              <div>
                <p className="detail-label">Release Date</p>
                <p className="detail-value">{formatDate(movie.release_date)}</p>
              </div>
              <div>
                <p className="detail-label">Genre</p>
                <p className="detail-value">{getGenreNames()}</p>
              </div>
            </div>
          </div>

          {providers && (
            <div className="modal-providers">
              <h3>Where to watch</h3>
              <div className="providers-sections">
                {providers.flatrate && providers.flatrate.length > 0 && (
                  <div className="providers-section">
                    <h4>Streaming</h4>
                    <div className="provider-list">
                      {providers.flatrate.map(p => (
                        <div key={`f-${p.provider_id}`} className="provider-item"><span>{p.provider_name}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {providers.rent && providers.rent.length > 0 && (
                  <div className="providers-section">
                    <h4>Rent</h4>
                    <div className="provider-list">
                      {providers.rent.map(p => (
                        <div key={`r-${p.provider_id}`} className="provider-item"><span>{p.provider_name}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {providers.buy && providers.buy.length > 0 && (
                  <div className="providers-section">
                    <h4>Buy</h4>
                    <div className="provider-list">
                      {providers.buy.map(p => (
                        <div key={`b-${p.provider_id}`} className="provider-item"><span>{p.provider_name}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal recommendations from backend or TMDB */}
          {modalRecs && modalRecs.length > 0 && (
            <div style={{padding: '16px'}}>
              <h3 style={{margin: '8px 0'}}>You can also watch</h3>
              <div className="movie-row">
                <div className="row-container">
                  <div className="row-scroll" style={{display: 'flex', gap: 12}}>
                    {modalRecs.map(m => (
                      <div key={m.id} style={{width: 140}}>
                        {(m.isDubbed) ? (
                          <DubbedMovieCard movie={m} onClick={() => { if (typeof setSelectedMovie === 'function') { setSelectedMovie(m); } else { if (typeof onClose === 'function') onClose(); } }} />
                        ) : (
                          <MovieCard movie={m} onClick={() => { if (typeof setSelectedMovie === 'function') { setSelectedMovie(m); } else { if (typeof onClose === 'function') onClose(); } }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
