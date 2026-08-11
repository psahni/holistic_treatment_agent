import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Search, Play, RefreshCw, LogOut, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock, User, FileText, Send } from 'lucide-react';
import { naturopathyAPI } from '../../services/api';

export default function AdminDashboard({ onLogout }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [ingestionState, setIngestionState] = useState(null); // { filename, progress, message, status }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [llmAnswer, setLlmAnswer] = useState('');
  const [llmError, setLlmError] = useState('');
  const [searching, setSearching] = useState(false);
  const [chunksOpen, setChunksOpen] = useState(false);
  
  // Custom practitioner console states
  const [activeTab, setActiveTab] = useState('rag'); // 'rag' or 'practitioner'
  const [pendingCases, setPendingCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({ prescription_text: '', safety_precautions: '', doctor_notes: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    if (activeTab === 'practitioner') {
      fetchPendingCases();
    }
  }, [activeTab]);

  const fetchPendingCases = async () => {
    setLoadingCases(true);
    try {
      const res = await naturopathyAPI.getPendingCases();
      setPendingCases(res.cases || []);
    } catch (err) {
      console.error("Failed to fetch pending cases:", err);
    } finally {
      setLoadingCases(false);
    }
  };

  const handleSelectCase = async (caseRecord) => {
    setLoadingDetails(true);
    setSelectedCase(null);
    try {
      const res = await naturopathyAPI.getAdminCaseDetails(caseRecord.session_id);
      setSelectedCase(res);
      
      // Auto-fill template editor with AI suggestion initially
      const protocols = res.protocols_recommended || {};
      setPrescriptionForm({
        prescription_text: protocols.daily_routine ? 
          `Daily Routine: ${protocols.daily_routine}\n\nDiet Recommended: ${protocols.diet_guidelines?.recommended_foods?.join(', ') || ''}` : 
          'No AI recommendation generated.',
        safety_precautions: protocols.red_flags?.join(', ') || '',
        doctor_notes: ''
      });
    } catch (err) {
      console.error("Failed to fetch case details:", err);
      alert("Failed to load case details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const templates = {
    digestive: {
      text: "🌿 Digestive Cleanse Protocol:\n- Morning: Ash gourd juice (150ml) on empty stomach.\n- Meals: Fruit pack for breakfast, raw salads prior to steam-cooked lunch.\n- Evening: Cold hip bath (15 mins).\n- Avoid: Processed flour, sugar, animal protein.",
      safety: "Discontinue if abdominal pain or acute diarrhea occurs."
    },
    fatigue: {
      text: "🌿 Chronic Fatigue Restore Protocol:\n- Morning: Hydrotherapy warm foot bath + Epsom salt soak (20 mins).\n- Nutrition: Wheatgrass juice (30ml), focus on green sprouts and alkaline minerals.\n- Activity: Gentle pranayama (Nadi Shodhana) 15m, outdoor walking.\n- Sleep: Digital detox by 9 PM.",
      safety: "Avoid heavy cardiovascular exertion."
    },
    skin: {
      text: "🌿 Skin Detox & Eczema Protocol:\n- Morning: Neempill or fresh neem juice (10ml).\n- Therapy: Wet sheet pack over affected area (30 mins).\n- Diet: Strictly salt-free raw juice diet for first 3 days, followed by raw fruits.\n- Avoid: Dairy, nightshade vegetables, gluten.",
      safety: "Ensure skin moisturized with pure coconut oil."
    },
    hypertension: {
      text: "🌿 Cardio Hypertension Protocol:\n- Diet: Dash-style low sodium diet. Salt-free raw celery juice (100ml) daily.\n- Therapy: Cold spinal spray (10 mins).\n- Relaxation: Yoga Nidra (20 mins daily).\n- Avoid: Added salts, red meat, caffeine.",
      safety: "Monitor blood pressure twice daily. Consult physician if systolic exceeds 160."
    }
  };
  
  const handleApplyTemplate = (type) => {
    const selected = templates[type];
    if (selected) {
      setPrescriptionForm(prev => ({
        ...prev,
        prescription_text: selected.text,
        safety_precautions: selected.safety
      }));
    }
  };

  const handleSubmitApproval = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSubmittingReview(true);
    try {
      await naturopathyAPI.approveCase(selectedCase.session_id, prescriptionForm);
      alert("Prescription submitted successfully! Patient has been emailed.");
      setSelectedCase(null);
      setPrescriptionForm({ prescription_text: '', safety_precautions: '', doctor_notes: '' });
      await fetchPendingCases();
    } catch (err) {
      console.error("Approval failed:", err);
      alert("Failed to submit approval.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const fetchDocs = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/admin/docs', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDocs(data.docs || []);
      }
    } catch (err) {
      console.error("Failed to fetch docs:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8080/api/admin/logout', { method: 'POST', credentials: 'include' });
      onLogout();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert("Only PDF files are allowed.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8080/api/admin/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (res.ok) {
        await fetchDocs();
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.detail}`);
      }
    } catch (err) {
      alert("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete ${filename}? This will remove it from the database.`)) return;
    
    try {
      const res = await fetch(`http://localhost:8080/api/admin/docs/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchDocs();
      } else {
        alert("Delete failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIngest = (filename) => {
    setIngestionState({ filename, progress: 0, message: 'Connecting...', status: 'starting' });
    
    // We append a timestamp to bypass browser SSE caching if any
    const eventSource = new EventSource(`http://localhost:8080/api/admin/ingest/${filename}?t=${Date.now()}`, {
      withCredentials: true // Note: standard EventSource doesn't fully support custom headers, but backend doesn't mandate auth for SSE yet or we assume it works via cookie
    });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setIngestionState(prev => ({ ...prev, progress: data.progress || prev.progress, message: data.message, status: data.status }));
      
      if (data.status === 'complete' || data.status === 'error') {
        eventSource.close();
        if (data.status === 'complete') fetchDocs();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      setIngestionState(prev => ({ ...prev, status: 'error', message: 'Connection lost.' }));
      eventSource.close();
    };
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    setLlmAnswer('');
    setLlmError('');
    setSearchResults([]);
    setChunksOpen(false);
    
    try {
      const res = await fetch(`http://localhost:8080/api/admin/embeddings/search-with-answer?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.results || []);
        setLlmAnswer(data.answer || '');
        setLlmError(data.llm_error || '');
      } else {
        alert(data.detail || "Search failed: Rate limit exceeded or server error.");
      }
    } catch (err) {
      console.error(err);
      alert("Search failed: Network error");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <h1>Naturopathy Administration</h1>
          <button onClick={handleLogout} className="admin-btn-outline">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="admin-tabs-bar" style={{ display: 'flex', gap: '1rem', padding: '0 48px', borderBottom: '1px solid #ddd', background: '#f9f9f7' }}>
        <button 
          onClick={() => setActiveTab('rag')} 
          style={{ 
            padding: '16px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'rag' ? '3px solid var(--forest)' : 'none', 
            color: activeTab === 'rag' ? 'var(--forest)' : '#666',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          RAG Knowledge Base
        </button>
        <button 
          onClick={() => setActiveTab('practitioner')} 
          style={{ 
            padding: '16px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'practitioner' ? '3px solid var(--forest)' : 'none', 
            color: activeTab === 'practitioner' ? 'var(--forest)' : '#666',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Practitioner Console
        </button>
      </div>

      <main className="admin-main">
        {activeTab === 'rag' ? (
          <div className="admin-grid">
            
            {/* Document Management Section */}
            <section className="admin-card">
              <div className="card-header">
                <h2>Knowledge Base Documents</h2>
                <div className="upload-btn-wrapper">
                  <button className="admin-btn-primary" onClick={() => fileInputRef.current.click()} disabled={uploading}>
                    <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload PDF'}
                  </button>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Status</th>
                      <th>Chunks</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.length === 0 ? (
                      <tr><td colSpan="4" className="text-center">No documents found.</td></tr>
                    ) : docs.map(doc => (
                      <tr key={doc.filename}>
                        <td>{doc.filename}</td>
                        <td>
                          <span className={`status-badge ${doc.status === 'ingested' ? 'success' : (doc.status === 'db_error' ? 'danger' : 'pending')}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td>{doc.chunks}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="admin-btn-icon bg-green"
                              onClick={() => handleIngest(doc.filename)}
                              title="Ingest/Update"
                            >
                              <Play size={14} />
                            </button>
                            <button 
                              className="admin-btn-icon bg-red"
                              onClick={() => handleDelete(doc.filename)}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ingestion Progress UI */}
              {ingestionState && (
                <div className="ingestion-progress-box">
                  <div className="progress-header">
                    <strong>Ingesting: {ingestionState.filename}</strong>
                    {ingestionState.status === 'complete' && <CheckCircle size={16} className="text-success" />}
                    {ingestionState.status === 'error' && <AlertCircle size={16} className="text-danger" />}
                    {['starting', 'parsing', 'embedding'].includes(ingestionState.status) && <RefreshCw size={16} className="spin-icon" />}
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${ingestionState.progress || 0}%` }}></div>
                  </div>
                  <p className="progress-message">{ingestionState.message}</p>
                  {(ingestionState.status === 'complete' || ingestionState.status === 'error') && (
                    <button className="admin-btn-outline btn-small" onClick={() => setIngestionState(null)}>Close</button>
                  )}
                </div>
              )}
            </section>

            {/* Search Tester Section */}
            <section className="admin-card">
              <div className="card-header">
                <h2>Vector Search Tester</h2>
              </div>
              <form onSubmit={handleSearch} className="search-form">
                <input 
                  type="text" 
                  placeholder="Test a query..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <button type="submit" className="admin-btn-primary" disabled={searching}>
                  {searching ? <RefreshCw size={16} className="spin-icon" /> : <Search size={16} />}
                </button>
              </form>

              <div className="search-results">
                {!llmAnswer && !llmError && searchResults.length === 0 ? (
                  <p className="text-center text-light mt-4">Search results will appear here.</p>
                ) : (
                  <>
                    {/* LLM Error Banner */}
                    {llmError && (
                      <div className="llm-error-banner">
                        <span className="llm-error-icon">⚠</span> {llmError}
                      </div>
                    )}

                    {/* LLM Answer */}
                    {llmAnswer && (
                      <div className="llm-answer-box">
                        <div className="llm-answer-header">
                          <span className="llm-answer-label">✦ AI Answer</span>
                        </div>
                        <p className="llm-answer-text">{llmAnswer}</p>
                      </div>
                    )}

                    {/* Collapsible Chunks */}
                    {searchResults.length > 0 && (
                      <div className="chunks-section">
                        <button
                          className="chunks-toggle"
                          onClick={() => setChunksOpen(o => !o)}
                        >
                          <span>Retrieved Chunks ({searchResults.length})</span>
                          {chunksOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {chunksOpen && (
                          <div className="chunks-list">
                            {searchResults.map((hit, idx) => (
                              <div key={idx} className="result-item">
                                <div className="result-meta">
                                  <span className="source-tag">{hit.source} (Pg {hit.page})</span>
                                  <span className="score-tag">Score: {hit.score}</span>
                                </div>
                                <p className="result-text">{hit.text.substring(0, 150)}...</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

          </div>
        ) : (
          <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            {/* Pending Cases Queue */}
            <section className="admin-card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <h2>Pending Cases ({pendingCases.length})</h2>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {loadingCases ? (
                  <div className="text-center" style={{ padding: '2rem' }}><RefreshCw className="spin-icon" /> Loading...</div>
                ) : pendingCases.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No pending cases.</div>
                ) : (
                  pendingCases.map(c => (
                    <div 
                      key={c.session_id} 
                      onClick={() => handleSelectCase(c)}
                      style={{ 
                        padding: '16px', 
                        borderRadius: '8px', 
                        border: selectedCase?.session_id === c.session_id ? '2px solid var(--forest)' : '1px solid #ddd',
                        background: selectedCase?.session_id === c.session_id ? '#f3f6f3' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--forest)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} /> {c.patient_name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Symptoms: {c.symptoms || 'General Inquiry'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> Case ID: {c.case_id}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Case Details and Review Panel */}
            <section className="admin-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {loadingDetails ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', padding: '64px' }}>
                  <RefreshCw className="spin-icon" size={32} />
                  <span>Loading case files...</span>
                </div>
              ) : !selectedCase ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#888', padding: '64px' }}>
                  <FileText size={48} />
                  <span>Select a patient from the queue to start review</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Patient Info Header */}
                  <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ color: 'var(--forest)', margin: 0 }}>Review Case: {selectedCase.patient_name}</h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                        {selectedCase.patient_email} • {selectedCase.age} years • {selectedCase.gender} • {selectedCase.region}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-success" style={{ background: '#feebc8', color: '#c05621', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>Awaiting Review</span>
                      <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>Case ID: {selectedCase.case_id}</div>
                    </div>
                  </div>

                  {/* Chat History & AI Analysis */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>💬 Intake Transcript</h3>
                      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', height: '300px', overflowY: 'auto', background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {selectedCase.conversation_history?.map((msg, idx) => (
                          <div key={idx} style={{ 
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: msg.role === 'user' ? '#fef3c7' : '#fff',
                            border: '1px solid #e5e5e0',
                            fontSize: '0.9rem',
                            lineHeight: '1.4'
                          }}>
                            <strong>{msg.role === 'user' ? 'Patient' : 'Agent'}:</strong> {msg.content}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>🔮 AI Suggested Recommendation</h3>
                      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', height: '300px', overflowY: 'auto', background: '#f5f7f5' }}>
                        {selectedCase.protocols_recommended?.daily_routine ? (
                          <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                            <strong style={{ color: 'var(--forest)' }}>Root Causes:</strong>
                            <ul style={{ margin: '4px 0 12px 0', paddingLeft: '1.2rem' }}>
                              {selectedCase.protocols_recommended?.root_causes?.map((rc, idx) => (
                                <li key={idx}><strong>{rc.cause}</strong>: {rc.reasoning}</li>
                              ))}
                            </ul>
                            <strong style={{ color: 'var(--forest)' }}>Daily Routine:</strong>
                            <p style={{ margin: '4px 0 12px 0', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #eee' }}>{selectedCase.protocols_recommended?.daily_routine}</p>
                            
                            <strong style={{ color: 'var(--forest)' }}>Dietary Guidelines:</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '1.2rem' }}>
                              <li><strong>Foods:</strong> {selectedCase.protocols_recommended?.diet_guidelines?.recommended_foods?.join(', ')}</li>
                              <li><strong>Avoid:</strong> {selectedCase.protocols_recommended?.diet_guidelines?.foods_to_avoid?.join(', ')}</li>
                            </ul>
                          </div>
                        ) : (
                          <p style={{ color: '#888', fontStyle: 'italic' }}>No AI recommendations designed.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleSubmitApproval} style={{ borderTop: '1px solid #ddd', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🧑‍⚕️ Issue Official AYUSH Prescription</h3>
                    
                    {/* Template Quick Selectors */}
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '8px' }}>Load N.D. Baseline Template:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="admin-btn-outline btn-small" onClick={() => handleApplyTemplate('digestive')}>Digestive Cleanse</button>
                        <button type="button" className="admin-btn-outline btn-small" onClick={() => handleApplyTemplate('fatigue')}>Fatigue Restore</button>
                        <button type="button" className="admin-btn-outline btn-small" onClick={() => handleApplyTemplate('skin')}>Skin Detox</button>
                        <button type="button" className="admin-btn-outline btn-small" onClick={() => handleApplyTemplate('hypertension')}>Cardio Health</button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>Naturopathy Protocol Plan (Text)</label>
                        <textarea 
                          required
                          value={prescriptionForm.prescription_text}
                          onChange={e => setPrescriptionForm({...prescriptionForm, prescription_text: e.target.value})}
                          style={{ width: '100%', height: '180px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                          placeholder="Write therapeutic diet regimes, cold pack timelines, hydrotherapy bath guidelines..."
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>Red Flags & Contraindications</label>
                          <textarea 
                            value={prescriptionForm.safety_precautions}
                            onChange={e => setPrescriptionForm({...prescriptionForm, safety_precautions: e.target.value})}
                            style={{ width: '100%', height: '70px', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', resize: 'none', fontSize: '0.9rem' }}
                            placeholder="Things to watch out for or avoid..."
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>Doctor Confidential Notes</label>
                          <textarea 
                            value={prescriptionForm.doctor_notes}
                            onChange={e => setPrescriptionForm({...prescriptionForm, doctor_notes: e.target.value})}
                            style={{ width: '100%', height: '70px', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', resize: 'none', fontSize: '0.9rem' }}
                            placeholder="Follow up schedule, reference details..."
                          />
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="admin-btn-primary" style={{ alignSelf: 'flex-end', padding: '12px 24px', display: 'flex', gap: '8px', alignItems: 'center' }} disabled={submittingReview}>
                      {submittingReview ? <RefreshCw className="spin-icon" size={16} /> : <CheckCircle size={16} />}
                      {submittingReview ? 'Submitting...' : 'Approve & Send Prescription'}
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
