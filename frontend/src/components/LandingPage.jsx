import React, { useState } from 'react';
import Button from './Button';
import Header from './Header';
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <head>
        <title>Telugu CineGuide</title>
        <meta name="description" content="Discover the best Telugu movies with personalized recommendations. Smart selections, local flavours, and quick search to find your perfect Telugu cinema match instantly." />
        <meta property="og:title" content="Telugu CineGuide - Discover Best Telugu Movies & Personalized Recommendations" />
        <meta property="og:description" content="Discover the best Telugu movies with personalized recommendations. Smart selections, local flavours, and quick search to find your perfect Telugu cinema match instantly." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;900&family=Poppins:wght@400;600;900&display=swap" rel="stylesheet" />
      </head>

      <div className="app-container">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <main className="main-content">
          {/* Background Stack Layer */}
          <div className="background-layer">
            
            <img 
              src="/images/Background.jpg" 
              alt="Herobackground"
              className="bg-image"
            />
            
            {/* Gradient Overlay */}
            <div className="bg-gradient"></div>
          </div>

          {/* Content Layer */}
          <div className="content-layer">
            {/* Hero Section */}
            <section className="hero-section">
              {/* Elevated Text */}
              <p className="elevated-text">
                Elevated Telugu cinema experience
              </p>

              {/* Main Headline */}
              <h1 className="main-headline">
                🎬 Discover Movies You will Love
              </h1>

              {/* Description */}
              <div className="description-container">
                <p className="description-text">
                  Find the perfect Telugu movie based on your favourite genres, actors, and the mood you are in. Smart, personalized recommendations every time.
                </p>

                {/* Action Buttons */}
                <div className="action-buttons">
                  <Button 
                    text="Get Started"
                    padding="16px 34px 16px 50px"
                    onClick={() => navigate('/dashboard')}
                  />
                  
                  {/* <div className="trailer-button">
                    <img 
                      src="/images/PlayButton.png" 
                      alt="Play Icon"
                      className="play-icon"
                    />
                    <span className="trailer-text">
                      Watch Trailer Picks
                    </span>
                  </div> */}

                  <button className="trailer-button" type="button">
                   <img 
                    src="/images/PlayButton.png" 
                    alt="Play trailer"
                    className="play-icon"
                  />
                    <span className="trailer-text">
                      Watch Trailer Picks
                    </span>
                </button>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
              <div className="features-container">
                <div className="features-grid">
                  {/* Smart Selections */}
                  <button className="feature-card" onClick={() => handleSmartSelections()}>
                    <p className="feature-tag">
                      Smart Selections
                    </p>
                    
                    <div className="feature-content">
                      <h3 className="feature-title">
                        Smart Selections
                      </h3>
                      
                      <p className="feature-description">
                        Answer one question at a time and we will tailor picks to your taste.
                      </p>
                    </div>
                  </button>

                  {/* Local Flavours */}
                  <button className="feature-card" onClick={() => handleLocalFlavours()}>
                    <p className="feature-tag">
                      Local Flavours
                    </p>
                    
                    <div className="feature-content">
                      <h3 className="feature-title">
                        Local Flavours
                      </h3>
                      
                      <p className="feature-description">
                        Explore the most popular Telugu movies loved by fans.
                      </p>
                    </div>
                  </button>

                  {/* Quick Search */}
                  <button className="feature-card" onClick={() => handleQuickSearch()}>
                    <p className="feature-tag">
                      Quick Search
                    </p>
                    
                    <div className="feature-content">
                      <h3 className="feature-title">
                        Quick Search
                      </h3>
                      
                      <p className="feature-description">
                        Type your prompt and instantly find movies that match.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <footer className="footer">
                  <div className="footer-left">
                    <img 
                      src="/images/Logo.svg" 
                      alt="Copyright"
                      className="copyright-icon"
                    />
                    <span className="footer-year">
                      2025
                    </span>
                    <span className="footer-brand">
                      Telugu CineGuide.
                    </span>
                  </div>
                  
                  <p className="footer-text">
                    Personalized recommendations for Telugu cinema fans.
                  </p>
                </footer>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default LandingPage;