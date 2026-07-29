import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { naturopathyAPI } from '../services/api';

export default function HeroSection({ onStart }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', age: '', gender: '', region: '' });

  const handleStart = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { session_id } = await naturopathyAPI.startSession(formData);
      onStart(session_id);
    } catch (err) {
      console.error(err);
      alert('Failed to start session. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--forest-dark), var(--forest))',
      color: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background SVG elements could be added here as absolutely positioned divs */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ textAlign: 'center', maxWidth: '800px', zIndex: 2 }}
      >
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--gold-light)' }}>Heal with Nature's Intelligence</h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '3rem', opacity: 0.9, lineHeight: 1.6 }}>
          An AI-powered Naturopathy advisor guided by Nature Cure principles. Discover the root causes of your health challenges and receive personalized natural protocols.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
          {['🌿 Root Cause Analysis', '💧 Hydrotherapy Protocols', '🥗 Diet Therapy'].map((feat, i) => (
            <span key={i} style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '0.5rem 1rem',
              borderRadius: '2rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>{feat}</span>
          ))}
        </div>

        <form onSubmit={handleStart} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: '0 auto', background: 'rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, color: 'var(--cream)', fontSize: '1.5rem' }}>Patient Information</h3>
          <input type="text" placeholder="Name (Optional)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input type="number" placeholder="Age" required value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={inputStyle} />
            <select required value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} style={inputStyle}>
              <option value="" disabled>Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <input type="text" placeholder="Region (e.g. India)" required value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} style={inputStyle} />
          
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem', background: 'var(--gold)', color: 'var(--forest-dark)', fontSize: '1.1rem', padding: '1rem' }} disabled={loading}>
            {loading ? 'Starting...' : 'Begin Your Assessment'}
          </button>
        </form>

      </motion.div>
      <div style={{ position: 'absolute', bottom: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
        * Disclaimer: This AI tool is for informational purposes only and does not replace professional medical advice from a certified AYUSH practitioner.
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.1)',
  color: 'white',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box'
};
