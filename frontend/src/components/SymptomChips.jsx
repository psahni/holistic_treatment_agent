'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const POPULAR_SYMPTOMS = [
  {
    id: 'acid-reflux',
    icon: '🍵',
    label: 'Acid Reflux & Bloating',
    query: 'I have severe acid reflux and stomach bloating after meals. What natural remedies do you suggest?'
  },
  {
    id: 'insomnia',
    icon: '🌙',
    label: 'Insomnia & Restless Sleep',
    query: 'I struggle with falling asleep and wake up frequently at night. How can naturopathy help?'
  },
  {
    id: 'fatigue',
    icon: '⚡',
    label: 'Mid-day Fatigue & Brain Fog',
    query: 'I experience heavy afternoon fatigue and brain fog. What natural diet and routine do you recommend?'
  },
  {
    id: 'skin',
    icon: '🧴',
    label: 'Skin Breakouts & Acne',
    query: 'I have recurring facial acne and skin inflammation. What are the root causes and nature cure remedies?'
  },
  {
    id: 'stiffness',
    icon: '🦴',
    label: 'Morning Joint Stiffness',
    query: 'My joints feel stiff and painful every morning. What hydrotherapy and herbal protocols can relieve this?'
  },
  {
    id: 'stress',
    icon: '🧘',
    label: 'Anxiety & Nervous Tension',
    query: 'I feel high work stress, tight shoulders, and shallow breathing. What calming natural protocol can I follow?'
  }
];

export default function SymptomChips({ onSelectSymptom }) {
  if (!onSelectSymptom) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        marginTop: '1.5rem',
        marginBottom: '1rem',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          fontSize: '0.825rem',
          fontWeight: 600,
          color: 'var(--text-light)',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}
      >
        <span>✨</span> Popular Health Queries (Tap to Ask)
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
          maxWidth: '750px',
          margin: '0 auto'
        }}
      >
        {POPULAR_SYMPTOMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectSymptom(item.query)}
            className="symptom-chip"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '20px',
              background: 'var(--white)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-green)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(72, 99, 59, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--card-border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
