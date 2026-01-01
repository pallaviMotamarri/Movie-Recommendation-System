import { useState, useEffect, useRef, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, User, Menu, X, ChevronLeft, ChevronRight, Play, Star, Share2, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import './dashboard.css';

// Main App Component
export default function Dashboard() {
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [dubbedMovies, setDubbedMovies] = useState([]);


  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
        const BASE_URL = 'https://api.themoviedb.org/3';
        
        // Helper function to get image URL
        const getImageUrl = (path, size = 'w500') => {
          if (!path) return '';
          return `https://image.tmdb.org/t/p/${size}${path}`;
        };

        // Function to fetch Telugu movies with fallback
        const fetchTeluguMovies = async (url) => {
          try {
            const response = await fetch(url);
            const data = await response.json();
            
            // Filter movies that are either:
            // 1. Original Telugu (original_language === 'te')
            // 2. OR have Telugu as an available language
            return data.results?.filter(movie => {
              // Check if it's Telugu original
              const isOriginalTelugu = movie.original_language === 'te';
              
              // Check if title contains Telugu indicators
              const hasTeluguTitle = movie.title && (
                movie.title.includes('స') || 
                movie.title.includes('తెలుగు') ||
                movie.original_title?.includes('స')
              );
              
              // Check if overview contains Telugu dubbed info
              const hasTeluguDubbed = movie.overview && (
                movie.overview.toLowerCase().includes('telugu') ||
                movie.overview.toLowerCase().includes('dubbed')
              );
              
              return isOriginalTelugu || hasTeluguTitle || hasTeluguDubbed;
            }).slice(0, 10) || [];
          } catch (error) {
            console.error('Error fetching Telugu movies:', error);
            return [];
          }
        };

        // Fetch different categories of Telugu movies
        const [trendingData, popularData, topRatedData, upcomingData, nowPlayingData] = await Promise.all([
          // Trending Telugu movies
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=popularity.desc&page=1`),
          
          // Popular Telugu movies
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=popularity.desc&vote_count.gte=100&page=1`),
          
          // Top Rated Telugu movies
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=vote_average.desc&vote_count.gte=50&page=1`),
          
          // Upcoming Telugu movies
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=primary_release_date.desc&primary_release_date.gte=${new Date().toISOString().split('T')[0]}&page=1`),
          
          // Now Playing Telugu movies
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=primary_release_date.desc&primary_release_date.lte=${new Date().toISOString().split('T')[0]}&page=1`)
        ]);

        // For dubbed movies, we need a different approach since TMDB doesn't have direct dubbed filter
        // We'll search for popular Indian movies that might have Telugu dubs
        const fetchDubbedMovies = async () => {
          try {
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi,ta,ml,kn&region=IN&sort_by=popularity.desc&page=1`);
            const data = await response.json();
            
            // Get movies that are popular in India (likely have Telugu dubs)
            return data.results?.slice(0, 10).map(movie => ({
              ...movie,
              // Add Telugu dubbed indicator to title for display
              title: `${movie.title} (తెలుగు డబ్బింగ్)`
            })) || [];
          } catch (error) {
            console.error('Error fetching dubbed movies:', error);
            return [];
          }
        };

        const dubbedData = await fetchDubbedMovies();

        setTrending(trendingData);
        setPopular(popularData);
        setTopRated(topRatedData);
        setUpcoming(upcomingData);
        setNowPlaying(nowPlayingData);
        setDubbedMovies(dubbedData);

      } catch (error) {
        console.error('Error fetching movies:', error);
        
        // Fallback: Demo Telugu movies with real image paths
        const originalTelugu = [
          { 
            id: 1, 
            title: 'సలార్', 
            original_language: 'te', 
            poster_path: '/hXqpQvF9A5fBvsm4dMqP6SXqqH4.jpg', 
            backdrop_path: '/8rpDcsfLJypbO6vREc0547VKqEv.jpg', 
            overview: 'A gangster sets out to protect his family from rivals in this Telugu action thriller.', 
            vote_average: 8.5, 
            release_date: '2023-12-22' 
          },
          { 
            id: 2, 
            title: 'పుష్ప', 
            original_language: 'te', 
            poster_path: '/3vjnO3oBmqKk7WgOQgf6sL23rZR.jpg', 
            backdrop_path: '/f1AQhx6ZfGhPZFTVKgxG91PhEYc.jpg', 
            overview: 'A rugged sandalwood smuggler leads a peaceful life until he is forced to confront his past.', 
            vote_average: 8.5, 
            release_date: '2022-01-13' 
          },
          { 
            id: 3, 
            title: 'అలా వైకుంఠపురములో', 
            original_language: 'te', 
            poster_path: '/teCy1egGQa0y8ULJvlrDHQKnxBL.jpg', 
            backdrop_path: '/6UcMqpkL1VZvjKqFgQjvE9sYQ8p.jpg', 
            overview: 'A man who works for a selfish landlord finds himself in a twist of fate.', 
            vote_average: 8.7, 
            release_date: '2021-01-12' 
          },
          { 
            id: 4, 
            title: 'బాహుబలి', 
            original_language: 'te', 
            poster_path: '/9c28Q4j94b2Hw57jvY4S4j2o8tT.jpg', 
            backdrop_path: '/6HjVYr4a43IWp2D6q3c5bN5pF5u.jpg', 
            overview: 'In ancient India, an adventurous and daring man becomes involved in a decades-old feud.', 
            vote_average: 8.8, 
            release_date: '2015-07-10' 
          },
          { 
            id: 5, 
            title: 'అర్జున్ రెడ్డి', 
            original_language: 'te', 
            poster_path: '/aV8o4xRM8Bw3mHMPVW3Pmhq6N7u.jpg', 
            backdrop_path: '/6qHJnE2h1G5dD2JvVJwY3w5cW8i.jpg', 
            overview: 'A police officer wages a war against a politically connected criminal syndicate.', 
            vote_average: 7.9, 
            release_date: '2023-08-25' 
          },
        ];
        
        const dubbedMovies = [
          { 
            id: 6, 
            title: 'జవాన్ (తెలుగు డబ్బింగ్)', 
            original_language: 'hi', 
            poster_path: '/jFt1gS4BGHlK8PqrAGFkQc6c8Vm.jpg', 
            backdrop_path: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg', 
            overview: 'A high-octane action thriller about a man driven by justice in this Telugu dubbed version.', 
            vote_average: 7.8, 
            release_date: '2023-10-19' 
          },
          { 
            id: 7, 
            title: 'ఆనంద్ (తెలుగు డబ్బింగ్)', 
            original_language: 'ta', 
            poster_path: '/8cTvj5nLzJcHdQpY7pL7vW5o9hK.jpg', 
            backdrop_path: '/6V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
            overview: 'A heartwarming Tamil drama now available in Telugu dubbed version.', 
            vote_average: 8.1, 
            release_date: '2021-02-04' 
          },
          { 
            id: 8, 
            title: 'భూల్ భూలయ్య (తెలుగు డబ్బింగ్)', 
            original_language: 'hi', 
            poster_path: '/9dKCU1Q6jQ6K9zq8N0eL5w3q5WJ.jpg', 
            backdrop_path: '/5V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
            overview: 'A horror-comedy film now in Telugu dubbed version.', 
            vote_average: 6.5, 
            release_date: '2020-11-09' 
          },
        ];

        setTrending(originalTelugu);
        setPopular(originalTelugu);
        setTopRated(originalTelugu);
        setUpcoming(originalTelugu.slice(0, 3));
        setNowPlaying(originalTelugu);
        setDubbedMovies(dubbedMovies);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  // useEffect(() => {
  //   const API_KEY = import.meta.env.VITE_TMDB_API_KEY; // Replace with your TMDB API key
  //   const BASE_URL = 'https://api.themoviedb.org/3';
  //   const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
  // //   const fetchMovies = async () => {
  //     try {
  //       const endpoints = [
  //         `${BASE_URL}/trending/movie/week?api_key=${API_KEY}`,
  //         `${BASE_URL}/movie/popular?api_key=${API_KEY}`,
  //         `${BASE_URL}/movie/top_rated?api_key=${API_KEY}`,
  //         `${BASE_URL}/movie/upcoming?api_key=${API_KEY}`,
  //         `${BASE_URL}/movie/now_playing?api_key=${API_KEY}`
  //       ];

  //       const responses = await Promise.all(endpoints.map(url => fetch(url)));
  //       const data = await Promise.all(responses.map(res => res.json()));

  //       setTrending(data[0].results);
  //       setPopular(data[1].results);
  //       setTopRated(data[2].results);
  //       setUpcoming(data[3].results);
  //       setNowPlaying(data[4].results);
  //     } catch (error) {
  //       console.error('Error fetching movies:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchMovies();
  // }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <HeroCarousel 
        movies={trending} 
        selectedMovie={selectedMovie} 
        setSelectedMovie={setSelectedMovie}
      />
      
      <div className="movie-rows-container">
        <MovieRow title="Trending Now" movies={trending} />
        <MovieRow title="Dubbed Movies" movies={dubbedMovies} />
        <MovieRow title="Popular on Platform" movies={popular} />
        <MovieRow title="Top Rated Movies" movies={topRated} />
        <MovieRow title="Coming Soon" movies={upcoming} />
        <MovieRow title="Now Playing" movies={nowPlaying} />
      </div>

      {selectedMovie && (
        <MovieDetailModal 
          movie={selectedMovie} 
          onClose={() => setSelectedMovie(null)} 
        />
      )}
    </div>
  );
}

