import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// icons are provided by individual components
import './dashboard.css';
import Header from './components/Header';
import HeroCarousel from './components/HeroCarousel';
import MovieCard from './components/MovieCard';
import DubbedMovieCard from './components/DubbedMovieCard';
import MovieRow from './components/MovieRow';
import MovieDetailModal from './components/MovieDetailModal';
import GenreView from './components/GenreView';

// Main App Component
export default function Dashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [sessionViewed, setSessionViewed] = useState([]);
  const [sessionRecommendations, setSessionRecommendations] = useState([]);
  const [promotedRows, setPromotedRows] = useState([]);

  // ensure session id exists
  useEffect(() => {
    try {
      let sid = sessionStorage.getItem('sessionId');
      if (!sid) {
        sid = `s_${Math.random().toString(36).slice(2,10)}`;
        sessionStorage.setItem('sessionId', sid);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // If the route is /genre-:slug, set the active genre accordingly
  useEffect(() => {
    try {
      const slug = params && params.slug ? String(params.slug) : null;
      if (!slug) return;
      const slugify = (s = '') => s.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const navList = ['Comedy', 'Romance', 'Thriller', 'Horror', 'Action', 'Drama', 'Sci-Fi', 'Fantasy'];
      const match = navList.find(l => slugify(l) === slug);
      if (match) {
        setSearchMode(false);
        setActiveGenre(match);
      } else {
        // if no match, try to decode from raw slug (replace - with space and capitalize)
        const fallback = slug.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setSearchMode(false);
        setActiveGenre(fallback);
      }
    } catch (e) {
      // ignore
    }
  }, [params && params.slug]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [recommendationReason, setRecommendationReason] = useState('');
  const [showRecDebug, setShowRecDebug] = useState(false);

  // Helper: detect whether an item is a Telugu original or likely Telugu-dubbed
  const isTeluguCandidate = (it = {}) => {
    if (!it) return false;
    if (it.original_language && it.original_language === 'te') return true;
    const text = `${it.title || ''} ${it.overview || ''}`;
    if (/telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text)) return true;
    return false;
  };

  // Open a movie in modal and track it for session recommendations
  const openMovie = (movie) => {
    if (!movie) return;
    // normalize movie object to ensure tmdb_id is present
    const resolvedId = movie.tmdb_id || movie.id || movie.movieId || movie._id;
    const normalized = { ...movie, tmdb_id: resolvedId, id: resolvedId, title: movie.title || movie.name };
    setSelectedMovie(normalized);
    setSessionViewed(prev => {
      const id = normalized.tmdb_id;
      const filtered = (prev || []).filter(m => (m.id || m.movieId || m.tmdb_id || m._id) !== id);
      return [normalized, ...filtered].slice(0, 10);
    });
    // fetch recommendations immediately for this movie so UI updates without refresh
    try {
      fetchRecsForMovie(normalized);
    } catch (e) {
      // ignore
    }
  };

  // Helper: fetch per-movie recommendations (used by openMovie and selectedMovie effect)
  const fetchRecsForMovie = async (mv) => {
    if (!mv) return;
    const API_BASE = import.meta.env.VITE_API_BASE || '';
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
    let cancelled = false;
    // do not clear existing recommendations while fetching; we'll append if we find results
    try {
      const collected = [];
      const seen = new Set();
      const tmdbId = Number(mv.tmdb_id || mv.id);
      if (!tmdbId || Number.isNaN(tmdbId)) {
        console.warn('[recs] fetchRecsForMovie missing tmdbId for', mv);
        return;
      }
      const watchedLabel = `clicked: ${mv.title || mv.name || ''}`;

      if (API_BASE) {
        try {
          const titleParam = encodeURIComponent(mv.title || mv.name || '');
          const res = await fetch(`${API_BASE}/api/recommendations/${tmdbId}?limit=24&title=${titleParam}`);
          const json = await res.json();
          console.debug('[recs] per-movie backend response for', tmdbId, json && json.recommendations ? json.recommendations.length : 0);
          if (json && json.ok && Array.isArray(json.recommendations)) {
            json.recommendations.forEach(r => {
              const id = r.tmdb_id || r.id || r.movieId;
              if (!id || seen.has(String(id))) return;
              seen.add(String(id));
              collected.push({ id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.rating || r.vote_average, original_language: r.original_language, overview: r.overview, sources: ['watched'] });
            });
          }
        } catch (e) {
          // fallback to TMDB
        }
      }

      if (API_KEY && collected.length < 6) {
        try {
          const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
          const d = await r.json();
          console.debug('[recs] per-movie tmdb similar for', tmdbId, (d.results || []).length);
          (d.results || []).slice(0, 24).forEach(item => {
            const id = item.id;
            if (!id || seen.has(String(id))) return;
            seen.add(String(id));
            collected.push({ id, title: item.title, poster_path: item.poster_path, release_date: item.release_date, vote_average: item.vote_average, original_language: item.original_language, overview: item.overview, sources: ['tmdb_similar'] });
          });
        } catch (e) {
          // ignore
        }
      }

      const viewedIds = new Set((sessionViewed || []).map(x => String(x.id || x.movieId || x.tmdb_id || x._id)));
      viewedIds.add(String(tmdbId));

      // Enforce Telugu-only and fallbacks (translations/local/trending)
      let filtered = collected.filter(c => isTeluguCandidate(c)).filter(c => !viewedIds.has(String(c.id)));
      if (filtered.length === 0 && collected.length > 0 && API_KEY) {
        const probe = collected.slice(0, 12);
        try {
          const checks = await Promise.all(probe.map(async (cand) => {
            try {
              const tRes = await fetch(`https://api.themoviedb.org/3/movie/${cand.id}/translations?api_key=${API_KEY}`);
              const tJson = await tRes.json();
              const hasTe = Array.isArray(tJson.translations) && tJson.translations.some(tr => tr.iso_639_1 === 'te' || (tr.english_name && /telugu/i.test(tr.english_name)));
              return hasTe ? cand : null;
            } catch (e) {
              return null;
            }
          }));
          const translated = checks.filter(Boolean).filter(c => !viewedIds.has(String(c.id)));
          if (translated.length > 0) filtered = translated;
        } catch (e) {
          // ignore
        }
      }

      if (filtered.length === 0) {
        const localDubbed = (dubbedMovies || []).filter(d => !viewedIds.has(String(d.id))).slice(0, 12);
        if (localDubbed.length > 0) filtered = localDubbed.map(d => ({ id: d.id, title: d.title, poster_path: d.poster_path, release_date: d.release_date, vote_average: d.vote_average, sources: ['local_dubbed'] }));
      }

      // do not fall back to generic trending picks; we only show Telugu candidates

      if (filtered.length === 0) {
        // no Telugu candidates for this movie; do not clear existing recommendations
        if (!cancelled) setRecommendationReason('No Telugu recommendations available for this movie');
        return;
      }

      const picks = filtered.slice(0, 2).map(r => ({ id: r.id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average, sources: r.sources || [] }));
      if (!cancelled) {
        setSessionRecommendations(prev => {
          const prevArr = Array.isArray(prev) ? [...prev] : [];
          // keep new picks to the left (prepend), preserve their order, and avoid duplicates
          const newOnes = picks.filter(p => !prevArr.some(x => String(x.id) === String(p.id)));
          const combined = [...newOnes, ...prevArr];
          return combined.slice(0, 100);
        });
        setRecommendationReason(`Because you clicked ${mv.title || mv.name}`);
      }
    } catch (err) {
      console.error('fetchRecsForMovie error', err);
    }
  };

  // Persist sessionViewed to sessionStorage and load on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sessionViewed');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setSessionViewed(parsed.slice(0, 10));
      }
    } catch (e) {
      // ignore
    }
    try {
      const rawS = localStorage.getItem('searchHistory');
      if (rawS) {
        const parsedS = JSON.parse(rawS);
        if (Array.isArray(parsedS) && parsedS.length > 0) setSearchHistory(parsedS.slice(0, 20));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('sessionViewed', JSON.stringify(sessionViewed.slice(0, 10)));
    } catch (e) {
      // ignore
    }
    try {
      localStorage.setItem('searchHistory', JSON.stringify(searchHistory.slice(0, 20)));
    } catch (e) {
      // ignore
    }
  }, [sessionViewed, searchHistory]);

  // Build merged recommendations from clicks, searches, or fallback trending
  useEffect(() => {
    // Disabled: per-user request only actual per-click recommendations should be shown (no default/combined auto-fill)
    return; 
  }, [sessionViewed, searchHistory, trending, popular]);

  // Per-movie recommendations: when user clicks a movie, show recs specific to that movie
  useEffect(() => {
    if (!selectedMovie) return;
    let cancelled = false;
    const API_BASE = import.meta.env.VITE_API_BASE || '';
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

    const buildForMovie = async () => {
      try {
        const collected = [];
        const seen = new Set();
        const tmdbId = selectedMovie.tmdb_id || selectedMovie.id;
        if (!tmdbId) return;

        const watchedLabel = `clicked: ${selectedMovie.title || selectedMovie.name || ''}`;

        // try backend precomputed
        if (API_BASE) {
          try {
            const titleParam = encodeURIComponent(selectedMovie.title || selectedMovie.name || '');
            const res = await fetch(`${API_BASE}/api/recommendations/${tmdbId}?limit=24&title=${titleParam}`);
            const json = await res.json();
            console.debug('[recs] per-movie backend response for', tmdbId, json && json.recommendations ? json.recommendations.length : 0);
            if (json && json.ok && Array.isArray(json.recommendations)) {
              json.recommendations.forEach(r => {
                const id = r.tmdb_id || r.id || r.movieId;
                if (!id || seen.has(String(id))) return;
                seen.add(String(id));
                collected.push({ id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.rating || r.vote_average, original_language: r.original_language, overview: r.overview, sources: ['watched'] });
              });
            }
          } catch (e) {
            // fallback to TMDB
          }
        }

        // fallback to TMDB similar
        if (API_KEY && collected.length < 6) {
          try {
            const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
            const d = await r.json();
            console.debug('[recs] per-movie tmdb similar for', tmdbId, (d.results || []).length);
            (d.results || []).slice(0, 24).forEach(item => {
              const id = item.id;
              if (!id || seen.has(String(id))) return;
              seen.add(String(id));
              collected.push({ id, title: item.title, poster_path: item.poster_path, release_date: item.release_date, vote_average: item.vote_average, original_language: item.original_language, overview: item.overview, sources: ['tmdb_similar'] });
            });
          } catch (e) {
            // ignore
          }
        }

        // Exclude the clicked movie and any already-viewed items
        const viewedIds = new Set((sessionViewed || []).map(x => String(x.id || x.movieId || x.tmdb_id || x._id)));
        viewedIds.add(String(tmdbId));

        // Enforce Telugu-only for per-movie recommendations
        let filtered = collected.filter(c => isTeluguCandidate(c)).filter(c => !viewedIds.has(String(c.id)));
        if (filtered.length === 0) {
          // no telugu candidates for this movie — do not clear existing recommendations
          if (!cancelled) {
            setRecommendationReason('No Telugu recommendations available');
          }
          return;
        }

        // Pick up to 2 recommendations for this click and append to existing sessionRecommendations
        const picks = filtered.slice(0, 2).map(r => ({ id: r.id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average, sources: r.sources }));
        if (!cancelled) {
          console.debug('[recs] per-movie picks=', picks.map(p => p.id), 'for', tmdbId);
          setSessionRecommendations(prev => {
            const prevArr = Array.isArray(prev) ? [...prev] : [];
            const newOnes = picks.filter(p => !prevArr.some(x => String(x.id) === String(p.id)));
            const combined = [...newOnes, ...prevArr];
            return combined.slice(0, 100);
          });
          setRecommendationReason(`Because you clicked ${selectedMovie.title || selectedMovie.name}`);
        }
      } catch (err) {
        console.error('Error building per-movie recommendations', err);
      }
    };

    buildForMovie();
    return () => { cancelled = true; };
  }, [selectedMovie]);
  const [dubbedMovies, setDubbedMovies] = useState([]);
  const [genres, setGenres] = useState({});
  const [activeGenre, setActiveGenre] = useState(null);
  const [genreMovies, setGenreMovies] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false); // when true, genre effect should not auto-run


  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
        const BASE_URL = 'https://api.themoviedb.org/3';
        
        // (image helper removed — not used)

        const fetchGenres = async () => {
        try {
          const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en`);
          const data = await response.json();
          
          // Create a map of genre IDs to names
          const genreMap = {};
          data.genres?.forEach(genre => {
            genreMap[genre.id] = genre.name;
          });
          setGenres(genreMap);
        } catch (error) {
          console.error('Error fetching genres:', error);
        }
      };

      // Call fetchGenres
      await fetchGenres();


        // Function to fetch Telugu movies with fallback
        const fetchTeluguMovies = async (url) => {
          try {
            const response = await fetch(url);
            const data = await response.json();
            
            // Filter movies that are either:
            // 1. Original Telugu (original_language === 'te')
            // 2. OR have Telugu as an available language
            const teluguMovies = data.results?.filter(movie => {
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
            }) || [];
            if (teluguMovies.length <= 15) {
              return teluguMovies;
            }

            // Deterministic selection: pick top 15 from the results (stable by TMDB ordering)
            return teluguMovies.slice(0, 15);
            
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
          fetchTeluguMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=primary_release_date.desc&primary_release_date.lte=${new Date().toISOString().split('T')[0]}&page=1`),
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
    // const dubbedMovies = uniqueMovies.slice(0, 15).map(movie => ({
    //   ...movie,
    //   title: `${movie.title}`,
    //   vote_average: movie.vote_average || 6.0, // Default rating if not available
    //   backdrop_path: movie.backdrop_path || movie.poster_path, // Use poster as backup
    // }));

    
    // console.log('Processed dubbed movies:', dubbedMovies);
    
    // If we still don't have enough movies, add hardcoded ones
    // if (dubbedMovies.length < 5) {
    //   const hardcoded = getHardcodedDubbedMovies();
    //   // Add only new movies (by ID)
    //   hardcoded.forEach(movie => {
    //     if (!dubbedMovies.some(m => m.id === movie.id)) {
    //       dubbedMovies.push(movie);
    //     }
    //   });
    // }
    
    // return dubbedMovies.slice(0, 15);
     if (uniqueMovies.length <= 15) {
      // Add dubbed indicator and return all
      const dubbedMovies = uniqueMovies.map(movie => ({
        ...movie,
        title: `${movie.title} (తెలుగు డబ్బింగ్)`,
        vote_average: movie.vote_average || 6.0,
        backdrop_path: movie.backdrop_path || movie.poster_path,
      }));
      return dubbedMovies;
    }
    
    // Get random 15 movies from unique movies
    const randomMovies = [];
    const availableIndices = [...Array(uniqueMovies.length).keys()];
    
    // Shuffle the indices
    for (let i = availableIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
    }
    
    // Take first 15 random indices
    const selectedIndices = availableIndices.slice(0, 15);
    
    // Get movies at those random indices and add dubbed indicator
    selectedIndices.forEach(index => {
      const movie = uniqueMovies[index];
      randomMovies.push({
        ...movie,
        title: `${movie.title}`,
        vote_average: movie.vote_average || 6.0,
        backdrop_path: movie.backdrop_path || movie.poster_path,
      });
    });
    
    return randomMovies;
    
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

  // When a genre is selected from the menu, fetch movies for that genre
  useEffect(() => {
    if (!activeGenre) return;
    if (searchMode) return; // when showing direct search results, skip genre auto-fetch
    let cancelled = false;

    const fetchGenreMovies = async () => {
      try {
        setGenreLoading(true);
        const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
        const BASE_URL = 'https://api.themoviedb.org/3';

        // Map UI labels to TMDB genre names when they differ
        const nameMap = {
          'Sci-Fi': 'Science Fiction'
        };
        const desiredName = nameMap[activeGenre] || activeGenre;

        // helper to slugify names for fuzzy matching
        const slugify = (s = '') => s.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Ensure we have genres; fetch if missing
        let localGenres = genres && Object.keys(genres).length > 0 ? genres : {};
        if (!localGenres || Object.keys(localGenres).length === 0) {
          try {
            const gRes = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en`);
            const gData = await gRes.json();
            const fetched = {};
            gData.genres?.forEach(g => { fetched[g.id] = g.name; });
            localGenres = fetched;
            setGenres(fetched);
          } catch (e) {
            console.warn('Could not fetch genres fallback:', e);
          }
        }

        let genreId = Object.keys(localGenres).find(id => localGenres[id] && localGenres[id].toLowerCase() === desiredName.toLowerCase());
        if (!genreId) {
          genreId = Object.keys(localGenres).find(id => slugify(localGenres[id]) === slugify(desiredName));
        }

        let collected = [];
        let page = 1;
        // Request only original Telugu movies from TMDB for the selected genre
        if (genreId) {
          while (collected.length < 60 && page <= 5) {
            const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&with_original_language=te&page=${page}&sort_by=popularity.desc`);
            const data = await res.json();
            if (!data.results || data.results.length === 0) break;
            collected.push(...data.results);
            page += 1;
          }
        } else {
          // Fallback: search movies by genre name + 'Telugu'
          const q = encodeURIComponent(`${desiredName} Telugu`);
          const sRes = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${q}&page=1`);
          const sData = await sRes.json();
          if (sData.results && sData.results.length > 0) collected.push(...sData.results);
        }

        // collected should already be Telugu originals; as a safety filter, ensure original_language === 'te'
        const teluguOnly = collected.filter(m => m && m.original_language === 'te');
        const finalList = teluguOnly.length > 0 ? teluguOnly : collected;

        if (!cancelled) setGenreMovies(finalList.slice(0, Math.min(60, finalList.length)));
      } catch (err) {
        console.error('Error fetching genre movies:', err);
        if (!cancelled) setGenreMovies([]);
      } finally {
        if (!cancelled) setGenreLoading(false);
      }
    };

    fetchGenreMovies();

    return () => { cancelled = true; };
  }, [activeGenre, genres]);

  

  // (Legacy example fetch removed — replaced by active fetchMovies implementation above)

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        onSelectGenre={(label) => {
          const slug = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
          setSearchMode(false);
          setActiveGenre(label);
          navigate(`/genre/${slug}`);
        }}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={(q) => {
          try {
            setSearchHistory(prev => {
              const cleaned = (prev || []).filter(s => s && s.toLowerCase() !== (q || '').toLowerCase());
              return [...cleaned, q].slice(-20);
            });
          } catch (e) {
            // ignore
          }
          if (!q || q.trim().length === 0) return;
          setSearchOpen(false);
          navigate(`/search?q=${encodeURIComponent(q)}`);
        }}
      />
      {!activeGenre && (
        <HeroCarousel 
          movies={popular} 
          selectedMovie={selectedMovie} 
          setSelectedMovie={(m) => openMovie(m)}
        />
      )}
      
      <div className={`movie-rows-container ${activeGenre ? 'genre-active' : ''} ${searchMode ? 'search-active' : ''} ${(!activeGenre && !searchMode) ? 'hero-active' : ''}`}>
        {activeGenre ? (
          <GenreView
            genre={activeGenre}
            movies={genreMovies}
            loading={genreLoading}
            onMovieClick={openMovie}
            onClear={() => setActiveGenre(null)}
            searchMode={searchMode}
          />
        ) : (
        <>
          {/* Recommendations header and debug controls removed per request */}
          {Array.isArray(sessionRecommendations) && sessionRecommendations.length > 0 && (
            <MovieRow title="Recommended movies" movies={sessionRecommendations} onMovieClick={openMovie} />
          )}
          {Array.isArray(promotedRows) && promotedRows.length > 0 && promotedRows.map((p, idx) => (
            <MovieRow key={`promoted-${idx}`} title={p.title || `Because you liked`} movies={(p.recs || p.recommendations || []).map(r => ({ id: r.tmdb_id || r.id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average }))} onMovieClick={openMovie} />
          ))}
          {/* Debug dump removed */}
          <MovieRow title="Coming Soon" movies={upcoming} onMovieClick={openMovie} />
          <MovieRow title="Now Playing" movies={nowPlaying} onMovieClick={openMovie} />
          <MovieRow title="Trending Now" movies={trending} onMovieClick={openMovie} />
          <MovieRow title="Popular" movies={popular} onMovieClick={openMovie} />
          <MovieRow title="Top Rated Movies" movies={topRated} onMovieClick={openMovie} />
          <MovieRow title="Dubbed Movies" movies={dubbedMovies} onMovieClick={openMovie} />
        </>
        )}

      </div>
      {selectedMovie && (
        <MovieDetailModal 
          movie={selectedMovie} 
          onClose={() => setSelectedMovie(null)} 
          setSelectedMovie={openMovie}
          genres={genres}
          nowPlaying={nowPlaying}
          upcoming={upcoming}
        />
      )}
    </div>
  );
}



