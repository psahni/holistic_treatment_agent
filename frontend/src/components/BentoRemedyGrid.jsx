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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 2px 12px rgba(72, 99, 59, 0.06)',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Bar: Elemental Pills & Compact Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--card-border)',
          paddingBottom: '0.65rem',
          marginBottom: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>🌿</span>
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.3rem',
              color: 'var(--text-main)',
              margin: 0,
              lineHeight: 1.2
            }}
          >
            Instant Holistic Protocol
          </h3>
        </div>

        {/* 5 Elements Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {elements.map((elem) => (
            <div
              key={elem.id}
              title={`Active Element: ${elem.name} (${elem.sanskrit})`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-main)'
              }}
            >
              <span>{elem.icon}</span>
              <span>{elem.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Bento Grid */}
      <div
        className="bento-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.85rem',
          marginBottom: '0.85rem'
        }}
      >
        {/* Card 1: Kitchen Pharmacy */}
        {kitchen && (
          <div
            className="bento-card"
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            <div style={{ height: '75px', width: '100%', background: '#FBF8EE', overflow: 'hidden' }}>
              <img
                src={kitchen.image}
                alt={kitchen.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '0.75rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--primary-green)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '2px'
                }}
              >
                🍵 Kitchen Pharmacy
              </div>
              <h4 style={{ fontSize: '0.95rem', margin: '0 0 6px 0', color: 'var(--text-main)', lineHeight: 1.25, fontWeight: 600 }}>
                {kitchen.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: 1.35, flex: 1 }}>
                {kitchen.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '3px' }}>
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
            className="bento-card"
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            <div style={{ height: '75px', width: '100%', background: '#EFF6FF', overflow: 'hidden' }}>
              <img
                src={hydrotherapy.image}
                alt={hydrotherapy.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '0.75rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
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
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0369a1'
                  }}
                >
                  ⏱ {hydrotherapy.duration}
                </span>
              </div>
              <h4 style={{ fontSize: '0.95rem', margin: '0 0 6px 0', color: 'var(--text-main)', lineHeight: 1.25, fontWeight: 600 }}>
                {hydrotherapy.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: 1.35, flex: 1 }}>
                {hydrotherapy.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '3px' }}>
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
            className="bento-card"
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            <div style={{ height: '75px', width: '100%', background: '#FAF5FF', overflow: 'hidden' }}>
              <img
                src={breath.image}
                alt={breath.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '0.75rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#9333ea',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '2px'
                }}
              >
                🧘 Mind &amp; Breath
              </div>
              <h4 style={{ fontSize: '0.95rem', margin: '0 0 6px 0', color: 'var(--text-main)', lineHeight: 1.25, fontWeight: 600 }}>
                {breath.title}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: 1.35, flex: 1 }}>
                {breath.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '3px' }}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Compact Safety Alert Strip */}
      {safety && (
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderLeft: '3px solid #D97706',
            borderRadius: '8px',
            padding: '0.45rem 0.75rem',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <p style={{ margin: 0, fontSize: '0.775rem', color: '#78350F', lineHeight: 1.35 }}>
            <strong style={{ color: '#92400E' }}>Safety: </strong>
            {safety}
          </p>
        </div>
      )}

      {/* Bottom Action Triggers */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
          borderTop: '1px solid var(--card-border)',
          paddingTop: '0.65rem'
        }}
      >
        <button
          onClick={handleSaveProtocol}
          className="btn btn-secondary"
          style={{
            padding: '5px 14px',
            fontSize: '0.775rem',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            background: 'var(--card-bg)'
          }}
        >
          {saved ? '✓ Saved!' : '📋 Save Protocol'}
        </button>

        {onConsultDoctor && (
          <button
            onClick={onConsultDoctor}
            className="btn btn-primary"
            style={{
              padding: '6px 16px',
              fontSize: '0.775rem',
              borderRadius: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(72, 99, 59, 0.2)'
            }}
          >
            <span>🏥</span> Switch to Full Treatment &amp; Doctor Review
          </button>
        )}
      </div>
    </motion.div>
  );
}
