import './../dashboard.css';
import { Star } from 'lucide-react';

export default function DubbedMovieCard({ movie, onClick }) {
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
  const getSafeRating = (rating) => {
    if (typeof rating !== 'number' || isNaN(rating)) return '0.0';
    return rating.toFixed(1);
  };
  return (
    <div className="movie-card dubbed" onClick={() => onClick(movie)}>
      <div className="movie-poster">
        {movie.poster_path ? (
          <img
            src={`${IMAGE_BASE_URL}/w500${movie.poster_path}`}
            alt={movie.title}
            className="movie-image"
          />
        ) : (
          <div className="no-image">No Image</div>
        )}
        <div className="poster-overlay"></div>
        <div className="dubbed-badge">Dubbed</div>

        <div className="movie-rating">
          <Star size={12} />
          <span>{getSafeRating(movie.vote_average)}</span>
        </div>
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-year">
          {movie.release_date ? new Date(movie.release_date).getFullYear(): 'N/A'}
        </p>
      </div>
    </div>
  );
}
