import { useState, useEffect, useRef, StrictMode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { Search, User, Menu, X, ChevronLeft, ChevronRight, Play, Star, Share2, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import './dashboard.css';

// Main App Component
export default function Dashboard() {
  const navigate = useNavigate();
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
        
        // Helper function to get image URL
        const getImageUrl = (path, size = 'w500') => {
          if (!path) return '';
          return `https://image.tmdb.org/t/p/${size}${path}`;
        };

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

  function GenreView({ genre, movies, loading, onMovieClick, onClear }) {
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
                  {movie.isDubbed ? (
                    <DubbedMovieCard movie={movie} onClick={onMovieClick} />
                  ) : (
                    <MovieCard movie={movie} onClick={onMovieClick} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

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
      <Header
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        onSelectGenre={(label) => {
          const slug = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
          setSearchMode(false);
          setActiveGenre(label);
          navigate(`/dashboard#${slug}`);
        }}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={async (q) => {
          // record search to history for recommendations
          try {
            setSearchHistory(prev => {
              const cleaned = (prev || []).filter(s => s && s.toLowerCase() !== (q || '').toLowerCase());
              return [...cleaned, q].slice(-20);
            });
          } catch (e) {
            // ignore
          }
          // perform search: try genre, then person (actor), then movie search
          const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
          const BASE_URL = 'https://api.themoviedb.org/3';
          const slugify = (s = '') => s.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

          if (!q || q.trim().length === 0) return;
          setSearchMode(true);
          setGenreLoading(true);
          setActiveGenre(`Search: ${q}`);

          // 1) Genre match
          const qSlug = slugify(q);
          const matchedGenreId = Object.keys(genres || {}).find(id => slugify(genres[id]) === qSlug || genres[id]?.toLowerCase() === q.toLowerCase());
          if (matchedGenreId) {
            // fetch discover by genre limited to Telugu
            const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${matchedGenreId}&with_original_language=te&page=1&sort_by=popularity.desc`);
            const data = await res.json();
            setGenreMovies((data.results || []).slice(0, 60));
            setGenreLoading(false);
            return;
          }

          // Expanded search: movies + people (cast & crew) + production companies
          try {
            const collected = [];
            const seenIds = new Set();
            const lowerQ = q.toLowerCase();

            // Helper to detect dubbed candidates
            const isDubbedCandidate = (m = {}) => {
              if (!m) return false;
              // If original language is Telugu, it's not dubbed
              if (m.original_language === 'te') return false;
              const text = `${m.title || ''} ${m.original_title || ''} ${m.overview || ''}`.toLowerCase();
              if (/telugu|dubbed|డబ్బ/i.test(text)) return true;
              return false;
            };

            // A) Movie search (title, overview)
            try {
              const mRes = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
              const mData = await mRes.json();
              (mData.results || []).forEach(m => { if (m && m.id && !seenIds.has(m.id)) { seenIds.add(m.id); collected.push({...m, isDubbed: isDubbedCandidate(m)}); } });
            } catch (e) {
              console.warn('movie search failed', e);
            }

            // B) Person search -> include cast + crew credits (director/producer/composer/etc.)
            try {
              const pRes = await fetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
              const pData = await pRes.json();
              const persons = (pData.results || []).slice(0, 5);
              await Promise.all(persons.map(async (person) => {
                try {
                  const creditsRes = await fetch(`${BASE_URL}/person/${person.id}/movie_credits?api_key=${API_KEY}`);
                  const creditsData = await creditsRes.json();
                  const moviesFromPerson = [...(creditsData.cast || []), ...(creditsData.crew || [])];
                  moviesFromPerson.forEach(m => { if (m && m.id && !seenIds.has(m.id)) { seenIds.add(m.id); collected.push({...m, isDubbed: isDubbedCandidate(m)}); } });
                } catch (err) {
                  console.warn('person credits failed', err);
                }
              }));
            } catch (e) {
              console.warn('person search failed', e);
            }

            // C) Company search -> discover by company (production house)
            try {
              const cRes = await fetch(`${BASE_URL}/search/company?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
              const cData = await cRes.json();
              const companies = (cData.results || []).slice(0, 3);
              await Promise.all(companies.map(async (comp) => {
                try {
                  const discRes = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_companies=${comp.id}&page=1&sort_by=popularity.desc`);
                  const discData = await discRes.json();
                  (discData.results || []).forEach(m => { if (m && m.id && !seenIds.has(m.id)) { seenIds.add(m.id); collected.push({...m, isDubbed: isDubbedCandidate(m)}); } });
                } catch (err) {
                  console.warn('company discover failed', err);
                }
              }));
            } catch (e) {
              console.warn('company search failed', e);
            }

            // Score & sort results to prefer closer matches (title > overview > popularity)
            const scoreFor = (m) => {
              let score = 0;
              const t = (m.title || '').toLowerCase();
              const o = (m.overview || '').toLowerCase();
              if (t.includes(lowerQ)) score += 50;
              if (o.includes(lowerQ)) score += 30;
              if ((m.original_title || '').toLowerCase().includes(lowerQ)) score += 20;
              score += (m.popularity || 0) * 0.01;
              return score;
            };

            // Also try searching explicitly for Telugu originals matching the query
            try {
              const tRes = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q + ' Telugu')}&page=1`);
              const tData = await tRes.json();
              (tData.results || []).forEach(m => {
                if (m && m.id && !seenIds.has(m.id)) {
                  // prefer originals only
                  if (m.original_language === 'te') {
                    seenIds.add(m.id);
                    collected.push({...m, isDubbed: false});
                  }
                }
              });
            } catch (err) {
              /* ignore */
            }

            // Score & dedupe
            const unique = collected.slice();
            unique.sort((a, b) => scoreFor(b) - scoreFor(a));

            // Mark items as dubbed if they appear in the global `dubbedMovies` list
            try {
              const dubbedIds = new Set((dubbedMovies || []).map(d => d.id));
              unique.forEach((m) => {
                if (!m) return;
                if (m.isDubbed) return;
                if (dubbedIds.has(m.id) && m.original_language !== 'te') {
                  m.isDubbed = true;
                }
              });
            } catch (e) {
              // ignore
            }

            // Keep only Telugu originals or dubbed items
            const onlyTelugu = unique.filter(m => m && (m.original_language === 'te' || m.isDubbed));

            setGenreMovies(onlyTelugu.slice(0, 60));
          } catch (err) {
            console.error('expanded search failed', err);
            setGenreMovies([]);
          } finally {
            setGenreLoading(false);
          }
        }}
      />
      {!activeGenre && (
        <HeroCarousel 
          movies={popular} 
          selectedMovie={selectedMovie} 
          setSelectedMovie={(m) => openMovie(m)}
        />
      )}
      
      <div className={`movie-rows-container ${activeGenre ? 'genre-active' : ''}`}>
        {activeGenre ? (
          <GenreView
            genre={activeGenre}
            movies={genreMovies}
            loading={genreLoading}
            onMovieClick={openMovie}
            onClear={() => setActiveGenre(null)}
          />
        ) : (
        <>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px'}}>
            <h2 className="row-title">Recommendations</h2>
            <div>
              <button className="clear-session-btn" onClick={() => { setSessionViewed([]); setSessionRecommendations([]); sessionStorage.removeItem('sessionViewed'); }}>Clear</button>
              <button style={{marginLeft:8}} className="clear-session-btn" onClick={() => setShowRecDebug(s => !s)}>{showRecDebug ? 'Hide Debug' : 'Show Debug'}</button>
            </div>
          </div>
          {recommendationReason && (
            <div className="recommendation-reason" style={{padding: '0 16px 8px 16px', color: '#ddd', fontSize: 14}}>{recommendationReason}</div>
          )}
          {Array.isArray(sessionRecommendations) && sessionRecommendations.length > 0 && (
            <MovieRow title="Recommended movies" movies={sessionRecommendations} onMovieClick={openMovie} />
          )}
          {Array.isArray(promotedRows) && promotedRows.length > 0 && promotedRows.map((p, idx) => (
            <MovieRow key={`promoted-${idx}`} title={p.title || `Because you liked`} movies={(p.recs || p.recommendations || []).map(r => ({ id: r.tmdb_id || r.id, title: r.title, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average }))} onMovieClick={openMovie} />
          ))}
          {showRecDebug && (
            <div style={{padding:16, color:'#ccc', fontSize:12}}>
              <div>Raw sessionRecommendations:</div>
              <pre style={{maxHeight:200, overflow:'auto'}}>{JSON.stringify(sessionRecommendations, null, 2)}</pre>
            </div>
          )}
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

// Header Component
function Header({ isMenuOpen, setIsMenuOpen, onSelectGenre, searchOpen, setSearchOpen, searchQuery, setSearchQuery, onSearchSubmit }) {
  const navItems = [
    { label: 'Comedy', href: '/genre/comedy' },
    { label: 'Romance', href: '/genre/romance' },
    { label: 'Thriller', href: '/genre/thriller' },
    { label: 'Horror', href: '/genre/horror' },
    { label: 'Action', href: '/genre/action' },
    { label: 'Drama', href: '/genre/drama' },
    { label: 'Sci-Fi', href: '/genre/sci-fi' },
    { label: 'Fantasy', href: '/genre/fantasy' },
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
            {searchOpen ? (
              <div className="search-box">
                <input
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search genre, actor or movie"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = (searchQuery || '').trim();
                      if (!q) return;
                      if (typeof onSearchSubmit === 'function') onSearchSubmit(q);
                      setSearchOpen(false);
                    }
                  }}
                />
                <button
                  className="search-submit"
                  onClick={() => {
                    const q = (searchQuery || '').trim();
                    if (!q) return;
                    if (typeof onSearchSubmit === 'function') onSearchSubmit(q);
                    setSearchOpen(false);
                  }}
                >
                  Search
                </button>
                <button className="search-close" onClick={() => setSearchOpen(false)}>X</button>
              </div>
            ) : (
              <button className="search-btn" onClick={() => setSearchOpen(true)}>
                <Search size={20} />
              </button>
            )}
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
                <button
                  key={item.label}
                  type="button"
                  className="mobile-nav-item"
                  onClick={() => { if (typeof onSelectGenre === 'function') onSelectGenre(item.label); setIsMenuOpen(false); }}
                >
                  {item.label}
                </button>
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


function MovieDetailModal({ movie, onClose, genres, setSelectedMovie, nowPlaying = [], upcoming = [] }) {
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
    if (!movie.genre_ids || movie.genre_ids.length === 0) {
      return 'Not specified';
    }
    
    const genreNames = movie.genre_ids
      .map(id => genres[id])
      .filter(name => name)
      .join(', ');
    
    return genreNames || 'Not specified';
  };
    const [providers, setProviders] = useState(null);
    const [modalRecs, setModalRecs] = useState([]);
    const [modalRecsLoading, setModalRecsLoading] = useState(false);
    const [heroSrc, setHeroSrc] = useState(null);
    const [modalOverview, setModalOverview] = useState(movie && movie.overview ? movie.overview : '');

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

          // Prefer India results, then US, then the first available
          const chosen = results['IN'] || results['US'] || results[Object.keys(results)[0]] || null;
          if (!cancelled) setProviders(chosen);
        } catch (err) {
          console.error('Error fetching providers:', err);
          if (!cancelled) setProviders(null);
        }
      };

      fetchProviders();

      // Resolve hero image: prefer movie.backdrop_path, otherwise fetch best backdrop from TMDB images
      (async () => {
        try {
          const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
          const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
          if (movie && movie.backdrop_path) {
            setHeroSrc(`${IMAGE_BASE_URL}/original${movie.backdrop_path}`);
            return;
          }
          // if no backdrop on movie object, try TMDB images endpoint
          if (!API_KEY || !movie || !movie.id) { setHeroSrc(null); return; }

          const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${API_KEY}`);
          const j = await res.json();
          if (!j) { setHeroSrc(null); return; }

          // choose best backdrop by vote_count + vote_average heuristic
          const pickBest = (arr = []) => {
            if (!Array.isArray(arr) || arr.length === 0) return null;
            return arr.reduce((best, cur) => {
              const curScore = (cur.vote_count || 0) + (cur.vote_average || 0) * 10;
              const bestScore = best ? ((best.vote_count || 0) + (best.vote_average || 0) * 10) : 0;
              return curScore > bestScore ? cur : best;
            }, arr[0]);
          };

          const bestBackdrop = pickBest(j.backdrops || []);
          if (bestBackdrop && bestBackdrop.file_path) {
            setHeroSrc(`${IMAGE_BASE_URL}/original${bestBackdrop.file_path}`);
            return;
          }

          // fallback: if no backdrop, try posters
          const bestPoster = pickBest(j.posters || []);
          if (bestPoster && bestPoster.file_path) {
            setHeroSrc(`${IMAGE_BASE_URL}/original${bestPoster.file_path}`);
            return;
          }

          setHeroSrc(null);
        } catch (err) {
          console.warn('Error resolving hero image', err);
          setHeroSrc(null);
        }
      })();

      // Fetch overview fallback if missing
      (async () => {
        try {
          const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
          const BASE_URL = 'https://api.themoviedb.org/3';
          if ((!movie.overview || movie.overview.trim() === '') && API_KEY && movie && movie.id) {
            try {
              const detRes = await fetch(`${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}`);
              const detJson = await detRes.json();
              if (detJson && detJson.overview) setModalOverview(detJson.overview);
            } catch (err) {
              console.warn('Could not fetch movie details for overview fallback', err);
            }
          } else {
            // ensure modalOverview reflects movie prop when present
            setModalOverview(movie && movie.overview ? movie.overview : '');
          }
        } catch (err) {
          // ignore
        }
      })();

      // fetch 4-6 recommendations for this movie to show in modal
      const fetchModalRecs = async () => {
        try {
          setModalRecsLoading(true);
          const API_BASE = import.meta.env.VITE_API_BASE || '';
          const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
          const tmdbId = movie.id || movie.tmdb_id;
          if (!tmdbId) return;

          // Try backend first (uses backend/app.py -> /api/recommendations/<movie>)
          if (API_BASE) {
            try {
              const titleParam = encodeURIComponent(movie.title || movie.name || '');
              const res = await fetch(`${API_BASE}/api/recommendations/${tmdbId}?limit=5&title=${titleParam}`);
              const j = await res.json();
              if (j && j.ok && Array.isArray(j.recommendations) && j.recommendations.length > 0) {
                // keep only Telugu originals or likely dubbed items
                const telugu = j.recommendations.filter(r => {
                  const lang = r.original_language || '';
                  const text = `${r.title || ''} ${r.overview || ''}`;
                  return lang === 'te' || /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text);
                }).slice(0,5).map(r => ({ id: r.tmdb_id || r.id, title: r.title || r.name, poster_path: r.poster_path, release_date: r.release_date, vote_average: r.vote_average }));
                if (telugu.length > 0) {
                  setModalRecs(telugu);
                  return;
                }
              }
            } catch (e) {
              // fall through to TMDB fallback
            }
          }

          // Fallback: TMDB similar
          if (API_KEY) {
            try {
              const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
              const d = await r.json();
              if (d && Array.isArray(d.results)) {
                const tel = d.results.filter(item => {
                  const lang = item.original_language || '';
                  const text = `${item.title || ''} ${item.overview || ''}`;
                  return lang === 'te' || /telugu|డబ్బ|డబ్బింగ్|dubbed/i.test(text);
                }).slice(0,5).map(item => ({ id: item.id, title: item.title, poster_path: item.poster_path, release_date: item.release_date, vote_average: item.vote_average }));
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

    

    const isComingSoon = (() => {
      if (!movie || !movie.release_date) return false;
      try {
        const rel = new Date(movie.release_date);
        return rel > new Date();
      } catch (e) {
        return false;
      }
    })();

    // Determine if this movie is currently in the "Now Playing" row
    const isNowPlayingMovie = (() => {
      try {
        const mid = String(movie && (movie.id || movie.tmdb_id || movie._id || ''));
        if (!mid) return false;
        return (nowPlaying || []).some(m => String(m && (m.id || m.tmdb_id || m._id || '')) === mid);
      } catch (e) {
        return false;
      }
    })();

    return (
      <div className="modal-overlay">
        <div className="modal-backdrop" onClick={onClose} />

        <div className="modal">
          <button className="modal-close" onClick={onClose}>
            <X size={22} />
          </button>

          {/* HERO */}
          <div className="modal-hero">
            {heroSrc && (
              <img
                src={heroSrc}
                alt={movie.title}
                className="modal-hero-image"
              />
            )}

            <div className="modal-hero-overlay" />

            <div className="modal-hero-content">
              <h2 className="modal-title">{movie.title}</h2>
            </div>
          </div>

          {/* CONTENT */}
          <div className="modal-content">
            <p className="modal-description">{(modalOverview && modalOverview.trim()) ? modalOverview : (movie.overview || 'Overview not available.')}</p>

            <div className="modal-details">
              <div className="details-grid">
                <div>
                  <p className="detail-label">Rating</p>
                  <p className="detail-value">
                    {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10
                  </p>
                </div>

                <div>
                  <p className="detail-label">Release Date</p>
                  <p className="detail-value">
                    {formatDate(movie.release_date)}
                  </p>
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
                {/* TMDB link removed per request */}

                <div className="providers-sections">
                  {providers.flatrate && providers.flatrate.length > 0 && (
                    <div className="providers-section">
                      <h4>Streaming</h4>
                      <div className="provider-list">
                        {providers.flatrate.map(p => (
                          <div key={`f-${p.provider_id}`} className="provider-item">
                            <span>{p.provider_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {providers.rent && providers.rent.length > 0 && (
                    <div className="providers-section">
                      <h4>Rent</h4>
                      <div className="provider-list">
                        {providers.rent.map(p => (
                          <div key={`r-${p.provider_id}`} className="provider-item">
                            <span>{p.provider_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {providers.buy && providers.buy.length > 0 && (
                    <div className="providers-section">
                      <h4>Buy</h4>
                      <div className="provider-list">
                        {providers.buy.map(p => (
                          <div key={`b-${p.provider_id}`} className="provider-item">
                            <span>{p.provider_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal recommendations */}
            {modalRecs && modalRecs.length > 0 && !isNowPlayingMovie && !isComingSoon && (
              <div style={{padding: '16px'}}>
                <h3 style={{margin: '8px 0'}}>You can also watch</h3>
                <MovieRow title="" movies={modalRecs} onMovieClick={(m) => { if (typeof setSelectedMovie === 'function') setSelectedMovie(m); }} />
              </div>
            )}

            
          </div>
        </div>
      </div>
    );
}

