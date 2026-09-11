'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function BentoRemedyGrid({ data, onConsultDoctor }) {
  const [saved, setSaved] = useState(false);

  if (!data) return null;

  const { elements = [], kitchen, hydrotherapy, breath, safety } = data;

  const handleSaveProtocol = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--card-border)',
        borderRadius: '20px',
        padding: '1.75rem',
        boxShadow: '0 4px 20px rgba(72, 99, 59, 0.08)',
        marginTop: '0.75rem',
        marginBottom: '0.75rem',
        maxWidth: '100%'
      }}
    >
      {/* Top Bar: Elemental Pills & Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--card-border)',
          paddingBottom: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1rem' }}>🌿</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--primary-green)'
              }}
            >
              Nature Cure Protocol
            </span>
          </div>
          <h3
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: 0
            }}
          >
            Instant Holistic Recommendations
          </h3>
        </div>

        {/* 5 Elements Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {elements.map((elem) => (
            <div
              key={elem.id}
              title={`Active Element: ${elem.name} (${elem.sanskrit})`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-main)'
              }}
            >
              <span>{elem.icon}</span>
              <span>
                {elem.name} <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>({elem.sanskrit})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bento Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* Card 1: Kitchen Pharmacy */}
        {kitchen && (
          <div
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <div style={{ height: '140px', width: '100%', background: '#FBF8EE', overflow: 'hidden' }}>
              <img
                src={kitchen.image}
                alt={kitchen.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--primary-green)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}
              >
                🍵 Kitchen Pharmacy
              </div>
              <h4 style={{ fontSize: '1.05rem', margin: '0 0 10px 0', color: 'var(--text-main)', lineHeight: 1.3 }}>
                {kitchen.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
                {kitchen.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Card 2: Hydrotherapy */}
        {hydrotherapy && (
          <div
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <div style={{ height: '140px', width: '100%', background: '#EFF6FF', overflow: 'hidden' }}>
              <img
                src={hydrotherapy.image}
                alt={hydrotherapy.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#0284c7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  💧 Hydrotherapy
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#e0f2fe',
                    color: '#0369a1'
                  }}
                >
                  ⏱ {hydrotherapy.duration}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', margin: '0 0 10px 0', color: 'var(--text-main)', lineHeight: 1.3 }}>
                {hydrotherapy.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
                {hydrotherapy.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Card 3: Mind, Breath & Rest */}
        {breath && (
          <div
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <div style={{ height: '140px', width: '100%', background: '#FAF5FF', overflow: 'hidden' }}>
              <img
                src={breath.image}
                alt={breath.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#9333ea',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}
              >
                🧘 Mind &amp; Breathwork
              </div>
              <h4 style={{ fontSize: '1.05rem', margin: '0 0 10px 0', color: 'var(--text-main)', lineHeight: 1.3 }}>
                {breath.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
                {breath.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Safety Alert Strip */}
      {safety && (
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderLeft: '4px solid #D97706',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong style={{ display: 'block', fontSize: '0.85rem', color: '#92400E', marginBottom: '2px' }}>
              Safety &amp; Precaution
            </strong>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#78350F', lineHeight: 1.4 }}>
              {safety}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Action Triggers */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          borderTop: '1px solid var(--card-border)',
          paddingTop: '1.25rem'
        }}
      >
        <button
          onClick={handleSaveProtocol}
          className="btn btn-secondary"
          style={{
            padding: '8px 18px',
            fontSize: '0.85rem',
            border: '1px solid var(--card-border)',
            borderRadius: '20px',
            background: 'var(--card-bg)'
          }}
        >
          {saved ? '✓ Protocol Saved!' : '📋 Save Protocol'}
        </button>

        {onConsultDoctor && (
          <button
            onClick={onConsultDoctor}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '0.85rem',
              borderRadius: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(72, 99, 59, 0.25)'
            }}
          >
            <span>🏥</span> Switch to Full Treatment &amp; Doctor Review
          </button>
        )}
      </div>
    </motion.div>
  );
}
