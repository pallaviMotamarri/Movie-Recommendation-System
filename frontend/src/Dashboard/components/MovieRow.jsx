import { useRef, useState } from 'react';
import './../dashboard.css';
import MovieCard from './MovieCard';
import DubbedMovieCard from './DubbedMovieCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MovieRow({ title, movies, onMovieClick }) {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.offsetWidth * 0.8;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  if (!movies || movies.length === 0){
    return (
      <div className="movie-row">
        <h2 className="row-title">{title}</h2>
        <div className="no-movies-message">No movies available in this category</div>
      </div>
    );
  }

  const isDubbedRow = title.toLowerCase().includes('dubbed');

  return (
    <div className="movie-row">
      <h2 className="row-title">{title}</h2>

      <div className="row-container">
        {showLeftArrow && (
          <button onClick={() => scroll('left')} className="row-nav left"><ChevronLeft size={24} /></button>
        )}

        <div ref={scrollContainerRef} onScroll={handleScroll} className="row-scroll">
          {movies.map((movie) => (
            isDubbedRow ? (
              <DubbedMovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
            ) : (
              <MovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
            )
          ))}
        </div>

        {showRightArrow && (
          <button onClick={() => scroll('right')} className="row-nav right"><ChevronRight size={24} /></button>
        )}
      </div>
    </div>
  );
}
