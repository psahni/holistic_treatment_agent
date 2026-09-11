import React, { useState, useEffect } from 'react';
import { naturopathyAPI } from '../services/api';

export default function PatientFormModal({ isOpen, onClose, onStart }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', age: '', gender: '', region: '', investigations: '' });
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [autofillNotice, setAutofillNotice] = useState('');

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('naturecure_visitor_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setFormData(prev => ({ ...prev, ...parsed }));
            setHasSavedProfile(true);
          }
        }
      } catch (e) {
        console.warn('Failed to load saved visitor profile:', e);
      }
    }
  }, [isOpen]);

  const updateField = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      try {
        localStorage.setItem('naturecure_visitor_profile', JSON.stringify(next));
        setHasSavedProfile(true);
      } catch (e) {}
      return next;
    });
  };

  const handleAutofill = () => {
    const sample = {
      name: 'Rohan Sharma',
      age: '32',
      gender: 'male',
      region: 'New Delhi, India',
      investigations: 'Recent blood work normal; mild Vitamin D deficiency (22 ng/mL).'
    };
    setFormData(sample);
    try {
      localStorage.setItem('naturecure_visitor_profile', JSON.stringify(sample));
      setHasSavedProfile(true);
    } catch (e) {}
    setAutofillNotice('Details autofilled!');
    setTimeout(() => setAutofillNotice(''), 2500);
  };

  const handleClear = () => {
    const empty = { name: '', age: '', gender: '', region: '', investigations: '' };
    setFormData(empty);
    try {
      localStorage.removeItem('naturecure_visitor_profile');
      setHasSavedProfile(false);
    } catch (e) {}
    setAutofillNotice('Cleared.');
    setTimeout(() => setAutofillNotice(''), 2000);
  };

  if (!isOpen) return null;

  const handleStart = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('naturecure_visitor_profile', JSON.stringify(formData));
    } catch (e) {}
    onStart('new', formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--primary-green)' }}>
              Start Your Assessment
            </h3>
            {hasSavedProfile && (
              <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
                Saved in browser memory
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleAutofill}
              title="Autofill realistic demo profile"
              style={{
                background: 'var(--cream)',
                border: '1px solid var(--primary-green)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--forest-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              ✨ Autofill Details
            </button>
            {hasSavedProfile && (
              <button
                type="button"
                onClick={handleClear}
                title="Clear saved profile"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--cream-dark)',
                  borderRadius: '20px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-light)',
                  cursor: 'pointer'
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {autofillNotice && (
          <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.825rem' }}>
            ✓ {autofillNotice}
          </div>
        )}

        <p style={{ marginBottom: '1.5rem', color: 'var(--text-light)', lineHeight: '1.5', fontSize: '0.925rem' }}>
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
              onChange={e => updateField('name', e.target.value)} 
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
                onChange={e => updateField('age', e.target.value)} 
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <select 
                className="form-input" 
                required 
                value={formData.gender} 
                onChange={e => updateField('gender', e.target.value)}
              >
                <option value="" disabled>Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Region (e.g. India)" 
              required 
              value={formData.region}
              onChange={e => updateField('region', e.target.value)} 
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: 500 }}>
              Share your previous investigation results <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>(Optional)</span>
            </label>
            <textarea 
              className="form-input" 
              placeholder="e.g. Recent blood tests, vitamin deficiencies, specific lab values..." 
              value={formData.investigations || ''} 
              onChange={e => updateField('investigations', e.target.value)} 
              style={{ height: '70px', resize: 'vertical', fontFamily: 'inherit' }}
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
