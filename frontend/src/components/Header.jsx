import React, { useState } from 'react';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          {/* Logo and Brand Section */}
          <div className="brand-section">
            {/* Logo */}
            <div className="logo-container">
              <img 
                src="/images/Logo.svg" 
                alt="Telugu CineGuide Logo"
                className="logo"
              />
            </div>
            
            {/* Brand Text */}
            <div className="brand-text">
              <h1 className="brand-title">
                Telugu CineGuide
              </h1>
              <p className="brand-subtitle">
                Curated picks for Telugu movie lovers
              </p>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;