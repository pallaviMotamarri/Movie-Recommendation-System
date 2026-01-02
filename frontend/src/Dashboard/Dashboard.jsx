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
        // const fetchDubbedMovies = async () => {
        //   try {
        //     const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi,ta,ml,kn&region=IN&sort_by=popularity.desc&page=1`);
        //     const data = await response.json();
            
        //     // Get movies that are popular in India (likely have Telugu dubs)
        //     return data.results?.slice(0, 10).map(movie => ({
        //       ...movie,
        //       // Add Telugu dubbed indicator to title for display
        //       title: `${movie.title} (తెలుగు డబ్బింగ్)`
        //     })) || [];
        //   } catch (error) {
        //     console.error('Error fetching dubbed movies:', error);
        //     return [];
        //   }
        // };

      // Replace your fetchDubbedMovies function with this:

const fetchDubbedMovies = async () => {
  try {
    console.log('Fetching dubbed movies...');
    
    // METHOD 1: Try different API endpoints
    const endpoints = [
      // Get popular Hindi movies (Bollywood - most likely to have Telugu dubs)
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=1&region=IN`,
      
      // Get popular Tamil movies
      `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=ta&sort_by=popularity.desc&page=1&region=IN`,
      
      // Get trending movies in India
      `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&region=IN`,
      
      // Search for movies with "Telugu" keyword
      `${BASE_URL}/search/movie?api_key=${API_KEY}&query=Telugu&page=1`,
    ];

    const responses = await Promise.all(endpoints.map(url => fetch(url)));
    const data = await Promise.all(responses.map(res => res.json()));
    
    // console.log('API responses:', data);
    
    // Combine all results
    const allMovies = [];
    data.forEach((responseData, index) => {
      if (responseData.results && Array.isArray(responseData.results)) {
        allMovies.push(...responseData.results);
      }
    });
    
    // console.log('All movies fetched:', allMovies.length);
    
    if (allMovies.length === 0) {
      // If API returns nothing, use hardcoded dubbed movies
      console.log('No movies from API, using hardcoded dubbed movies');
      return getHardcodedDubbedMovies();
    }
    
    // Filter: Get non-Telugu movies (assuming they have Telugu dubs)
    const nonTeluguMovies = allMovies.filter(movie => 
      movie.original_language !== 'te' && movie.original_language
    );
    
    // console.log('Non-Telugu movies:', nonTeluguMovies.length);
    
    // Remove duplicates by ID
    const uniqueMovies = [];
    const seenIds = new Set();
    
    nonTeluguMovies.forEach(movie => {
      if (movie.id && !seenIds.has(movie.id)) {
        seenIds.add(movie.id);
        uniqueMovies.push(movie);
      }
    });
    
    // Take top 10 and add dubbed indicator
    const dubbedMovies = uniqueMovies.slice(0, 10).map(movie => ({
      ...movie,
      title: `${movie.title}`,
      vote_average: movie.vote_average || 6.0, // Default rating if not available
      backdrop_path: movie.backdrop_path || movie.poster_path, // Use poster as backup
    }));
    
    // console.log('Processed dubbed movies:', dubbedMovies);
    
    // If we still don't have enough movies, add hardcoded ones
    if (dubbedMovies.length < 5) {
      const hardcoded = getHardcodedDubbedMovies();
      // Add only new movies (by ID)
      hardcoded.forEach(movie => {
        if (!dubbedMovies.some(m => m.id === movie.id)) {
          dubbedMovies.push(movie);
        }
      });
    }
    
    return dubbedMovies.slice(0, 10);
    
  } catch (error) {
    console.error('Error in fetchDubbedMovies:', error);
    return getHardcodedDubbedMovies();
  }
};

// Add this helper function outside fetchMovies but inside the component:
const getHardcodedDubbedMovies = () => {
  return [
    { 
      id: 101, 
      title: 'జవాన్ (తెలుగు డబ్బింగ్)', 
      original_language: 'hi', 
      poster_path: '/jFt1gS4BGHlK8PqrAGFkQc6c8Vm.jpg', 
      backdrop_path: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg', 
      overview: 'A high-octane action thriller about a man driven by justice.', 
      vote_average: 7.8, 
      release_date: '2023-10-19' 
    },
    { 
      id: 102, 
      title: 'ఆనంద్ (తెలుగు డబ్బింగ్)', 
      original_language: 'ta', 
      poster_path: '/8cTvj5nLzJcHdQpY7pL7vW5o9hK.jpg', 
      backdrop_path: '/6V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
      overview: 'A heartwarming Tamil drama now available in Telugu.', 
      vote_average: 8.1, 
      release_date: '2021-02-04' 
    },
    { 
      id: 103, 
      title: 'కాంతార (తెలుగు డబ్బింగ్)', 
      original_language: 'kn', 
      poster_path: '/d3pxNSoMp18jip8fBbOaC0I7C8L.jpg', 
      backdrop_path: '/5V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
      overview: 'A mystical thriller about conflict between villagers and a greedy landlord.', 
      vote_average: 8.4, 
      release_date: '2022-09-30' 
    },
    { 
      id: 104, 
      title: 'పథాన్ (తెలుగు డబ్బింగ్)', 
      original_language: 'hi', 
      poster_path: '/1P3QtW1AQR2dQgxVpa9TJjW4Qt7.jpg', 
      backdrop_path: '/7BgzBzF8mM799dJ9rLrJ8Tf0O9o.jpg', 
      overview: 'An Indian RAW agent takes on a terrorist group.', 
      vote_average: 6.8, 
      release_date: '2023-01-25' 
    },
    { 
      id: 105, 
      title: 'విక్రం వేద (తెలుగు డబ్బింగ్)', 
      original_language: 'ta', 
      poster_path: '/9dKCU1Q6jQ6K9zq8N0eL5w3q5WJ.jpg', 
      backdrop_path: '/6UcMqpkL1VZvjKqFgQjvE9sYQ8p.jpg', 
      overview: 'A gangster drama about loyalty and betrayal.', 
      vote_average: 8.3, 
      release_date: '2022-06-03' 
    },
    { 
      id: 106, 
      title: 'భూల్ భూలయ్య (తెలుగు డబ్బింగ్)', 
      original_language: 'hi', 
      poster_path: '/9dKCU1Q6jQ6K9zq8N0eL5w3q5WJ.jpg', 
      backdrop_path: '/5V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
      overview: 'A horror-comedy film now in Telugu dubbed version.', 
      vote_average: 6.5, 
      release_date: '2020-11-09' 
    },
    { 
      id: 107, 
      title: 'RRR (తెలుగు డబ్బింగ్)', 
      original_language: 'te', 
      poster_path: '/7BgzBzF8mM799dJ9rLrJ8Tf0O9o.jpg', 
      backdrop_path: '/7BgzBzF8mM799dJ9rLrJ8Tf0O9o.jpg', 
      overview: 'A fictional story about two Indian revolutionaries in this epic action drama.', 
      vote_average: 7.8, 
      release_date: '2022-03-25' 
    },
    { 
      id: 108, 
      title: 'భగవాన్ (తెలుగు డబ్బింగ్)', 
      original_language: 'ta', 
      poster_path: '/teCy1egGQa0y8ULJvlrDHQKnxBL.jpg', 
      backdrop_path: '/6UcMqpkL1VZvjKqFgQjvE9sYQ8p.jpg', 
      overview: 'A psychological thriller now available in Telugu dubbed version.', 
      vote_average: 7.2, 
      release_date: '2022-03-15' 
    },
    { 
      id: 109, 
      title: 'రాకెట్రీ (తెలుగు డబ్బింగ్)', 
      original_language: 'hi', 
      poster_path: '/aV8o4xRM8Bw3mHMPVW3Pmhq6N7u.jpg', 
      backdrop_path: '/6qHJnE2h1G5dD2JvVJwY3w5cW8i.jpg', 
      overview: 'A sports drama about cricket, now in Telugu dubbed version.', 
      vote_average: 8.0, 
      release_date: '2023-12-01' 
    },
    { 
      id: 110, 
      title: 'బాహుబలి (తెలుగు డబ్బింగ్)', 
      original_language: 'te', 
      poster_path: '/9c28Q4j94b2Hw57jvY4S4j2o8tT.jpg', 
      backdrop_path: '/6HjVYr4a43IWp2D6q3c5bN5pF5u.jpg', 
      overview: 'In ancient India, an adventurous and daring man becomes involved in a decades-old feud.', 
      vote_average: 8.8, 
      release_date: '2015-07-10' 
    }
  ];
};
        // const dubbedData = await fetchDubbedMovies();

        let dubbedData = await fetchDubbedMovies();
        // if (dubbedData.length === 0) {
        //   dubbedData = [
        //     { 
        //       id: 6, 
        //       title: 'జవాన్ (తెలుగు డబ్బింగ్)', 
        //       original_language: 'hi', 
        //       poster_path: '/jFt1gS4BGHlK8PqrAGFkQc6c8Vm.jpg', 
        //       backdrop_path: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg', 
        //       overview: 'A high-octane action thriller about a man driven by justice in this Telugu dubbed version.', 
        //       vote_average: 7.8, 
        //       release_date: '2023-10-19'
        //     },
        //     { 
        //       id: 7, 
        //       title: 'ఆనంద్ (తెలుగు డబ్బింగ్)',  
        //       original_language: 'ta', 
        //       poster_path: '/8cTvj5nLzJcHdQpY7pL7vW5o9hK.jpg', 
        //       backdrop_path: '/6V7b9nQ3t7v8K0l8v5f9xLzX0oG.jpg', 
        //       overview: 'A heartwarming Tamil drama now available in Telugu dubbed version.', 
        //       vote_average: 8.1, 
        //       release_date: '2021-02-04'
        //     },
        //   ];
        // }

//         console.log('Dubbed movies fetched:', dubbedData);
// console.log('Dubbed movies count:', dubbedData.length);
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
        <MovieRow title="Coming Soon" movies={upcoming} onMovieClick={setSelectedMovie} />
        <MovieRow title="Now Playing" movies={nowPlaying} onMovieClick={setSelectedMovie} />
        <MovieRow title="Trending Now" movies={trending} onMovieClick={setSelectedMovie} />
        <MovieRow title="Dubbed Movies" movies={dubbedMovies} onMovieClick={setSelectedMovie} />
        <MovieRow title="Popular" movies={popular} onMovieClick={setSelectedMovie} />
        <MovieRow title="Top Rated Movies" movies={topRated} onMovieClick={setSelectedMovie} />
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
    { label: 'Comedy', href: '#' },
    { label: 'Romance', href: '#' },
    { label: 'Thriller', href: '#' },
    { label: 'Horror', href: '#' },
    { label: 'Action', href: '#' },
    { label: 'Drama', href: '#' },
    { label: 'Sci-Fi', href: '#' },
    { label: 'Fantasy', href: '#' },
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

  const getSafeRating = (rating) => {
    if (typeof rating !== 'number' || isNaN(rating)) return '0.0';
    return rating.toFixed(1);
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
                  <span>{getSafeRating(currentMovie.vote_average)}</span>
                </div>
                <span className="year">
                  {new Date(currentMovie.release_date).getFullYear()}
                </span>
              </div>

              <p className="carousel-description">
                {currentMovie.overview}
              </p>

              <div className="carousel-actions">
                {/* <button className="watch-now-btn">
                  <Play size={20} />
                  <span>Watch Now</span>
                </button> */}
                <button 
                  className="more-info-btn"
                  onClick={() => setSelectedMovie(currentMovie)}
                >
                  <span>More Info</span>
                </button>
              </div>
            </div>
          </div>

          {/* <button onClick={goToPrevious} className="carousel-nav prev">
            <ChevronLeft size={24} />
          </button>

          <button onClick={goToNext} className="carousel-nav next">
            <ChevronRight size={24} />
          </button> */}
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
function MovieCard({ movie, onClick }) {
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
  const getSafeRating = (rating) => {
    if (typeof rating !== 'number' || isNaN(rating)) return '0.0';
    return rating.toFixed(1);
  };
  return (
    <div className="movie-card" onClick={() => onClick(movie)}>
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
          <span>{getSafeRating(movie.vote_average)}</span>
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

// Dubbed Movie Card Component (with Telugu Dubbed badge)
function DubbedMovieCard({ movie, onClick }) {
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
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
        
        {/* Dubbed Badge */}
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

// Movie Row Component
function MovieRow({ title, movies, onMovieClick }) {
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

  if (movies.length === 0){
    return (
    <div className="movie-row">
      <h2 className="row-title">{title}</h2>
      <div className="no-movies-message">
        No movies available in this category
      </div>
    </div>
  );
  }
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
              <DubbedMovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
            ) : (
              <MovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
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

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <X size={22} />
        </button>

        {/* HERO */}
        <div className="modal-hero">
          {movie.backdrop_path && (
            <img
              src={`${IMAGE_BASE_URL}/original${movie.backdrop_path}`}
              alt={movie.title}
              className="modal-hero-image"
            />
          )}

          <div className="modal-hero-overlay" />

          <div className="modal-hero-content">
            <h2 className="modal-title">{movie.title}</h2>

            <div className="modal-meta">
              <span className="meta-pill">
                {formatDate(movie.release_date)}
              </span>

              <span className="modal-rating">
                {getSafeRating(movie.vote_average)}
              </span>

              <span className="meta-pill">Movie</span>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="modal-content">
          <p className="modal-description">{movie.overview}</p>

          <div className="modal-details">
            <div className="details-grid">
              <div>
                <p className="detail-label">Rating</p>
                <p className="detail-value">
                  {movie.vote_average.toFixed(1)}/10
                </p>
              </div>

              <div>
                <p className="detail-label">Release Date</p>
                <p className="detail-value">
                  {formatDate(movie.release_date)}
                </p>
              </div>

              <div>
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