import HeroCarousel from './HeroCarousel';
import MovieCard from './MovieCard';
import './../dashboard.css';

export default function GenreView({ genre, movies, loading, onMovieClick, onClear, navigate }) {
  return (
    <div className="genre-view">
      <div className="genre-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px'}}>
        <h2 className="row-title">{genre}</h2>
        <div>
          <button className="more-info-btn" onClick={onClear}>Show All</button>
        </div>
      </div>

      {loading ? (
        <div style={{padding: 16, textAlign: 'center', marginTop: 100}}>Loading {genre} movies...</div>
      ) : (
        <>
          <HeroCarousel movies={movies.slice(0, 7)} selectedMovie={null} setSelectedMovie={onMovieClick} />

          <div style={{padding: '4px 16px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div className="genre-logo-title">{genre}</div>
            <div className="genre-controls">
              <button
                type="button"
                className="go-back-btn"
                onClick={() => { if (typeof onClear === 'function') onClear(); navigate('/dashboard'); }}
              >
                Go Back
              </button>
            </div>
          </div>

          <div className="genre-grid" style={{padding: '16px'}}>
            {movies.map(movie => (
              <div key={movie.id} style={{marginBottom: 12}}>
                <MovieCard movie={movie} onClick={onMovieClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
