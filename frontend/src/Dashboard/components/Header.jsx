import { Search, Menu, X } from 'lucide-react';
import './../dashboard.css';

export default function Header({ isMenuOpen, setIsMenuOpen, onSelectGenre, searchOpen, setSearchOpen, searchQuery, setSearchQuery, onSearchSubmit }) {
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
              <h1 className="brand-title">Telugu CineGuide</h1>
              <p className="brand-subtitle">Curated picks for Telugu movie lovers</p>
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
                />
                <button
                  className="search-submit"
                  onClick={() => { if (typeof onSearchSubmit === 'function') onSearchSubmit(searchQuery); setSearchOpen(false); }}
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