// Header Component
function Header({ isMenuOpen, setIsMenuOpen }) {
  const navItems = [
    { label: 'Movies', href: '#' },
    { label: 'TV Shows', href: '#' },
    { label: 'Sports', href: '#' },
    { label: 'Premium', href: '#' },
  ];

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="brand-text">
              <h1 className="brand-title">
                Telugu CineGuide
              </h1>
              <p className="brand-subtitle">
                Curated picks for Telugu movie lovers
              </p>
            </div>
          </div>

          <div className="header-right">
            <button className="search-btn">
              <Search size={20} />
            </button>
            {/* <button className="subscribe-btn">
              <User size={18} />
              <span>Subscribe</span>
            </button> */}
          </div>
        </div>

        {isMenuOpen && (
          <nav className="mobile-nav">
            <div className="mobile-nav-items">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="mobile-nav-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

// Hero Carousel Component
function HeroCarousel({ movies, selectedMovie, setSelectedMovie }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

  const carouselMovies = movies.slice(0, 7);

  useEffect(() => {
    if (!autoplay || selectedMovie) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselMovies.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [autoplay, selectedMovie, carouselMovies.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + carouselMovies.length) % carouselMovies.length);
    setAutoplay(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % carouselMovies.length);
    setAutoplay(false);
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setAutoplay(false);
  };

  if (carouselMovies.length === 0) return null;

  const currentMovie = carouselMovies[currentIndex];

  return (
    <>
      <div className="hero-carousel">
        <div className="carousel-container">
          {carouselMovies.map((movie, index) => (
            <div
              key={movie.id}
              className={`carousel-slide ${index === currentIndex ? 'active' : ''}`}
            >
              <img
                src={movie.backdrop_path ? `${IMAGE_BASE_URL}/original${movie.backdrop_path}` : ''}
                alt={movie.title}
                className="carousel-image"
              />
              <div className="carousel-overlay"></div>
            </div>
          ))}

          <div className="carousel-content">
            <div className="carousel-info">
              <h1 className="carousel-title">{currentMovie.title}</h1>

              <div className="carousel-meta">
                <div className="rating-badge">
                  <span>{currentMovie.vote_average.toFixed(1)}</span>
                </div>
                <span className="year">
                  {new Date(currentMovie.release_date).getFullYear()}
                </span>
              </div>

              <p className="carousel-description">
                {currentMovie.overview}
              </p>

              <div className="carousel-actions">
                <button className="watch-now-btn">
                  <Play size={20} />
                  <span>Watch Now</span>
                </button>
                <button 
                  className="more-info-btn"
                  onClick={() => setSelectedMovie(currentMovie)}
                >
                  <span>More Info</span>
                </button>
              </div>
            </div>
          </div>

          <button onClick={goToPrevious} className="carousel-nav prev">
            <ChevronLeft size={24} />
          </button>

          <button onClick={goToNext} className="carousel-nav next">
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="carousel-indicators">
          {carouselMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`indicator ${index === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Movie Card Component
function MovieCard({ movie }) {
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

  return (
    <div className="movie-card">
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

        <div className="movie-rating">
          <Star size={12} />
          <span>{movie.vote_average.toFixed(1)}</span>
        </div>
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-year">
          {new Date(movie.release_date).getFullYear()}
        </p>
      </div>
    </div>
  );
}

// Dubbed Movie Card Component (with Telugu Dubbed badge)
function DubbedMovieCard({ movie }) {
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

  return (
    <div className="movie-card dubbed">
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
        
        {/* Dubbed Badge */}
        <div className="dubbed-badge">తెలుగు డబ్బింగ్</div>

        <div className="movie-rating">
          <Star size={12} />
          <span>{movie.vote_average?.toFixed(1) || 'N/A'}</span>
        </div>
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-year">
          {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
        </p>
      </div>
    </div>
  );
}

// Movie Row Component
function MovieRow({ title, movies }) {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.offsetWidth * 0.8;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  if (movies.length === 0) return null;
  const isDubbedRow = title.toLowerCase().includes('dubbed');


  return (
    <div className="movie-row">
      <h2 className="row-title">{title}</h2>

      <div className="row-container">
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="row-nav left"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="row-scroll"
        >
          {movies.map((movie) => (
            isDubbedRow ? (
              <DubbedMovieCard key={movie.id} movie={movie} />
            ) : (
              <MovieCard key={movie.id} movie={movie} />
            )
          ))}
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="row-nav right"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
}

// Movie Detail Modal Component
function MovieDetailModal({ movie, onClose }) {
  const [isMuted, setIsMuted] = useState(true);
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal">
        <button onClick={onClose} className="modal-close">
          <X size={24} />
        </button>

        <div className="modal-hero">
          {movie.backdrop_path ? (
            <img
              src={`${IMAGE_BASE_URL}/original${movie.backdrop_path}`}
              alt={movie.title}
              className="modal-hero-image"
            />
          ) : (
            <div className="modal-no-image">No Image Available</div>
          )}

          <div className="modal-hero-overlay"></div>

          <div className="modal-hero-controls">
            <div className="controls-container">
              <button className="play-btn">
                <Play size={28} />
              </button>

              <div className="action-buttons">
                <button className="action-btn">
                  <ThumbsUp size={20} />
                </button>
                <button className="action-btn">
                  <Share2 size={20} />
                </button>
              </div>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="volume-btn"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{movie.title}</h2>
            <div className="modal-meta">
              <span className="meta-year">
                {new Date(movie.release_date).getFullYear()}
              </span>
              <div className="modal-rating">
                <span>{movie.vote_average.toFixed(1)}</span>
              </div>
              <span className="meta-type">Movie</span>
            </div>
          </div>

          <p className="modal-description">{movie.overview}</p>

          <div className="modal-details">
            <div className="details-grid">
              <div className="detail-item">
                <p className="detail-label">Rating</p>
                <p className="detail-value">{movie.vote_average.toFixed(1)}/10</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Release Date</p>
                <p className="detail-value">
                  {new Date(movie.release_date).toLocaleDateString()}
                </p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Type</p>
                <p className="detail-value">Movie</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}