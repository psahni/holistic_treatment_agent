import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Leaf, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { naturopathyAPI } from '../services/api';
import AssessmentProgress from './AssessmentProgress';
import RecommendationCard from './RecommendationCard';
import SafetyAlert from './SafetyAlert';
import Loader from './Loader';
import AuthModal from './AuthModal';

export default function ChatInterface({ sessionId, user }) {
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
  const [mode, setMode] = useState('question');
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
  
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (sessionId === 'new' && !activeSessionId) {
      startNewSession();
    } else if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: 'Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today.' }]);
    }
    
    if (user?.loggedInUser) {
      setCurrentUser(user.loggedInUser);
    }
  }, []);

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
        // Automatically start checking for review status
        setTimeout(checkCaseReviewStatus, 1500);
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
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isComplete]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    let assistantMessageAdded = false;
    
    try {
      const stream = naturopathyAPI.streamMessage(activeSessionId, userMessage, mode);
      
      for await (const data of stream) {
        if (data.chunk) {
          if (!assistantMessageAdded) {
             setIsTyping(false);
             assistantMessageAdded = true;
             setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
          }
          
          // Smooth the typing effect by appending character by character with a tiny delay
          const chars = data.chunk.split('');
          for (let i = 0; i < chars.length; i++) {
             await new Promise(r => setTimeout(r, 8)); // 8ms per char
             setMessages(prev => {
               const newMessages = [...prev];
               const lastMsg = { ...newMessages[newMessages.length - 1] };
               lastMsg.content += chars[i];
               newMessages[newMessages.length - 1] = lastMsg;
               return newMessages;
             });
          }
        }
        
        if (data.done && data.state) {
          const response = data.state;
          // Replace final text in case of disclaimers/mode stripping
          if (response.message) {
            if (!assistantMessageAdded) {
                setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
                assistantMessageAdded = true;
                setIsTyping(false);
            } else {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = { ...newMessages[newMessages.length - 1] };
                  lastMsg.content = response.message;
                  newMessages[newMessages.length - 1] = lastMsg;
                  return newMessages;
                });
            }
          }
          if (response.step) setStep(response.step);
          if (response.safety_flags?.length) setSafetyFlags(response.safety_flags);
          if (response.need_practitioner) setNeedsPractitioner(true);
          
          if (response.recommended_mode === "treatment") {
            setSuggestedModeSwitch(true);
          }
          
          if (response.is_complete || response.assessment_complete) {
            setIsComplete(true);
            if (response.report) setReport(response.report);
            if (mode === 'treatment') {
              setTimeout(checkCaseReviewStatus, 1500);
            }
          }
        }
      }
    } catch(err) {
      console.error(err);
      setIsTyping(false);
      if (!assistantMessageAdded) {
         setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my nature network. Please try again." }]);
      } else {
         setMessages(prev => {
           const newMessages = [...prev];
           const lastMsg = { ...newMessages[newMessages.length - 1] };
           lastMsg.content += "\n\n*(Error connecting to network)*";
           newMessages[newMessages.length - 1] = lastMsg;
           return newMessages;
         });
      }
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--cream-dark)', paddingBottom: '1rem' }}>
                <h3 style={{ color: 'var(--forest-dark)', margin: 0, fontFamily: 'Playfair Display, serif', fontSize: '1.75rem' }}>
                  📋 Comprehensive Health Intake
                </h3>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--forest)', background: 'var(--cream)', padding: '6px 12px', borderRadius: '20px' }}>
                  Step {formStep} of 3
                </span>
              </div>

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
                      onChange={e => setFormResponses({ ...formResponses, response_1: e.target.value })}
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
                        onChange={e => setFormResponses({ ...formResponses, response_2: e.target.value })}
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
                          onChange={e => setFormResponses({ ...formResponses, response_3: e.target.value })}
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
                      onChange={e => setFormResponses({ ...formResponses, response_8: e.target.value })}
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
                      onChange={e => setFormResponses({ ...formResponses, response_4: e.target.value })}
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
                      onChange={e => setFormResponses({ ...formResponses, response_5: e.target.value })}
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
                      onChange={e => setFormResponses({ ...formResponses, response_6: e.target.value })}
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
                      onChange={e => setFormResponses({ ...formResponses, response_7: e.target.value })}
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
            messages.map((msg, idx) => (
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
                
                <div 
                  data-testid={msg.role === 'assistant' ? "assistant-message" : "user-message"}
                  style={{
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
                  {msg.role === 'assistant' && idx === messages.length - 1 && suggestedModeSwitch && !isComplete && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--sage)', textAlign: 'left' }}>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                        To compile a specialized clinical treatment plan and receive a verified prescription from our practitioner, please proceed to Treatment Mode.
                      </p>
                      <button 
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
            ))
          )}
          
          {isTyping && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={20} color="var(--cream)" />
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
              <h3 style={{ color: 'var(--primary-green)', marginBottom: '1rem', fontFamily: 'Playfair Display, serif' }}>
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
                  <h2 style={{ color: 'var(--primary-green)', margin: 0, fontFamily: 'Playfair Display, serif' }}>🌿 Approved Nature Cure Protocol</h2>
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
        )}
        
      </div>

      {showTransitionPrompt && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '550px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🏥</div>
            <h3 style={{ marginBottom: '1.25rem', fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', color: 'var(--primary-green)' }}>
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
