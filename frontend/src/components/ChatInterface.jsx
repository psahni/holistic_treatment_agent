import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Leaf, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { naturopathyAPI } from '../services/api';
import AssessmentProgress from './AssessmentProgress';
import RecommendationCard from './RecommendationCard';
import SafetyAlert from './SafetyAlert';
import Loader from './Loader';
import AuthModal from './AuthModal';
import BentoRemedyGrid from './BentoRemedyGrid';
import SymptomChips from './SymptomChips';
import { parseRemedyContent } from '../lib/parseRemedyContent';

export default function ChatInterface({ sessionId, user, initialMode = 'question' }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(sessionId !== 'new' ? sessionId : null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState('intake');
  const [isComplete, setIsComplete] = useState(false);
  const [safetyFlags, setSafetyFlags] = useState(null);
  const [report, setReport] = useState(null);
  const [needsPractitioner, setNeedsPractitioner] = useState(false);
  
  // Custom states for Treatment Mode & Auth Gating
  const [mode, setMode] = useState(initialMode);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showTransitionPrompt, setShowTransitionPrompt] = useState(false);
  const [suggestedModeSwitch, setSuggestedModeSwitch] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState(null);
  const [caseId, setCaseId] = useState(null);
  const [formResponses, setFormResponses] = useState({
    response_1: '',
    response_2: '',
    response_3: '5',
    response_4: '',
    response_5: '',
    response_6: '',
    response_7: '',
    response_8: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formStep, setFormStep] = useState(1);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [autofillNotice, setAutofillNotice] = useState('');
  
  const endOfMessagesRef = useRef(null);
  const lastTurnRef = useRef(null);
  const chatScrollContainerRef = useRef(null);

  useEffect(() => {
    if (sessionId === 'new' && !activeSessionId) {
      startNewSession();
    } else if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: 'Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today.' }]);
    }
    
    if (user?.loggedInUser) {
      setCurrentUser(user.loggedInUser);
    }

    // Hydrate assessment form draft from browser localStorage
    try {
      const savedDraft = localStorage.getItem('naturecure_intake_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          const hasContent = Object.entries(parsed).some(([k, v]) => k !== 'response_3' && typeof v === 'string' && v.trim());
          if (hasContent) {
            setFormResponses(prev => ({ ...prev, ...parsed }));
            setHasSavedDraft(true);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved intake draft:', e);
    }
  }, []);

  const updateFormResponse = (field, value) => {
    setFormResponses(prev => {
      const next = { ...prev, [field]: value };
      try {
        localStorage.setItem('naturecure_intake_draft', JSON.stringify(next));
        setHasSavedDraft(true);
      } catch (e) {}
      return next;
    });
  };

  const handleAutofillIntake = () => {
    const sample = {
      response_1: 'Chronic acid reflux, burning sensation in upper chest, and stomach bloating after meals.',
      response_2: 'About 6 months, worsening with work stress and late dinners',
      response_3: '6',
      response_4: 'Mild seasonal pollen allergies. No history of hypertension, surgeries, or cardiac issues.',
      response_5: 'Occasional calcium antacids, daily Vitamin B-complex.',
      response_6: 'Vegetarian diet, irregular dinner timings, high tea intake and evening fried snacks.',
      response_7: '6 hours disturbed sleep, desk-bound sedentary office job, moderate daily stress.',
      response_8: 'Pollen and dust allergies. Not pregnant.'
    };
    setFormResponses(sample);
    setFormError('');
    setAutofillNotice('Sample assessment details autofilled & saved to browser memory!');
    try {
      localStorage.setItem('naturecure_intake_draft', JSON.stringify(sample));
      setHasSavedDraft(true);
    } catch (e) {}
    setTimeout(() => setAutofillNotice(''), 3000);
  };

  const handleClearIntake = () => {
    const empty = {
      response_1: '',
      response_2: '',
      response_3: '5',
      response_4: '',
      response_5: '',
      response_6: '',
      response_7: '',
      response_8: ''
    };
    setFormResponses(empty);
    setFormError('');
    setAutofillNotice('Assessment form cleared.');
    try {
      localStorage.removeItem('naturecure_intake_draft');
      setHasSavedDraft(false);
    } catch (e) {}
    setTimeout(() => setAutofillNotice(''), 2500);
  };

  const checkCaseReviewStatus = async () => {
    if (!activeSessionId) return;
    try {
      const historyRes = await naturopathyAPI.getPatientHistory();
      const matchedCase = historyRes.cases.find(c => c.session_id === activeSessionId);
      if (matchedCase) {
        setCaseId(matchedCase.case_id);
        if (matchedCase.status === 'reviewed') {
          setReviewStatus('reviewed');
          const detailsRes = await naturopathyAPI.getPatientCaseDetails(matchedCase.case_id);
          setPrescription(detailsRes.doctor_prescription);
          setDoctorNotes(detailsRes.doctor_notes);
        } else {
          setReviewStatus('pending_review');
        }
      }
    } catch (e) {
      console.warn("Failed to check case review status:", e);
    }
  };

  useEffect(() => {
    if (activeSessionId && currentUser) {
      checkCaseReviewStatus();
    }
  }, [activeSessionId, currentUser]);

  useEffect(() => {
    if (isComplete && mode === 'treatment' && currentUser) {
      checkCaseReviewStatus();
    }
  }, [isComplete, currentUser]);

  const startNewSession = async () => {
    setIsTyping(true);
    try {
      const response = await naturopathyAPI.startSession({
        name: user?.name || 'User',
        age: user?.age || 30,
        region: user?.region || 'Not specified',
        gender: user?.gender || 'other'
      });
      setActiveSessionId(response.session_id);
      if (response.message) {
        setMessages([{ role: 'assistant', content: response.message }]);
      } else {
        setMessages([{ role: 'assistant', content: 'Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today.' }]);
      }
    } catch(err) {
      console.error(err);
      setMessages([{ role: 'assistant', content: "I'm having trouble connecting to my nature network. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAuthSuccess = async () => {
    setIsAuthModalOpen(false);
    try {
      const userData = await naturopathyAPI.getMe();
      setCurrentUser(userData);
      
      if (sessionStorage.getItem("pending_mode_switch") === "treatment") {
        setShowTransitionPrompt(true);
      }
    } catch (e) {
      console.error("Failed to sync authenticated user:", e);
    }
  };

  const handleConfirmTransition = async () => {
    if (!currentUser) {
      sessionStorage.setItem("pending_mode_switch", "treatment");
      setIsAuthModalOpen(true);
      setShowTransitionPrompt(false);
      return;
    }

    setShowTransitionPrompt(false);
    setSuggestedModeSwitch(false);
    sessionStorage.removeItem("pending_mode_switch");
    setMode('treatment');
    setFormStep(1);
    setIsTyping(true);
    
    try {
      const reply = await naturopathyAPI.sendMessage(activeSessionId, "I want to start the full treatment assessment", "treatment");
      if (reply.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply.message }]);
      }
      if (reply.step) setStep(reply.step);
      if (reply.is_complete || reply.assessment_complete) {
        setIsComplete(true);
        if (reply.report) setReport(reply.report);
        setTimeout(checkCaseReviewStatus, 1000);
      }
    } catch (err) {
      console.error("Failed to transition session mode:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCancelTransition = () => {
    setShowTransitionPrompt(false);
    setSuggestedModeSwitch(false);
    sessionStorage.removeItem("pending_mode_switch");
    setMessages(prev => [...prev, { role: 'assistant', content: "Understood. We will continue in Question Mode. How else can I assist you today?" }]);
  };

  const handleFormSubmit = async () => {
    setFormSubmitting(true);
    setFormError('');
    
    // Quick validation
    if (!formResponses.response_1.trim() || !formResponses.response_2.trim() || !formResponses.response_4.trim()) {
      setFormError("Please fill out all required clinical history fields.");
      setFormSubmitting(false);
      return;
    }
    
    try {
      const reply = await naturopathyAPI.submitIntake(activeSessionId, formResponses);
      if (reply.step) setStep(reply.step);
      if (reply.is_complete || reply.assessment_complete) {
        setIsComplete(true);
        if (reply.report) setReport(reply.report);
        // Redirect the user to the history page where they can see the pending case
        router.push('/history');
      }
    } catch (err) {
      console.error("Failed to submit intake form:", err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setFormError(detail);
      } else {
        setFormError("Failed to process form submission. Please try again.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  useEffect(() => {
    // When assistant message finishes rendering, anchor the user's question near the top so question + card are in view
    if (!isTyping && messages.length > 1) {
      const timer = setTimeout(() => {
        if (lastTurnRef.current) {
          lastTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (isTyping) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isComplete]);

  const handleSend = async (customMessage = null) => {
    const textToSend = customMessage !== null ? customMessage : input;
    if (!textToSend?.trim()) return;
    
    const userMessage = textToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    
    try {
      const reply = await naturopathyAPI.sendMessage(activeSessionId, userMessage, mode);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: reply.message || reply.reply }]);
      
      if (reply.step) setStep(reply.step);
      if (reply.safety_flags?.length) setSafetyFlags(reply.safety_flags);
      if (reply.need_practitioner) setNeedsPractitioner(true);
      if (reply.recommended_mode === "treatment") {
        setSuggestedModeSwitch(true);
        sessionStorage.setItem("pending_mode_switch", "treatment");
      }
      if (reply.is_complete || reply.assessment_complete) {
        setIsComplete(true);
        if (reply.report) setReport(reply.report);
        if (mode === 'treatment') {
          setTimeout(checkCaseReviewStatus, 1500);
        }
      }
    } catch(err) {
      console.error(err);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my nature network. Please try again." }]);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--cream)', flexDirection: 'column' }}>
      {/* Sleek Top Navigation Bar */}
      <header style={{
        height: '60px',
        borderBottom: '1px solid var(--cream-dark)',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        flexShrink: 0,
        zIndex: 10
      }}>
        {/* Left: Brand Logo */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          onClick={() => { window.location.href = '/'; }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={16} color="#ffffff" />
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--forest-dark)', letterSpacing: '-0.3px' }}>
            NatureCure
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginLeft: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            AI
          </span>
        </div>

        {/* Center: Mode Indicator Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '20px',
          background: mode === 'treatment' ? 'var(--gold-light)' : 'var(--cream)',
          border: `1px solid ${mode === 'treatment' ? 'var(--gold)' : 'var(--sage)'}`,
          fontSize: '0.775rem',
          fontWeight: 600,
          color: mode === 'treatment' ? 'var(--forest-dark)' : 'var(--forest)'
        }}>
          <span>{mode === 'treatment' ? '🏥' : '🌿'}</span>
          <span>{mode === 'treatment' ? 'Clinical Treatment Mode' : 'Instant Holistic Query'}</span>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href="/history"
                style={{
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  color: 'var(--forest-dark)',
                  fontWeight: 500,
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--cream-dark)',
                  background: 'var(--white)'
                }}
              >
                📋 My Cases
              </a>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--forest-dark)',
                padding: '4px 10px',
                borderRadius: '16px',
                background: 'var(--cream)',
                border: '1px solid var(--cream-dark)'
              }}>
                👤 {currentUser.name || 'Patient'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                background: 'var(--white)',
                border: '1px solid var(--card-border)',
                borderRadius: '16px',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--forest-dark)',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => { window.location.href = '/'; }}
            title="Start fresh session"
            style={{
              background: 'transparent',
              border: '1px solid var(--cream-dark)',
              borderRadius: '16px',
              padding: '5px 10px',
              fontSize: '0.775rem',
              fontWeight: 500,
              color: 'var(--text-light)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} /> New
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {safetyFlags && <SafetyAlert flags={safetyFlags} />}

        <div 
          ref={chatScrollContainerRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '1.5rem 1.5rem 2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '1.25rem' 
          }}
        >
          {/* If Treatment Mode, show the horizontal 4-step progress tracker above the intake form */}
          {mode === 'treatment' && !isComplete && (
            <AssessmentProgress currentStep={step} variant="horizontal" />
          )}
          {mode === 'treatment' && !isComplete ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{
                padding: '2.5rem',
                border: '1px solid var(--cream-dark)',
                background: 'var(--white)',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-md)',
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--cream-dark)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ color: 'var(--forest-dark)', margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>
                    📋 Comprehensive Health Intake
                  </h3>
                  {hasSavedDraft && (
                    <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
                      Saved in browser memory
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleAutofillIntake}
                    title="Autofill realistic sample assessment details"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: 'var(--cream)',
                      border: '1.5px solid var(--forest)',
                      color: 'var(--forest)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ✨ Autofill Details
                  </button>
                  {hasSavedDraft && (
                    <button
                      type="button"
                      onClick={handleClearIntake}
                      title="Clear form inputs"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '20px',
                        background: 'transparent',
                        border: '1px solid var(--cream-dark)',
                        color: 'var(--text-light)',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Clear
                    </button>
                  )}
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--forest)', background: 'var(--cream)', padding: '6px 12px', borderRadius: '20px' }}>
                    Step {formStep} of 3
                  </span>
                </div>
              </div>

              {autofillNotice && (
                <div style={{ padding: '0.6rem 1rem', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✓</span> {autofillNotice}
                </div>
              )}

              {/* Progress Bar indicator */}
              <div style={{ width: '100%', height: '4px', background: 'var(--cream-dark)', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
                <div style={{ width: `${(formStep / 3) * 100}%`, height: '100%', background: 'var(--forest)', transition: 'width 0.3s ease' }} />
              </div>

              {formError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.875rem', textAlign: 'left' }}>
                  {formError}
                </div>
              )}

              {formStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                  <h4 style={{ color: 'var(--forest)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Step 1: Core Health Concerns & Severity</h4>
                  
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      1. Primary Health Concern / Symptoms *
                    </label>
                    <textarea
                      className="form-input"
                      rows="3"
                      placeholder="Describe your primary complaint (e.g. chronic bloating, fatigue, skin rashes)..."
                      required
                      value={formResponses.response_1}
                      onChange={e => updateFormResponse('response_1', e.target.value)}
                      style={{ resize: 'vertical', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                        2. Duration of Symptoms *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 5 years, 3 months"
                        required
                        value={formResponses.response_2}
                        onChange={e => updateFormResponse('response_2', e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                        3. Pain / Severity level (1-10)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={formResponses.response_3}
                          onChange={e => updateFormResponse('response_3', e.target.value)}
                          style={{ flex: 1, accentColor: 'var(--forest)' }}
                        />
                        <span style={{ fontWeight: 'bold', minWidth: '24px', textAlign: 'center', background: 'var(--cream)', padding: '4px 8px', borderRadius: '4px' }}>
                          {formResponses.response_3}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      4. Safety Check (Allergies & Pregnancy status)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="List allergies or check if pregnant (write 'None' if not applicable)..."
                      value={formResponses.response_8}
                      onChange={e => updateFormResponse('response_8', e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (!formResponses.response_1.trim() || !formResponses.response_2.trim()) {
                        setFormError("Please fill out all required core concern fields.");
                        return;
                      }
                      setFormError('');
                      setFormStep(2);
                    }}
                    style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 'bold', marginTop: '1rem' }}
                  >
                    Next: Medical & Lifestyle History
                  </button>
                </div>
              )}

              {formStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                  <h4 style={{ color: 'var(--forest)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Step 2: Medical & Lifestyle Profile</h4>

                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      5. Medical History / Past Diagnoses *
                    </label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="Any past diagnoses or existing conditions (e.g. hypothyroidism, hypertension, diabetes)..."
                      required
                      value={formResponses.response_4}
                      onChange={e => updateFormResponse('response_4', e.target.value)}
                      style={{ resize: 'vertical', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      6. Current Medications & Supplements
                    </label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="List any ongoing medications, thyroid supplements, or vitamins..."
                      value={formResponses.response_5}
                      onChange={e => updateFormResponse('response_5', e.target.value)}
                      style={{ resize: 'vertical', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      7. Dietary Habits (Appetite & Food type)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. vegetarian, high-protein, normal appetite, water intake..."
                      value={formResponses.response_6}
                      onChange={e => updateFormResponse('response_6', e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--forest-dark)' }}>
                      8. Lifestyle Habits (Sleep hours, Activity level & Stress)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 6 hours sleep, moderate stress, sedentary job..."
                      value={formResponses.response_7}
                      onChange={e => updateFormResponse('response_7', e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setFormError('');
                        setFormStep(1);
                      }}
                      style={{ flex: 1, padding: '14px', border: '1px solid var(--cream-dark)', background: 'var(--cream)', fontWeight: 'bold' }}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (!formResponses.response_4.trim()) {
                          setFormError("Please fill out your medical history.");
                          return;
                        }
                        setFormError('');
                        setFormStep(3);
                      }}
                      style={{ flex: 1, padding: '14px', fontWeight: 'bold' }}
                    >
                      Next: Review & Submit
                    </button>
                  </div>
                </div>
              )}

              {formStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                  <h4 style={{ color: 'var(--forest)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Step 3: Review Your Submitted Details</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--cream-light)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--cream-dark)' }}>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>1. Primary Concern / Symptoms</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_1}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>2. Duration</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_2}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>3. Severity</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_3} / 10</p>
                      </div>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>4. Past Medical History</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_4}</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>5. Current Medications & Supplements</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_5 || 'None listed'}</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>6. Dietary Habits</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_6 || 'None listed'}</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>7. Lifestyle Habits</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_7 || 'None listed'}</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--forest-dark)', display: 'block', fontSize: '0.85rem', textTransform: 'uppercase' }}>8. Allergies & Safety Details</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formResponses.response_8 || 'None listed'}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setFormError('');
                        setFormStep(1); // Go back to Step 1 to allow editing
                      }}
                      style={{ flex: 1, padding: '14px', border: '1px solid var(--cream-dark)', background: 'var(--cream)', fontWeight: 'bold' }}
                      disabled={formSubmitting}
                    >
                      ✏️ Edit Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleFormSubmit}
                      style={{ flex: 1, padding: '14px', fontWeight: 'bold' }}
                      disabled={formSubmitting}
                    >
                      {formSubmitting ? 'Submitting Case...' : 'Confirm & Submit to Doctor'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div style={{ width: '100%', maxWidth: '1080px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(() => {
                const lastUserIdx = messages.map(m => m.role).lastIndexOf('user');
                return messages.map((msg, idx) => {
                  const isAssistant = msg.role === 'assistant';
                  const parsedRemedy = isAssistant ? parseRemedyContent(msg.content) : null;
                  const isStructuredBento = Boolean(parsedRemedy && parsedRemedy.isStructured);
                  const isLastTurnUser = msg.role === 'user' && idx === lastUserIdx;

                  return (
                    <motion.div 
                      key={idx}
                      ref={isLastTurnUser ? lastTurnRef : null}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                        width: '100%',
                        scrollMarginTop: '1.25rem'
                      }}
                    >
                      {isAssistant && (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 2px 6px rgba(45, 62, 49, 0.2)' }}>
                          <Leaf size={18} color="#ffffff" />
                        </div>
                      )}
                      
                      <div 
                        data-testid={isAssistant ? "assistant-message" : "user-message"}
                        style={{
                          maxWidth: isStructuredBento ? '100%' : '75%',
                          width: isStructuredBento ? '100%' : 'auto',
                          padding: isStructuredBento ? '0' : '0.85rem 1.25rem',
                          borderRadius: isStructuredBento ? '16px' : '1.25rem',
                          borderBottomLeftRadius: isAssistant ? 0 : '1.25rem',
                          borderBottomRightRadius: msg.role === 'user' ? 0 : '1.25rem',
                          background: isStructuredBento ? 'transparent' : (msg.role === 'user' ? 'var(--gold-light)' : 'rgba(255,255,255,0.85)'),
                          color: msg.role === 'user' ? 'var(--forest-dark)' : 'var(--text-primary)',
                          boxShadow: isStructuredBento ? 'none' : 'var(--shadow-sm)',
                          lineHeight: 1.5
                      }}>
                        {isStructuredBento ? (
                          <BentoRemedyGrid 
                            data={parsedRemedy} 
                            onConsultDoctor={() => setShowTransitionPrompt(true)} 
                          />
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({node, ...props}) => <p style={{ margin: '0 0 0.5rem 0' }} {...props} />,
                              ul: ({node, ...props}) => <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }} {...props} />,
                              ol: ({node, ...props}) => <ol style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }} {...props} />,
                              li: ({node, ...props}) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                              strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: 'var(--primary-green)' }} {...props} />
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}

                        {isAssistant && idx === messages.length - 1 && suggestedModeSwitch && !isComplete && !isStructuredBento && (
                          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--sage)', textAlign: 'left' }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                              To compile a specialized clinical treatment plan and receive a verified prescription from our practitioner, please proceed to Treatment Mode.
                            </p>
                            <button 
                              data-testid="switch-to-treatment-btn"
                              onClick={() => setShowTransitionPrompt(true)}
                              className="btn btn-primary"
                              style={{ padding: '8px 16px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              🏥 Switch to Full Treatment Mode
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}

              {messages.length <= 1 && mode === 'question' && !isTyping && !isComplete && (
                <SymptomChips onSelectSymptom={(query) => handleSend(query)} />
              )}
            </div>
          )}
          
          {isTyping && (
            <div style={{ width: '100%', maxWidth: '1080px', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 2px 6px rgba(45, 62, 49, 0.2)' }}>
                <Leaf size={18} color="#ffffff" />
              </div>
              <div className="glass-card" style={{ padding: '0 1rem' }}>
                <Loader />
              </div>
            </div>
          )}
          
          {isComplete && mode === 'question' && report && (
            <RecommendationCard report={report} needsPractitioner={needsPractitioner} />
          )}

          {isComplete && mode === 'treatment' && reviewStatus !== 'reviewed' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{
                padding: '2.5rem',
                marginTop: '2rem',
                border: '2px solid var(--sage)',
                background: 'var(--white)',
                textAlign: 'center',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>⏳</div>
              <h3 style={{ color: 'var(--primary-green)', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>
                Intake Complete — Case Pending Review
              </h3>
              <p style={{ color: 'var(--text-light)', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 2rem' }}>
                Your Nature Cure health profile has been submitted successfully (<strong>Case ID: {caseId || 'Pending'}</strong>).
                Our certified AYUSH practitioner is currently reviewing your intake history.
                We will email your finalized naturopathy prescription to your registered address.
              </p>
              <button 
                onClick={checkCaseReviewStatus} 
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0 auto' }}
              >
                <RefreshCw size={16} /> Check Review Status
              </button>
            </motion.div>
          )}

          {isComplete && mode === 'treatment' && reviewStatus === 'reviewed' && prescription && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card"
              style={{
                padding: '2.5rem',
                marginTop: '2rem',
                border: '2px solid var(--gold)',
                background: 'var(--white)',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--cream-dark)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ color: 'var(--primary-green)', margin: 0, fontFamily: 'var(--font-serif)' }}>🌿 Approved Nature Cure Protocol</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Verified by Certified AYUSH N.D.</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-success" style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--success)', color: 'white', borderRadius: '20px', fontWeight: 600 }}>Approved</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>Case ID: {caseId}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <section>
                  <h3 style={{ color: 'var(--primary-green)', fontSize: '1.2rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📋 Prescribed Protocol
                  </h3>
                  <div style={{ 
                    whiteSpace: 'pre-line', 
                    background: '#fcfcf9', 
                    padding: '1.5rem', 
                    borderRadius: '8px', 
                    border: '1px dashed var(--sage)',
                    fontFamily: 'Courier New, monospace',
                    lineHeight: '1.6',
                    color: '#1a3a2a'
                  }}>
                    {prescription.prescription_text}
                  </div>
                </section>

                {prescription.safety_precautions && (
                  <section style={{ background: '#fff5f5', borderLeft: '4px solid var(--danger)', padding: '1rem 1.5rem', borderRadius: '4px' }}>
                    <h4 style={{ color: 'var(--danger)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ Safety & Precautions
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.925rem', color: '#742a2a', lineHeight: '1.5' }}>
                      {prescription.safety_precautions}
                    </p>
                  </section>
                )}

                {doctorNotes && (
                  <section>
                    <h4 style={{ color: 'var(--primary-green)', margin: '0 0 0.5rem 0' }}>🧑‍⚕️ Practitioner Notes</h4>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {doctorNotes}
                    </p>
                  </section>
                )}

                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => window.print()}>Print / Download PDF</button>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        {!(mode === 'treatment' && !isComplete) && (
          <div style={{ padding: '0.85rem 2rem', borderTop: '1px solid var(--card-border)', background: 'var(--bg-color)' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'var(--white)',
                borderRadius: '2rem',
                border: '1.5px solid var(--card-border)',
                padding: '0.5rem 0.5rem 0.5rem 1.5rem',
                boxShadow: '0 2px 12px rgba(72, 99, 59, 0.07)',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = 'var(--primary-green)';
                  e.currentTarget.style.boxShadow = '0 2px 16px rgba(72, 99, 59, 0.15)';
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(72, 99, 59, 0.07)';
                }}
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Describe your symptoms in detail…"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '0.95rem',
                    color: 'var(--text-main)',
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.5,
                    padding: '0.5rem 0',
                  }}
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    flexShrink: 0,
                    width: '2.75rem',
                    height: '2.75rem',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    background: input.trim() ? 'var(--primary-green)' : 'var(--card-border)',
                    color: 'var(--white)',
                    transition: 'background 0.2s ease, transform 0.15s ease',
                    boxShadow: input.trim() ? '0 2px 8px rgba(72, 99, 59, 0.25)' : 'none',
                  }}
                  onMouseEnter={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>

      {showTransitionPrompt && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '550px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🏥</div>
            <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--primary-green)' }}>
              Full Treatment Mode Suggested
            </h3>
            
            <div style={{ textAlign: 'left', marginBottom: '2rem', color: 'var(--text-light)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <p style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-dark)' }}>
                This particular health concern requires formal Naturopathy Treatment.
              </p>
              
              <div style={{ padding: '1rem', background: 'rgba(74, 93, 76, 0.05)', borderRadius: '0.5rem', borderLeft: '3px solid var(--forest)', marginBottom: '1rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--forest)' }}>What is Full Treatment Mode?</strong>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>You will complete a guided clinical intake assessment.</li>
                  <li style={{ marginBottom: '0.5rem' }}>Your detailed case history is securely sent to a certified AYUSH Naturopathy practitioner.</li>
                  <li>The practitioner reviews your profile and writes a custom, licensed clinical prescription and routine plan. This is emailed to you and accessible on this portal.</li>
                </ul>
              </div>
              
              <p style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-dark)', marginTop: '1.5rem' }}>
                Do you want to proceed to Full Treatment Mode?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={handleConfirmTransition} 
                className="btn btn-primary"
                style={{ padding: '12px 24px', flex: 1, fontWeight: 'bold' }}
              >
                Yes, Proceed
              </button>
              <button 
                onClick={handleCancelTransition} 
                className="btn btn-secondary"
                style={{ padding: '12px 24px', flex: 1, border: '1px solid var(--cream-dark)', fontWeight: 'bold' }}
              >
                No, Stay in Question Mode
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          sessionStorage.removeItem("pending_mode_switch");
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
