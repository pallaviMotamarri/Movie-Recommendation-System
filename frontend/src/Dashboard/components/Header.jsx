import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import './../dashboard.css';

export default function Header({ isMenuOpen, setIsMenuOpen, onSelectGenre, searchOpen, setSearchOpen, searchQuery, setSearchQuery, onSearchSubmit }) {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const menuToggleRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!searchOpen) return;
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (!isMenuOpen) return;
      // If click is inside menu or on the toggle button, ignore
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (menuToggleRef.current && menuToggleRef.current.contains(e.target)) return;
      setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, [isMenuOpen, setIsMenuOpen]);
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
          <div className="header-left" style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              className="logo-container"
              style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}
              role="button"
              tabIndex={0}
              onClick={() => navigate('/')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
            >
              <img src="/images/Logo.svg" alt="Telugu CineGuide" className="logo" />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Telugu CineGuide</h1>
              <p className="brand-subtitle">Curated picks for Telugu movie lovers</p>
            </div>
          </div>

          <div className="header-right" style={{display: 'flex', alignItems: 'center', gap: 8}}>
            {searchOpen ? (
              <div className="search-box" ref={searchRef}>
                <input
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search genre, actor or movie"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (typeof onSearchSubmit === 'function') onSearchSubmit(searchQuery);
                      setSearchOpen(false);
                    }
                  }}
                />
                <button
                  className="search-submit"
                  onClick={() => { if (typeof onSearchSubmit === 'function') onSearchSubmit(searchQuery); setSearchOpen(false); }}
                >
                  Search
                </button>
              </div>
            ) : (
              <button className="search-btn" onClick={() => setSearchOpen(true)}>
                <Search size={20} />
              </button>
            )}

            <button 
              className="menu-toggle"
              aria-label="Menu"
              ref={menuToggleRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="mobile-nav" ref={menuRef}>
            <div className="mobile-nav-items">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className="mobile-nav-item"
                  onClick={() => {
                    if (typeof onSelectGenre === 'function') onSelectGenre(item.label);
                    setIsMenuOpen(false);
                  }}
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
