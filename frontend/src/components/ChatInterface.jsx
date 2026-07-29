import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Leaf } from 'lucide-react';
import { naturopathyAPI } from '../services/api';
import AssessmentProgress from './AssessmentProgress';
import RecommendationCard from './RecommendationCard';
import SafetyAlert from './SafetyAlert';

export default function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState('intake');
  const [isComplete, setIsComplete] = useState(false);
  const [safetyFlags, setSafetyFlags] = useState(null);
  const [report, setReport] = useState(null);
  const [needsPractitioner, setNeedsPractitioner] = useState(false);
  
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isComplete]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    
    try {
      const response = await naturopathyAPI.sendMessage(sessionId, userMessage);
      
      // Backend returns AssessmentResponse: { session_id, step, message, is_complete, report, safety_flags, need_practitioner }
      if (response.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      }
      
      if (response.step) setStep(response.step);
      if (response.safety_flags?.length) setSafetyFlags(response.safety_flags);
      if (response.need_practitioner) setNeedsPractitioner(true);
      if (response.is_complete) {
        setIsComplete(true);
        if (response.report) setReport(response.report);
      }
      
    } catch(err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my nature network. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--cream)', flexDirection: 'row' }}>
      {/* Sidebar - Desktop */}
      <div style={{ width: '300px', borderRight: '1px solid var(--cream-dark)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Leaf color="var(--forest)" /> NatureCure
        </h2>
        <AssessmentProgress currentStep={step} />
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {safetyFlags && <SafetyAlert flags={safetyFlags} />}

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '0.5rem'
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Leaf size={20} color="var(--cream)" />
                </div>
              )}
              
              <div style={{
                maxWidth: '70%',
                padding: '1rem 1.5rem',
                borderRadius: '1.5rem',
                borderBottomLeftRadius: msg.role === 'assistant' ? 0 : '1.5rem',
                borderBottomRightRadius: msg.role === 'user' ? 0 : '1.5rem',
                background: msg.role === 'user' ? 'var(--gold-light)' : 'rgba(255,255,255,0.8)',
                color: msg.role === 'user' ? 'var(--forest-dark)' : 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)',
                lineHeight: 1.5
              }}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          
          {isTyping && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={20} color="var(--cream)" />
              </div>
              <div className="glass-card" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '4px' }}>
                <div style={{ width: 8, height: 8, background: 'var(--forest)', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out both' }}></div>
                <div style={{ width: 8, height: 8, background: 'var(--forest)', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                <div style={{ width: 8, height: 8, background: 'var(--forest)', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          
          {isComplete && report && <RecommendationCard report={report} needsPractitioner={needsPractitioner} />}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '2rem', borderTop: '1px solid var(--cream-dark)', background: 'var(--cream)' }}>
          <div style={{ display: 'flex', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Describe your symptoms in detail..."
              style={{
                flex: 1,
                padding: '1rem 1.5rem',
                borderRadius: '2rem',
                border: '1px solid var(--sage)',
                outline: 'none',
                fontSize: '1rem',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
            />
            <button 
              onClick={handleSend}
              className="btn-primary"
              style={{ width: '3.5rem', height: '3.5rem', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
