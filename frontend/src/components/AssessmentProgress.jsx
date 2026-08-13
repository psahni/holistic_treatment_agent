import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { id: 'intake', label: 'Health Intake', icon: '📋', description: 'Tell us about your symptoms' },
  { id: 'root_cause', label: 'Root Cause Analysis', icon: '🔍', description: 'Identifying root causes' },
  { id: 'treatment_design', label: 'Protocol Design', icon: '📜', description: 'Selecting natural therapies' },
  { id: 'recommendation', label: 'Your Protocol', icon: '🌿', description: 'Your personalized plan' },
];

export default function AssessmentProgress({ currentStep }) {
  let stepId = currentStep;
  if (currentStep === 'complete') {
    stepId = 'recommendation';
  }
  const currentIndex = steps.findIndex(s => s.id === stepId);

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
