import MovieCard from './MovieCard';
import './../dashboard.css';
import { useNavigate } from 'react-router-dom';

export default function GenreView({ genre = '', movies = [], loading = false, onMovieClick, onClear }) {
  const navigate = useNavigate();
  const isSearchGenre = typeof genre === 'string' && genre.startsWith('Search:');

  return (
    <div className="genre-view">
      {!isSearchGenre ? (
        <div className="genre-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
          <h2 className="row-title">{genre}</h2>
          <div>
            <button className="more-info-btn" onClick={onClear}>Go Back</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 16px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="genre-logo-title">{genre}</div>
          <div className="genre-controls">
            <button
              className="go-back-btn"
              onClick={() => { if (typeof onClear === 'function') onClear(); navigate('/dashboard'); }}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      <div className="genre-grid" style={{ padding: '16px' }}>
        {(movies || []).map(movie => (
          <div key={movie.id || movie.tmdb_id || movie._id} style={{ marginBottom: 12 }}>
            <MovieCard movie={movie} onClick={onMovieClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
