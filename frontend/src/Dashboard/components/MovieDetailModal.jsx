import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './../dashboard.css';

export default function MovieDetailModal({ movie, onClose, genres }) {
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

  useEffect(() => {
    if (!movie || !movie.id) return;
    let cancelled = false;
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
          <p className="modal-description">{movie.overview}</p>
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
        </div>
      </div>
    </div>
  );
}
