import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import Header from '../components/Header';
import MovieCard from '../Dashboard/components/MovieCard';
import DubbedMovieCard from '../Dashboard/components/DubbedMovieCard';
import MovieDetailModal from '../Dashboard/components/MovieDetailModal';
import './search.css';

export default function Search() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState([]);
  const [titleResults, setTitleResults] = useState([]);
  const [directorResults, setDirectorResults] = useState([]);
  const [genreResults, setGenreResults] = useState([]);
  const [genreSections, setGenreSections] = useState([]);
  const [overviewResults, setOverviewResults] = useState([]);
  const [castResults, setCastResults] = useState([]);
  const [leadResults, setLeadResults] = useState([]);
  const [actorsResults, setActorsResults] = useState([]);
  const [producerResults, setProducerResults] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [genresMap, setGenresMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!q || q.trim().length === 0) {
      setMovies([]);
      return;
    }

    let cancelled = false;
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
    const BASE_URL = 'https://api.themoviedb.org/3';

    // Simple in-memory cache + inflight coalescing for TMDB requests to reduce 429s
    const _tmdbCache = new Map();
    const _tmdbInflight = new Map();
    const cachedFetch = async (url, opts = {}, ttl = 5 * 60 * 1000) => {
      try {
        if (_tmdbCache.has(url)) {
          const { ts, data } = _tmdbCache.get(url);
          if (Date.now() - ts < ttl) {
            return { ok: true, status: 200, json: async () => data };
          }
        }
        if (_tmdbInflight.has(url)) return await _tmdbInflight.get(url);
        const p = (async () => {
          const res = await fetch(url, opts);
          let data = null;
          try { data = await res.json(); } catch (e) { data = null; }
          if (res && res.ok) _tmdbCache.set(url, { ts: Date.now(), data });
          _tmdbInflight.delete(url);
          return { ok: res && res.ok, status: res ? res.status : 0, json: async () => data };
        })();
        _tmdbInflight.set(url, p);
        return await p;
      } catch (e) {
        return { ok: false, status: 0, json: async () => null };
      }
    };

    const isDubbedCandidate = (m = {}) => {
      if (!m) return false;
      if (m.original_language === 'te') return false;
      const text = `${m.title || ''} ${m.original_title || ''} ${m.overview || ''} ${m.tagline || ''}`.toLowerCase();
      return /telugu|dubbed|డబ్బ/i.test(text);
    };

    const runSearch = async () => {
      setLoading(true);
      const ALLOW_FALLBACKS = false;
      try {
        // Ensure genres map — keep a local copy so we can use it immediately
        let localGenres = genresMap || {};
        try {
          const gRes = await cachedFetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`);
          const gJson = await gRes.json();
          const gmap = {};
          (gJson.genres || []).forEach(g => { gmap[g.id] = g.name; });
          localGenres = gmap;
          if (!cancelled) setGenresMap(gmap);
        } catch (e) {
          // ignore
        }

        const seen = new Set();

        // Helper: check TMDB translations for Telugu for items missing explicit dub markers
        const checkTranslationsForTelugu = async (items = []) => {
          if (!Array.isArray(items) || items.length === 0) return items;
          return await Promise.all(items.map(async (it) => {
            try {
              if (!it || !it.id) return it;
              if (it.original_language === 'te') return it;
              if (it.isDubbed) return it;
              const tRes = await cachedFetch(`${BASE_URL}/movie/${it.id}/translations?api_key=${API_KEY}`);
              const tJson = await tRes.json();
              const hasTe = Array.isArray(tJson.translations) && tJson.translations.some(tr => tr.iso_639_1 === 'te' || (tr.english_name && /telugu/i.test(tr.english_name)));
              if (hasTe) return { ...it, isDubbed: true };
              return it;
            } catch (e) {
              return it;
            }
          }));
        };

        // Helper: normalize and fuzzy-match titles for better accuracy
        const normalize = (s = '') => s.toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const tokens = (s = '') => normalize(s).split(' ').filter(Boolean);
        const jaccard = (a = [], b = []) => {
          const A = new Set(a);
          const B = new Set(b);
          if (A.size === 0 && B.size === 0) return 0;
          let inter = 0;
          A.forEach(x => { if (B.has(x)) inter += 1; });
          const union = new Set([...A, ...B]).size;
          return union === 0 ? 0 : inter / union;
        };

        // Regex-based matcher: build a case-insensitive Unicode regex that requires
        // all query tokens to appear somewhere in the candidate (unordered lookaheads).
        const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildQueryRegex = (q = '') => {
          const parts = tokens(q || '');
          if (!parts || parts.length === 0) return null;
          // use word-boundary aware lookaheads for each token to allow unordered matching
          const lookaheads = parts.map(p => `(?=.*\\b${escapeRegex(p)}\\b)`).join('');
          try {
            return new RegExp(`^${lookaheads}.*$`, 'iu');
          } catch (e) {
            return null;
          }
        };

        const regexMatchScore = (cand = '', q = '') => {
          if (!cand || !q) return 0;
          const rx = buildQueryRegex(q);
          if (!rx) return 0;
          try {
            return rx.test(cand) ? 0.99 : 0;
          } catch (e) {
            return 0;
          }
        };

        // Partial-token matching: for each query token, consider it matched if any candidate token
        // contains it or vice-versa. Returns fraction of query tokens matched.
        const tokenPartialMatchScore = (cand = '', q = '') => {
          const a = tokens(cand || '');
          const b = tokens(q || '');
          if (!b || b.length === 0) return 0;
          if (!a || a.length === 0) return 0;
          let matched = 0;
          b.forEach(bt => {
            // only consider partial matches for tokens of length >= 2
            if (!bt || bt.length < 2) return;
            for (const at of a) {
              if (!at) continue;
              if (at.includes(bt) || bt.includes(at)) { matched += 1; break; }
              // also accept prefix matches
              if (at.startsWith(bt) || bt.startsWith(at)) { matched += 1; break; }
            }
          });
          return matched / b.length;
        };

        // General text match score combining regex unordered match, partial-token, and Jaccard.
        // Returns 0..1 where higher is better.
        const textMatchScore = (cand = '', q = '') => {
          if (!cand || !q) return 0;
          try {
            const nx = normalize(cand || '');
            const nq = normalize(q || '');
            if (!nq) return 0;
            if (nx === nq) return 1;
            // exact substring matches are strong
            if (nx.includes(nq) || nq.includes(nx)) return 0.95;
            const rxScore = regexMatchScore(nx, q);
            const partial = tokenPartialMatchScore(nx, nq) * 0.98;
            const tokScore = jaccard(tokens(nx), tokens(nq));
            return Math.max(rxScore, partial, tokScore);
          } catch (e) {
            return 0;
          }
        };

        const scoreTitleMatch = (it, q) => {
          if (!it || !q) return 0;
          const nq = normalize(q);
          const qRegex = buildQueryRegex(q);
          const tCandidates = [it.title, it.original_title, it.name, it.tagline].filter(Boolean);
          let best = 0;
          for (const cand of tCandidates) {
            const nc = normalize(cand || '');
            if (!nc) continue;
            if (nc === nq) return 1.0; // exact normalized match
            // regex-based exactish match (all tokens present unordered)
            try {
              if (qRegex && qRegex.test(nc)) return 1.0;
            } catch (e) {
              // ignore regex errors
            }
            if (nc.includes(nq) || nq.includes(nc)) best = Math.max(best, 0.95);
            // prefer any general text match (regex, partial tokens, jaccard)
            best = Math.max(best, textMatchScore(nc, nq));
          }
          return best;
        };

        const rankAndFilter = (items = [], q) => {
          if (!Array.isArray(items)) return [];
          const scored = items.map(it => ({ item: it, score: scoreTitleMatch(it, q) }));
          // keep anything with some overlap (lower threshold since token matches are partial);
          // always include originals in Telugu
          const filtered = scored.filter(s => s.score > 0.08 || (s.item && s.item.original_language === 'te') || textMatchScore((s.item && (s.item.title || s.item.tagline || s.item.overview)) || '', q) > 0.08);
          filtered.sort((a, b) => b.score - a.score);
          return filtered.map(s => s.item);
        };

        // 1) Title-focused results
        const titleRes = await cachedFetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
        const titleJson = await titleRes.json();
        // Use Fuse.js + rankAndFilter to include partial-token matches (including 2-letter tokens)
        let titleCandidates = rankAndFilter(titleJson.results || [], q);
        try {
          const fuseTitles = new Fuse(titleJson.results || [], { keys: ['title', 'original_title', 'tagline', 'overview'], threshold: 0.35, minMatchCharLength: 2 });
          const fRes = fuseTitles.search(q).map(r => r.item);
          // merge fuse results ahead of titleCandidates if not already present
          fRes.forEach(it => { if (!titleCandidates.find(x => x && x.id === it.id)) titleCandidates.unshift(it); });
        } catch (e) {
          // ignore fuse errors
        }
        let titleItems = (titleCandidates || []).map(m => ({ ...m, isDubbed: isDubbedCandidate(m) }));
        // check translations for top results to detect Telugu availability
        titleItems = await checkTranslationsForTelugu(titleItems.slice(0, 48));
        titleItems = titleItems.filter(m => (m.original_language === 'te') || m.isDubbed);

        // Fallback: if no title items found, search popular Telugu originals pages for fuzzy title match (handles punctuation like "Hello!")
        if (ALLOW_FALLBACKS && (titleItems || []).length === 0) {
          try {
            const normQ = (q || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = [];
            const seenIds = new Set();
            // scan several pages of Telugu originals for fuzzy title matches (increase pages if needed)
            for (let p = 1; p <= 10; p++) {
              const discRes = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_original_language=te&sort_by=popularity.desc&page=${p}`);
              const discJson = await discRes.json();
              const items = (discJson.results || []);
              for (const it of items) {
                if (!it || !it.id) continue;
                const titleNorm = (it.title || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                const taglineNorm = (it.tagline || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                // match via general textMatchScore (handles punctuation, numbers, unordered tokens)
                if (textMatchScore((it.title || '') + ' ' + (it.tagline || '') + ' ' + (it.overview || ''), q) > 0.35) {
                  if (!seenIds.has(it.id)) {
                    seenIds.add(it.id);
                    found.push({ ...it, isDubbed: false });
                  }
                }
              }
              if (found.length > 0) break;
            }
            if (found.length > 0) {
              titleItems = found;
            }
          } catch (e) {
            // ignore fallback errors
          }
        }

        if (!cancelled) setTitleResults(titleItems.slice(0, 24));

        // 2) Person -> Director / Actors (improved matching)
        // Fetch multiple pages of person search to capture partial names/aliases
        let personCandidates = [];
        try {
          // broaden initial person search to more pages to capture less-common matches
          const pages = [1,2,3];
          const responses = await Promise.all(pages.map(pg => cachedFetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=${pg}`)));
          const jsons = await Promise.all(responses.map(r => r.json().catch ? r.json().catch(() => null) : Promise.resolve(null)));
          personCandidates = jsons.flatMap(j => (j && j.results) ? j.results : []);
          console.debug('[Search] personCandidates fetched:', personCandidates.length);
        } catch (e) {
          personCandidates = [];
        }

        // Deduplicate persons
        const uniqPersons = [];
        const seenPersonIds = new Set();
        (personCandidates || []).forEach(p => { if (p && p.id && !seenPersonIds.has(p.id)) { seenPersonIds.add(p.id); uniqPersons.push(p); } });
        console.debug('[Search] uniqPersons:', uniqPersons.length);

        // Score persons by name similarity and aliases (also_known_as)
        const scoredPersons = await Promise.all(uniqPersons.map(async (p) => {
          let score = scoreTitleMatch({ title: p.name }, q);
          try {
            const pdRes = await cachedFetch(`${BASE_URL}/person/${p.id}?api_key=${API_KEY}&language=en-US`);
            const pdJson = await pdRes.json();
            const aliases = pdJson.also_known_as || [];
            aliases.forEach(a => { score = Math.max(score, scoreTitleMatch({ title: a }, q)); });
          } catch (e) {
            // ignore
          }
          return { person: p, score };
        }));

        // Levenshtein distance for normalized similarity (returns 0..1 where 1 is identical)
        const levenshtein = (a = '', b = '') => {
          const s = (a || '').toString();
          const t = (b || '').toString();
          if (s === t) return 1;
          const n = s.length; const m = t.length;
          if (n === 0) return m === 0 ? 1 : 0;
          if (m === 0) return 0;
          const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
          for (let i = 0; i <= n; i++) dp[i][0] = i;
          for (let j = 0; j <= m; j++) dp[0][j] = j;
          for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
              const cost = s[i - 1] === t[j - 1] ? 0 : 1;
              dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
            }
          }
          const dist = dp[n][m];
          const maxLen = Math.max(n, m);
          return maxLen === 0 ? 1 : (1 - dist / maxLen);
        };

        // Build a small Fuse index for person names for fuzzy lookup
        // ensure topPersons exists so fuzzy fallback can set it early
        let topPersons = [];
        let fuzzyBestPerson = null;
        try {
          const fuseForNames = new Fuse(uniqPersons, { keys: ['name'], includeScore: true, threshold: 0.5, minMatchCharLength: 2 });
          const fRes = fuseForNames.search(q || '');
          console.debug('[Search] fuseForNames results:', fRes.length);
          if (fRes && fRes.length > 0) {
            const best = fRes[0];
            const candidate = best.item;
            const fuseScore = (typeof best.score === 'number') ? best.score : 1;
            // compute normalized levenshtein similarity on names
            const sim = levenshtein((candidate.name || '').toLowerCase(), (q || '').toLowerCase());
            console.debug('[Search] fuseBest candidate:', candidate.name, 'fuseScore=', fuseScore, 'levSim=', sim);
            // Decide thresholds: accept if Levenshtein sim >= 0.72 OR Fuse score <= 0.32
            if (sim >= 0.72 || fuseScore <= 0.32) {
              fuzzyBestPerson = candidate;
            }
          }
        } catch (e) {
          // ignore fuzzy errors
        }

        // If we found a strong fuzzy match for a person, collect their credits and prefer those results.
        if (fuzzyBestPerson) {
          try {
            console.debug('[Search] fuzzyBestPerson chosen:', fuzzyBestPerson.name, fuzzyBestPerson.id);
            const creditsRes = await cachedFetch(`${BASE_URL}/person/${fuzzyBestPerson.id}/movie_credits?api_key=${API_KEY}`);
            const creditsJson = await creditsRes.json();
            const castMovies = (creditsJson.cast || []).slice(0, 120);
            console.debug('[Search] fuzzy person castMovies:', castMovies.length);
            const leadC = [];
            const actorsC = [];
            const seenC = new Set();
            castMovies.forEach(cm => {
              if (!cm || !cm.id) return;
              if (seenC.has(cm.id)) return;
              seenC.add(cm.id);
              const enriched = { ...cm, isDubbed: isDubbedCandidate(cm) };
              const order = (typeof cm.order === 'number') ? cm.order : null;
              if (order !== null && order <= 1) leadC.push(enriched); else actorsC.push(enriched);
            });
            // check translations for these movies
            let leadChecked = await checkTranslationsForTelugu(leadC.slice(0, 96));
            let actorsChecked = await checkTranslationsForTelugu(actorsC.slice(0, 192));
            leadChecked = leadChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed))).slice(0, 24);
            actorsChecked = actorsChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed))).slice(0, 48);
            if (!cancelled) {
              setLeadResults(leadChecked);
              setActorsResults(actorsChecked);
              setCastResults([...leadChecked, ...actorsChecked].slice(0, 60));
            }
            // also ensure topPersons includes this person so director flow still works later
            if (!topPersons || topPersons.length === 0) topPersons = [fuzzyBestPerson];
          } catch (e) {
            // ignore
          }
        }

        // Use Fuse.js to improve person ranking (text-indexed fuzzy search)
        try {
          const fusePersons = new Fuse(uniqPersons, { keys: ['name', 'known_for_department'], threshold: 0.35, minMatchCharLength: 2 });
          const fuseResults = fusePersons.search(q).map(r => r.item);
          // boost scores for fuse matches
          scoredPersons.forEach(s => {
            if (fuseResults.find(fp => fp.id === s.person.id)) s.score = Math.max(s.score, 0.6);
          });
        } catch (e) {
          // ignore fuse errors
        }

        scoredPersons.sort((a, b) => b.score - a.score);
        const qLower = (q || '').toLowerCase();
        // include persons whose name contains the query (case-insensitive), prefix/partial token matches, or low score
        topPersons = scoredPersons.filter(s => {
          const name = (s.person && s.person.name) || '';
          if (name.toLowerCase().includes(qLower)) return true;
          if (s.score > 0.03) return true;
          if (tokenPartialMatchScore(name, q) > 0) return true;
          // prefix match on first token
          const nameFirst = (tokens(name)[0] || '').toLowerCase();
          if (nameFirst && qLower && nameFirst.startsWith(qLower)) return true;
          return false;
        }).slice(0, 12).map(s => s.person);
        console.debug('[Search] topPersons:', topPersons.map(p => (p && p.name) || p && p.id));

        // If still empty or query is a single short token, do a direct person search for the token and merge results
        try {
          const singleToken = tokens(q).length === 1 && (q || '').trim().length >= 2;
          if ((!topPersons || topPersons.length === 0) || singleToken) {
            const directRes = await cachedFetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
            const directJson = await directRes.json();
            const direct = (directJson.results || []).filter(p => p && p.id).slice(0, 12);
            const existingIds = new Set(topPersons.map(p => p.id));
            direct.forEach(p => { if (!existingIds.has(p.id)) { existingIds.add(p.id); topPersons.push(p); } });
            topPersons = topPersons.slice(0, 12);
          }
        } catch (e) {
          // ignore direct fetch errors
        }

        // If we didn't find good person matches, try token-by-token fallback searches
        if ((!topPersons || topPersons.length === 0) && (q || '').trim().length > 0) {
          try {
            const qTokens = tokens(q).filter(t => t.length >= 2);
            const extraCandidates = [];
            for (const tk of qTokens) {
              try {
                const r = await cachedFetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(tk)}&page=1`);
                const jr = await r.json();
                (jr.results || []).forEach(x => extraCandidates.push(x));
              } catch (e) { /* ignore token fetch errors */ }
            }
            // merge extraCandidates into uniqPersons (dedupe)
            extraCandidates.forEach(p => { if (p && p.id && !seenPersonIds.has(p.id)) { seenPersonIds.add(p.id); uniqPersons.push(p); } });
            // rescore with aliases
            const rescored = await Promise.all(uniqPersons.map(async (p) => {
              let score = Math.max(scoreTitleMatch({ title: p.name }, q), tokenPartialMatchScore(p.name || '', q) * 0.98);
              try {
                const pdRes = await cachedFetch(`${BASE_URL}/person/${p.id}?api_key=${API_KEY}&language=en-US`);
                const pdJson = await pdRes.json();
                const aliases = pdJson.also_known_as || [];
                aliases.forEach(a => { score = Math.max(score, scoreTitleMatch({ title: a }, q), tokenPartialMatchScore(a || '', q) * 0.98); });
              } catch (e) { /* ignore */ }
              return { person: p, score };
            }));
            rescored.sort((a, b) => b.score - a.score);
            topPersons = rescored.filter(s => s.score > 0.04).slice(0, 12).map(s => s.person);
          } catch (e) {
            // ignore fallback errors
          }
        }

        const directorCollected = [];
        // Prepare cast/producer collectors (also used by fallback person collection)
        const leadCollected = [];
        const actorsCollected = [];
        const producerCollected = [];
        const castSeen = new Set();
        const producerSeen = new Set();

        // If topPersons is empty, run a direct person -> credits fallback to ensure
        // single-token queries (e.g., "samantha") still return relevant movies.
        if (ALLOW_FALLBACKS && (!topPersons || topPersons.length === 0) && (q || '').trim().length > 0) {
          try {
            const directRes2 = await cachedFetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
            const directJson2 = await directRes2.json();
            const directPersons2 = (directJson2.results || []).slice(0, 8);
            await Promise.all(directPersons2.map(async (p) => {
              try {
                const cRes = await cachedFetch(`${BASE_URL}/person/${p.id}/movie_credits?api_key=${API_KEY}`);
                const cJson = await cRes.json();
                const castMovies = (cJson.cast || []).slice(0, 24);
                castMovies.forEach(cm => {
                  if (!cm || !cm.id) return;
                  if (castSeen.has(cm.id)) return;
                  const enriched = { ...cm, isDubbed: isDubbedCandidate(cm) };
                  const order = (typeof cm.order === 'number') ? cm.order : null;
                  castSeen.add(cm.id);
                  if (order !== null && order <= 1) {
                    leadCollected.push(enriched);
                  } else {
                    actorsCollected.push(enriched);
                  }
                });

                const crew = (cJson.crew || []);
                crew.forEach(cr => {
                  if (!cr || !cr.id) return;
                  if (!cr.job) return;
                  if ((cr.job || '').toLowerCase() !== 'producer') return;
                  if (producerSeen.has(cr.id)) return;
                  const enriched = { ...cr, isDubbed: isDubbedCandidate(cr) };
                  producerSeen.add(cr.id);
                  producerCollected.push(enriched);
                });
              } catch (e) { /* ignore per-person errors */ }
            }));
          } catch (e) { /* ignore fallback errors */ }
        }
        
        // For top persons, fetch credits and collect directed movies
        await Promise.all(topPersons.map(async (p) => {
          try {
            const creditsRes = await cachedFetch(`${BASE_URL}/person/${p.id}/movie_credits?api_key=${API_KEY}`);
            const creditsJson = await creditsRes.json();
            const directed = (creditsJson.crew || []).filter(c => (c.job || '').toLowerCase() === 'director');
            directed.forEach(d => {
              if (d && d.id && !seen.has(d.id)) {
                const enriched = { ...d, isDubbed: isDubbedCandidate(d) };
                seen.add(d.id);
                directorCollected.push(enriched);
              }
            });
          } catch (e) { /* ignore person credits errors */ }
        }));
        // check translations for director-collected movies so dubbed releases are detected
        let directorChecked = await checkTranslationsForTelugu(directorCollected.slice(0, 96));
        directorChecked = directorChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed)));
        if (!cancelled) setDirectorResults(directorChecked.slice(0, 24));

        // 3) Genre: attempt to find one or more matching genres and fetch Telugu movies per genre
        let genreCollected = [];
        const genreSectionsLocal = [];
        try {
          const lowerQ = q.toLowerCase();
          // Find genres whose names contain the query or vice-versa
          const matches = Object.keys(localGenres || {}).filter(id => {
            const name = (localGenres[id] || '');
            // use partial-token score for genre matching as well
            const partialScore = tokenPartialMatchScore(name, q);
            const lname = name.toLowerCase();
            return partialScore > 0 || lname.includes(lowerQ) || lowerQ.split(' ').some(w => lname.includes(w));
          });

          if (matches.length > 0) {
            // For each matched genre, fetch discover movies (Telugu originals) limited to 12
            await Promise.all(matches.map(async (gId) => {
              try {
                const discRes = await cachedFetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${gId}&with_original_language=te&page=1&sort_by=popularity.desc`);
                const discJson = await discRes.json();
                let items = (discJson.results || []).map(m => ({ ...m, isDubbed: isDubbedCandidate(m) }));
                // check translations for these genre items too
                items = await checkTranslationsForTelugu(items.slice(0, 48));
                const filtered = items.filter(m => (m.original_language === 'te') || m.isDubbed).slice(0, 12);
                if (filtered.length > 0) {
                  genreSectionsLocal.push({ genreId: gId, genreName: genresMap[gId], movies: filtered });
                  genreCollected.push(...filtered);
                }
              } catch (e) {
                // ignore per-genre errors
              }
            }));
          }

          // Fallback: if no genre matches or empty results, do a search with 'Telugu' appended
          if (ALLOW_FALLBACKS && genreSectionsLocal.length === 0) {
            const gSearchRes = await cachedFetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q + ' Telugu')}&page=1`);
            const gSearchJson = await gSearchRes.json();
            genreCollected = (gSearchJson.results || []).map(m => ({ ...m, isDubbed: isDubbedCandidate(m) }));
            genreCollected = await checkTranslationsForTelugu(genreCollected.slice(0, 96));
            genreCollected = genreCollected.filter(m => (m.original_language === 'te') || m.isDubbed).slice(0, 24);
            if (genreCollected.length > 0) {
              genreSectionsLocal.push({ genreId: null, genreName: `Related to genre: ${q}`, movies: genreCollected.slice(0,12) });
            }
          }
        } catch (e) { genreCollected = []; }
        if (!cancelled) {
          setGenreResults(genreCollected.slice(0, 24));
          setGenreSections(genreSectionsLocal);
        }

        // 4) Overview matches: filter title search to items where overview contains query
        // broaden overview matching to include partial-token matches within overview text
        const overviewItems = titleItems.filter(m => {
          const combined = (m.overview || '') + ' ' + (m.tagline || '');
          const titleLower = (m.title || '').toLowerCase();
          if (textMatchScore(m.title || '', q) > 0.9) return false;
          // accept if overview/tagline contains partial/token matches
          try {
            return textMatchScore(combined, q) > 0.25;
          } catch (e) {
            return false;
          }
        });
        if (!cancelled) setOverviewResults(overviewItems.slice(0, 24));

        // 5) Cast & Production: for top persons, split into lead actors (hero/heroine), other actors, and producers
        // (Also merge any fallback-collected cast/producer items from direct-person fallback.)
        // Note: topPersons credits were already fetched for directors above; now fetch cast/crew.
        await Promise.all(topPersons.map(async (p) => {
          try {
            const cRes = await cachedFetch(`${BASE_URL}/person/${p.id}/movie_credits?api_key=${API_KEY}`);
            const cJson = await cRes.json();
            const castMovies = (cJson.cast || []).slice(0, 24);
            castMovies.forEach(cm => {
              if (!cm || !cm.id) return;
              if (castSeen.has(cm.id)) return;
              const enriched = { ...cm, isDubbed: isDubbedCandidate(cm) };
              const order = (typeof cm.order === 'number') ? cm.order : null;
              castSeen.add(cm.id);
              if (order !== null && order <= 1) {
                leadCollected.push(enriched);
              } else {
                actorsCollected.push(enriched);
              }
            });

            // collect producer credits from crew
            const crew = (cJson.crew || []);
            crew.forEach(cr => {
              if (!cr || !cr.id) return;
              if (!cr.job) return;
              if ((cr.job || '').toLowerCase() !== 'producer') return;
              if (producerSeen.has(cr.id)) return;
              const enriched = { ...cr, isDubbed: isDubbedCandidate(cr) };
              producerSeen.add(cr.id);
              producerCollected.push(enriched);
            });
          } catch (e) { /* ignore */ }
        }));
        if (!cancelled) {
          // Check translations for cast/producer collections so dubbed releases surface
          let leadChecked = await checkTranslationsForTelugu(leadCollected.slice(0, 96));
          let actorsChecked = await checkTranslationsForTelugu(actorsCollected.slice(0, 192));
          let producerChecked = await checkTranslationsForTelugu(producerCollected.slice(0, 96));

          leadChecked = leadChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed))).slice(0, 24);
          actorsChecked = actorsChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed))).slice(0, 48);
          producerChecked = producerChecked.filter(m => (m && (m.original_language === 'te' || m.isDubbed))).slice(0, 24);

          setLeadResults(leadChecked);
          setActorsResults(actorsChecked);
          setCastResults([...leadChecked, ...actorsChecked].slice(0, 60));
          setProducerResults(producerChecked);
        }

        // Keep a combined movies state for fallback listing
        const combined = [...titleItems, ...genreCollected, ...directorChecked, ...(leadResults || []), ...(actorsResults || [])];
        if (!cancelled) setMovies(combined.slice(0, 60));
      } catch (err) {
        console.error('Search error', err);
        if (!cancelled) {
          setTitleResults([]); setDirectorResults([]); setGenreResults([]); setOverviewResults([]); setCastResults([]); setMovies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    runSearch();
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div className="search-page app">
      <Header />
      {/* spacer so absolute header doesn't overlap content */}
      <div style={{height: 72}} />

      <div className="search-header">
        <button className="go-back-btn" onClick={() => navigate('/dashboard')}>Go Back</button>
        <h1 className="search-title">Search: {q}</h1>
      </div>

      <div className="results-container">
        {loading ? (
          <div className="loading-text">Searching...</div>
        ) : (
          <>
            {(!titleResults || titleResults.length === 0) && (!directorResults || directorResults.length === 0) && (!genreResults || genreResults.length === 0) && (!overviewResults || overviewResults.length === 0) && ((!leadResults || leadResults.length === 0) && (!actorsResults || actorsResults.length === 0)) && (!producerResults || producerResults.length === 0) ? (
              <div className="no-results">No results for "{q}"</div>
            ) : (
              <>
                  {titleResults && titleResults.length > 0 && (
                    <div className="movie-row">
                      <h2 className="row-title">Related to title</h2>
                      <div className="row-container">
                        <div className="row-scroll">
                          {titleResults.map(m => (
                            <div key={m.id} className="card-wrapper">
                              {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {directorResults && directorResults.length > 0 && (
                  <div className="movie-row">
                    <h2 className="row-title">Related to director</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {directorResults.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {producerResults && producerResults.length > 0 && (
                  <div className="movie-row">
                    <h2 className="row-title">Related to production</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {producerResults.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {genreSections && genreSections.length > 0 && genreSections.map((section, idx) => (
                  <div className="movie-row" key={`genre-section-${idx}`}>
                    <h2 className="row-title">Related to genre: {section.genreName}</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {section.movies.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {overviewResults && overviewResults.length > 0 && (
                  <div className="movie-row">
                    <h2 className="row-title">Related to overview</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {overviewResults.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {leadResults && leadResults.length > 0 && (
                  <div className="movie-row">
                    <h2 className="row-title">Related to Lead actor</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {leadResults.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {actorsResults && actorsResults.length > 0 && (
                  <div className="movie-row">
                    <h2 className="row-title">Related to actors</h2>
                    <div className="row-container">
                      <div className="row-scroll">
                        {actorsResults.map(m => (
                          <div key={m.id} className="card-wrapper">
                            {(m.isDubbed) ? <DubbedMovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} /> : <MovieCard movie={m} onClick={() => { setSelectedMovie(m); setShowModal(true); }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </>
            )}
          </>
        )}
      </div>
      {showModal && selectedMovie && (
        <MovieDetailModal
          movie={selectedMovie}
          onClose={() => { setShowModal(false); setSelectedMovie(null); }}
          genres={genresMap}
          setSelectedMovie={(m) => { setSelectedMovie(m); setShowModal(true); }}
        />
      )}
    </div>
  );
}
