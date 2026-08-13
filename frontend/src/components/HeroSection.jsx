import React, { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import PatientFormModal from './PatientFormModal';
import { naturopathyAPI } from '../services/api';

export default function HeroSection({ onStart }) {
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await naturopathyAPI.getMe();
      setUser(userData);
    } catch (e) {
      setUser(null);
    }
  };

  const handleLogout = async () => {
    try {
      await naturopathyAPI.logout();
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartJourney = () => {
    if (user) {
      onStart('new', {
        name: user.name,
        age: user.age,
        region: user.city || 'India',
        gender: 'other',
        loggedInUser: user
      });
    } else {
      setIsPatientModalOpen(true);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation */}
      <nav style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-green)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="M12 12V2"/>
            <path d="M12 12c-2.5 0-4.5 2-4.5 4.5S9.5 21 12 21"/>
            <path d="M12 12c2.5 0 4.5 2 4.5 4.5S14.5 21 12 21"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '1.25rem' }}>NatureGuide</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {user ? (
            <>
              <a href="/history" style={{ color: 'var(--primary-green)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>📋 My Cases</a>
              <span style={{ fontWeight: 500, color: 'var(--text-light)' }}>Welcome, {user.name}</span>
              <button className="btn-secondary" onClick={handleLogout} style={{ border: 'none' }}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setIsAuthModalOpen(true)} style={{ border: 'none', fontWeight: 500 }}>Log In / Sign Up</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Content */}
      <div style={{ padding: '0 15px' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minHeight: '600px' }}>
          
          <div className="container" style={{ width: '100%', display: 'flex', position: 'relative', zIndex: 1 }}>
            {/* Left Text Column */}
            <div style={{ flex: '0 0 55%', maxWidth: '650px', padding: '64px 0', paddingRight: '48px' }} className="animate-fade-in">
              <div className="badge badge-outline" style={{ marginBottom: '24px', color: 'var(--text-light)', border: '1px solid #dcdacb' }}>
                <span>✨</span> AI-Powered Holistic Healing
              </div>
              <h1 style={{ fontSize: '4.5rem', lineHeight: '1.1', marginBottom: '24px' }}>
                Natural Healing.<br/>
                <span className="text-primary text-italic">Personalized for You.</span>
              </h1>
              <p style={{ fontSize: '1.125rem', color: 'var(--text-light)', marginBottom: '40px', lineHeight: '1.6', maxWidth: '500px' }}>
                An AI-powered holistic health advisor that helps you discover the root causes of your health concerns and recommends personalized natural protocols.
              </p>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '48px' }}>
                <button className="btn btn-primary" style={{ padding: '16px 32px' }} onClick={handleStartJourney}>
                  Start Your Healing Journey
                </button>
                <a href="#how-it-works" className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Learn How It Works <span>→</span>
                </a>
              </div>

              <div style={{ display: 'flex', gap: '32px', borderTop: '1px solid var(--card-border)', paddingTop: '24px' }}>
                {[
                  { title: 'Root Cause\nFocused', icon: '🌿' },
                  { title: 'Natural &\nHolistic', icon: '🌱' },
                  { title: 'Safe &\nPersonalized', icon: '🛡️' }
                ].map((feature, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '50%', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {feature.icon}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-light)', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                      {feature.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Image Column (Full Bleed) */}
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '45%' }} className="animate-fade-in">
            <div style={{ 
              width: '100%',
              height: '100%',
              borderRadius: '400px 0 0 400px',
              overflow: 'hidden',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.05)'
            }}>
              <img 
                src="/images/hero.jpg" 
                alt="Natural herbs and mortar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Systems Section */}
      <div style={{ backgroundColor: 'var(--white)', padding: '80px 24px' }}>
        <div className="container" style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--primary-green)' }}>🌿</span>
            <h2 style={{ fontSize: '2.5rem' }}>Choose Your Healing Path</h2>
            <span style={{ color: 'var(--primary-green)' }}>🌿</span>
          </div>
          <p style={{ color: 'var(--text-light)', fontSize: '1.125rem' }}>Three natural systems. One smart advisor.</p>
        </div>

        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          
          {/* Naturopathy Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '32px 32px 16px', gap: '16px' }}>
              <img src="/images/naturopathy.jpg" alt="Naturopathy" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                 <span style={{ fontSize: '1.5rem' }}>🌿</span>
                 <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>Naturopathy</h3>
              </div>
            </div>
            <div style={{ padding: '0 32px 32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ color: 'var(--text-light)', lineHeight: '1.6', marginBottom: '24px', flex: 1 }}>
                AI-guided natural protocols based on Nature Cure principles to restore balance and stimulate the body's self-healing ability.
              </p>
              <button className="btn btn-primary" onClick={handleStartJourney}>
                Explore Naturopathy →
              </button>
            </div>
          </div>

          {/* Homeopathy Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '32px 32px 16px', gap: '16px' }}>
              <img src="/images/homeopathy.jpg" alt="Homeopathy" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                 <span style={{ fontSize: '1.5rem' }}>⚗️</span>
                 <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--primary-green)' }}>Homeopathy</h3>
              </div>
            </div>
            <div style={{ padding: '0 32px 32px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <p style={{ color: 'var(--text-light)', lineHeight: '1.6', marginBottom: '24px', flex: 1 }}>
                Gentle, precise, and personalized healing based on the principle of like cures like.
              </p>
              <div className="badge" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>Coming Soon</div>
            </div>
          </div>

          {/* Ayurveda Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '32px 32px 16px', gap: '16px' }}>
              <img src="/images/ayurveda.jpg" alt="Ayurveda" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                 <span style={{ fontSize: '1.5rem' }}>🥣</span>
                 <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: '#b45309' }}>Ayurveda</h3>
              </div>
            </div>
            <div style={{ padding: '0 32px 32px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <p style={{ color: 'var(--text-light)', lineHeight: '1.6', marginBottom: '24px', flex: 1 }}>
                Ancient wisdom for complete well-being through balancing body, mind, and spirit.
              </p>
              <div className="badge" style={{ backgroundColor: '#ffedd5', color: '#c2410c' }}>Coming Soon</div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer Features */}
      <div style={{ backgroundColor: 'var(--bg-color)', padding: '48px 24px', borderTop: '1px solid var(--card-border)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '16px' }}>
          {[
            { title: 'AI-Powered Guidance', text: 'Smart insights, rooted in nature', icon: '🧠' },
            { title: 'Personalized for You', text: 'Your body, your plan, your pace', icon: '👤' },
            { title: 'Holistic & Safe', text: 'Natural, non-invasive, effective', icon: '🌱' },
            { title: 'Privacy First', text: 'Your data, always protected', icon: '🔒' }
          ].map((feat, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '1.5rem' }}>{feat.icon}</div>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>{feat.title}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0 }}>{feat.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
          checkAuth();
        }}
      />

      <PatientFormModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        onStart={(id, formData) => {
          setIsPatientModalOpen(false);
          onStart(id, { ...formData, loggedInUser: user });
        }}
      />
    </div>
  );
}
