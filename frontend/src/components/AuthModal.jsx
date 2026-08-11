import React, { useState } from 'react';
import { naturopathyAPI } from '../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Signup fields
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    email: '',
    phone_number: '',
    city: '',
    password: ''
  });

  // Login fields
  const [loginData, setLoginData] = useState({
    login_id: '',
    password: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await naturopathyAPI.login(loginData);
        onAuthSuccess();
      } else {
        await naturopathyAPI.signup({
          ...formData,
          age: parseInt(formData.age, 10)
        });
        onAuthSuccess();
      }
    } catch (err) {
      console.error(err);
      let errMsg = isLogin 
        ? 'Login failed. Please check your credentials and try again.' 
        : 'Registration failed. Please check your details and try again.';
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data.detail === 'string') {
          errMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errMsg = data.detail.map(d => {
            const field = d.loc ? d.loc[d.loc.length - 1] : '';
            const fieldName = field ? field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ') : 'Input';
            return `${fieldName}: ${d.msg}`;
          }).join('. ');
        } else if (data.message) {
          errMsg = data.message;
        }
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '400px' }}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3 style={{ marginBottom: '0.5rem', fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', color: 'var(--primary-green)' }}>
          {isLogin ? 'Welcome Back' : 'Create an Account'}
        </h3>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
          {isLogin ? 'Login to access your personalized holistic journey.' : 'Join us to track your wellness over time.'}
        </p>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {isLogin ? (
            <>
              <div className="form-group">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Email or Phone Number" 
                  required 
                  value={loginData.login_id} 
                  onChange={e => setLoginData({...loginData, login_id: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Password" 
                  required 
                  value={loginData.password} 
                  onChange={e => setLoginData({...loginData, password: e.target.value})} 
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Full Name" 
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
                    min="1"
                    value={formData.age} 
                    onChange={e => setFormData({...formData, age: e.target.value})} 
                  />
                </div>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="City" 
                    required 
                    value={formData.city} 
                    onChange={e => setFormData({...formData, city: e.target.value})} 
                  />
                </div>
              </div>
              <div className="form-group">
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="Email Address" 
                  required 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="Phone Number" 
                  required 
                  value={formData.phone_number} 
                  onChange={e => setFormData({...formData, phone_number: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Password (min 6 chars)" 
                  required 
                  minLength="6"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-light)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--primary-green)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
