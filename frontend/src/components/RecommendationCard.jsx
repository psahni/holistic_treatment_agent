import React from 'react';
import { motion } from 'framer-motion';

export default function RecommendationCard() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card"
      style={{
        padding: '2rem',
        marginTop: '2rem',
        border: '2px solid var(--gold)',
        background: 'var(--white)'
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Your Nature Cure Protocol</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Root Causes */}
        <section>
          <h3 style={{ borderBottom: '1px solid var(--cream-dark)', paddingBottom: '0.5rem' }}>🔍 Root Causes Identified</h3>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ background: 'var(--warning)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Dietary</span>
              Excessive refined carbohydrates causing inflammation
            </li>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ background: 'var(--sage)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Lifestyle</span>
              Sedentary routine reducing lymphatic flow
            </li>
          </ul>
        </section>

        {/* Diet */}
        <section>
          <h3 style={{ borderBottom: '1px solid var(--cream-dark)', paddingBottom: '0.5rem' }}>🥗 Diet Therapy</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', background: 'rgba(56, 161, 105, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--success)' }}>Focus On</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                <li>Ash gourd juice (morning)</li>
                <li>Raw salads before meals</li>
                <li>Sprouted moong</li>
              </ul>
            </div>
            <div style={{ flex: 1, minWidth: '200px', background: 'rgba(229, 62, 62, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--danger)' }}>Avoid</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                <li>Refined sugar</li>
                <li>Processed dairy</li>
                <li>Fried foods</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Hydrotherapy */}
        <section>
          <h3 style={{ borderBottom: '1px solid var(--cream-dark)', paddingBottom: '0.5rem' }}>💧 Hydrotherapy</h3>
          <div style={{ background: 'var(--cream)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Cold Hip Bath</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              15 minutes every morning on an empty stomach. Helps improve digestion and pelvic circulation.
            </p>
          </div>
        </section>

      </div>
      
      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button className="btn-primary" onClick={() => window.print()}>Download Protocol PDF</button>
      </div>
    </motion.div>
  );
}
