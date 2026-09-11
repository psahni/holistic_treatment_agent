import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { id: 'intake', label: 'Health Intake', icon: '📋', description: 'Tell us about your symptoms' },
  { id: 'root_cause', label: 'Root Cause Analysis', icon: '🔍', description: 'Identifying root causes' },
  { id: 'medical_triage', label: 'Medical Triage', icon: '🛡️', description: 'Validating safety and protocols' },
  { id: 'recommendation', label: 'Your Protocol', icon: '🌿', description: 'Your personalized plan' },
];

export default function AssessmentProgress({ currentStep, variant = 'vertical' }) {
  let stepId = currentStep;
  if (currentStep === 'complete') {
    stepId = 'recommendation';
  }
  const currentIndex = steps.findIndex(s => s.id === stepId);

  if (variant === 'horizontal') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto 1.5rem',
        padding: '0.75rem 1.25rem',
        background: 'var(--white)',
        borderRadius: '16px',
        border: '1px solid var(--cream-dark)',
        boxShadow: '0 2px 8px rgba(72, 99, 59, 0.05)',
        boxSizing: 'border-box'
      }}>
        {steps.map((step, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isFuture ? 0.45 : 1
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--gold)' : isPast ? 'var(--forest)' : 'var(--cream-dark)',
                  color: isPast ? 'white' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {isPast ? '✓' : step.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--forest)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  }}>
                    {step.label}
                  </span>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: isPast ? 'var(--forest)' : 'var(--cream-dark)',
                  margin: '0 8px'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {steps.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={step.id} style={{ display: 'flex', gap: '1rem', opacity: isFuture ? 0.5 : 1 }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isCurrent ? 'var(--gold)' : isPast ? 'var(--forest)' : 'var(--cream-dark)',
              color: isPast ? 'white' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              position: 'relative'
            }}>
              {isPast ? '✓' : step.icon}
              {index < steps.length - 1 && (
                <div style={{
                  position: 'absolute',
                  top: '40px',
                  bottom: '-24px',
                  width: '2px',
                  background: isPast ? 'var(--forest)' : 'var(--cream-dark)',
                  zIndex: -1
                }} />
              )}
            </div>
            
            <div style={{ flex: 1, paddingTop: '0.2rem' }}>
              <motion.h4 
                animate={{ color: isCurrent ? 'var(--forest)' : 'var(--text-secondary)' }}
                style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}
              >
                {step.label}
              </motion.h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
