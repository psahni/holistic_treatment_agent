'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const PATTERNS = {
  '478': {
    id: '478',
    title: '4-7-8 Calming Pranayama',
    tagline: 'Vagus nerve stimulation · Eases acidity, stress & restlessness',
    steps: [
      { phase: 'Inhale', duration: 4, scale: 1.35, color: 'var(--primary-green)', label: 'Inhale 4s' },
      { phase: 'Hold', duration: 7, scale: 1.35, color: '#d4a373', label: 'Hold 7s' },
      { phase: 'Exhale', duration: 8, scale: 0.9, color: '#8fa88b', label: 'Exhale 8s' }
    ]
  },
  'box': {
    id: 'box',
    title: 'Box Breathing (Sama Vritti)',
    tagline: 'Nervous system reset · Restores focus & emotional balance',
    steps: [
      { phase: 'Inhale', duration: 4, scale: 1.35, color: 'var(--primary-green)', label: 'Inhale 4s' },
      { phase: 'Hold', duration: 4, scale: 1.35, color: '#d4a373', label: 'Hold 4s' },
      { phase: 'Exhale', duration: 4, scale: 0.9, color: '#8fa88b', label: 'Exhale 4s' },
      { phase: 'Hold', duration: 4, scale: 0.9, color: '#d4a373', label: 'Hold 4s' }
    ]
  },
  'sheetali': {
    id: 'sheetali',
    title: 'Sheetali (Cooling Breath)',
    tagline: 'Naturopathic cooling · Counters Pitta, internal heat & acid reflux',
    steps: [
      { phase: 'Inhale (Mouth)', duration: 4, scale: 1.35, color: '#16a34a', label: 'Inhale 4s' },
      { phase: 'Hold', duration: 5, scale: 1.35, color: '#d4a373', label: 'Hold 5s' },
      { phase: 'Exhale (Nose)', duration: 6, scale: 0.9, color: '#8fa88b', label: 'Exhale 6s' }
    ]
  }
};

export default function BreathingPacer({ initialPattern = '478', onClose }) {
  const [activePattern, setActivePattern] = useState(initialPattern);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [isComplete, setIsComplete] = useState(false);

  const timerRef = useRef(null);
  const maxCycles = 4;

  const currentPattern = PATTERNS[activePattern] || PATTERNS['478'];
  const currentStep = currentPattern.steps[currentStepIdx] || currentPattern.steps[0];

  const resetPacer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setCurrentStepIdx(0);
    setTimeRemaining(0);
    setCycle(1);
    setIsComplete(false);
  };

  const handlePatternChange = (key) => {
    resetPacer();
    setActivePattern(key);
  };

  const togglePacer = () => {
    if (isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRunning(false);
    } else {
      setIsComplete(false);
      setIsRunning(true);
      if (timeRemaining === 0) {
        setTimeRemaining(currentStep.duration);
      }
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Transition to next step
          setCurrentStepIdx((prevStep) => {
            const nextStepIdx = prevStep + 1;
            if (nextStepIdx >= currentPattern.steps.length) {
              // End of one cycle
              setCycle((prevCycle) => {
                if (prevCycle >= maxCycles) {
                  setIsRunning(false);
                  setIsComplete(true);
                  if (timerRef.current) clearInterval(timerRef.current);
                  return prevCycle;
                }
                return prevCycle + 1;
              });
              return 0;
            }
            return nextStepIdx;
          });
          const nextStep = currentPattern.steps[(currentStepIdx + 1) % currentPattern.steps.length];
          return nextStep.duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, currentStepIdx, currentPattern.steps, maxCycles]);

  return (
    <div
      data-testid="breathing-pacer"
      style={{
        background: 'var(--white)',
        border: '1.5px solid var(--card-border)',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '440px',
        margin: '0 auto',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center',
        position: 'relative'
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'var(--text-light)'
          }}
          title="Close Pacer"
        >
          ✕
        </button>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'var(--badge-bg)',
            color: 'var(--badge-text)',
            fontSize: '0.75rem',
            fontWeight: 500,
            marginBottom: '0.5rem'
          }}
        >
          <span>🌿</span> Holistic Breath Therapy
        </div>
        <h3 style={{ fontSize: '1.35rem', color: 'var(--primary-green)', margin: '0 0 0.25rem 0' }}>
          {currentPattern.title}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
          {currentPattern.tagline}
        </p>
      </div>

      {/* Pattern Selector Chips */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
        {Object.values(PATTERNS).map((p) => {
          const isSelected = p.id === activePattern;
          return (
            <button
              key={p.id}
              onClick={() => handlePatternChange(p.id)}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                borderRadius: '20px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isSelected ? 'var(--primary-green)' : 'var(--card-bg)',
                color: isSelected ? 'var(--white)' : 'var(--text-main)',
                boxShadow: isSelected ? '0 2px 8px rgba(72, 99, 59, 0.25)' : 'none'
              }}
            >
              {p.id === '478' ? '4-7-8 Relax' : p.id === 'box' ? 'Box 4-4-4-4' : 'Sheetali'}
            </button>
          );
        })}
      </div>

      {/* Concentric Animated Pacer Circle */}
      <div
        style={{
          width: '210px',
          height: '210px',
          margin: '0 auto 1.25rem',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Outer ambient glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '1px solid var(--card-border)',
            background: 'var(--card-bg)',
            opacity: 0.6
          }}
        />

        {/* Dynamic expanding/contracting ring */}
        <motion.div
          animate={{
            scale: isComplete ? 1.05 : isRunning ? currentStep.scale : 1,
            borderColor: isComplete ? 'var(--primary-green)' : isRunning ? currentStep.color : 'var(--card-border)'
          }}
          transition={{
            duration: isRunning ? currentStep.duration : 0.4,
            ease: 'easeInOut'
          }}
          style={{
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            border: '4px solid var(--primary-green)',
            background: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
            zIndex: 2
          }}
        >
          <span
            data-testid="pacer-phase"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--forest-dark)'
            }}
          >
            {isComplete ? 'Complete ✨' : isRunning ? currentStep.phase : 'Ready'}
          </span>
          <span
            data-testid="pacer-timer"
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-light)',
              marginTop: '4px'
            }}
          >
            {isComplete ? 'FEELING CALMER' : isRunning ? `${timeRemaining}s` : 'TAP START'}
          </span>
        </motion.div>
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
        {currentPattern.steps.map((s, idx) => {
          const isActive = isRunning && idx === currentStepIdx;
          return (
            <div
              key={idx}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '16px',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? 'var(--primary-green)' : 'var(--card-bg)',
                color: isActive ? 'var(--white)' : 'var(--text-light)',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary-green)' : 'var(--card-border)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.25s ease'
              }}
            >
              {s.label}
            </div>
          );
        })}
      </div>

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--card-border)',
          paddingTop: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-light)'
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Cycle: {cycle} / {maxCycles}
        </span>

        <button
          onClick={togglePacer}
          className="btn btn-primary"
          style={{
            padding: '8px 20px',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isComplete ? '↺ Restart' : isRunning ? '⏸ Pause' : '▶ Start Pacer'}
        </button>

        <button
          onClick={resetPacer}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-light)',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
