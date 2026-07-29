import React from 'react';
import { AlertTriangle, PlusCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SafetyAlert({ flags }) {
  // flags shape: { type: 'emergency' | 'practitioner' | 'interaction' | 'scope', message: string }
  
  if (!flags) return null;

  const styles = {
    emergency: { bg: '#fff5f5', border: '#fc8181', text: '#c53030', icon: AlertTriangle },
    practitioner: { bg: '#fffaf0', border: '#f6ad55', text: '#dd6b20', icon: PlusCircle },
    interaction: { bg: '#fffff0', border: '#f6e05e', text: '#d69e2e', icon: AlertTriangle },
    scope: { bg: '#ebf8ff', border: '#63b3ed', text: '#3182ce', icon: Info },
  };

  const currentStyle = styles[flags.type] || styles.scope;
  const Icon = currentStyle.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '1rem 1.5rem',
        background: currentStyle.bg,
        border: `1px solid ${currentStyle.border}`,
        color: currentStyle.text,
        margin: '1rem 2rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <Icon size={24} />
      <div style={{ flex: 1 }}>
        <strong>Important Notice</strong>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{flags.message}</p>
      </div>
      {flags.type === 'emergency' && (
        <a href="tel:112" style={{ background: '#e53e3e', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}>
          Call 112
        </a>
      )}
    </motion.div>
  );
}
