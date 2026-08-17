import React, { useState } from 'react';
import { naturopathyAPI } from '../services/api';

export default function PatientFormModal({ isOpen, onClose, onStart }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', age: '', gender: '', region: '', investigations: '' });

  if (!isOpen) return null;

  const handleStart = (e) => {
    e.preventDefault();
    onStart('new', formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3 style={{ marginBottom: '1.5rem', fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', color: 'var(--primary-green)' }}>
          Start Your Assessment
        </h3>
        <p style={{ marginBottom: '2rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
          Please provide some basic information so we can personalize your holistic health journey.
        </p>
        
        <form onSubmit={handleStart}>
          <div className="form-group">
            <input 
              type="text" 
              className="form-input" 
              placeholder="Name" 
              required
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Age" 
                required 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: e.target.value})} 
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <select 
                className="form-input" 
                required 
                value={formData.gender} 
                onChange={e => setFormData({...formData, gender: e.target.value})}
              >
                <option value="" disabled>Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Region (e.g. India)" 
              required 
              onChange={e => setFormData({...formData, region: e.target.value})} 
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: 500 }}>
              Share your previous investigation results <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>(Optional)</span>
            </label>
            <textarea 
              className="form-input" 
              placeholder="e.g. Recent blood tests, vitamin deficiencies, specific lab values..." 
              value={formData.investigations || ''} 
              onChange={e => setFormData({...formData, investigations: e.target.value})} 
              style={{ height: '80px', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Starting...' : 'Begin Your Assessment'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-light)', textAlign: 'center' }}>
          * Disclaimer: This AI tool is for informational purposes only and does not replace professional medical advice.
        </div>
      </div>
    </div>
  );
}
