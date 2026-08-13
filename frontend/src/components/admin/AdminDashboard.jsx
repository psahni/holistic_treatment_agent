import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Search, Play, RefreshCw, LogOut, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock, User, FileText, Send, Plus, Edit3, Sparkles, BookOpen, X, Save } from 'lucide-react';
import { naturopathyAPI } from '../../services/api';

export default function AdminDashboard({ onLogout }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [ingestionState, setIngestionState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [llmAnswer, setLlmAnswer] = useState('');
  const [llmError, setLlmError] = useState('');
  const [searching, setSearching] = useState(false);
  const [chunksOpen, setChunksOpen] = useState(false);
  
  // Custom practitioner console states
  const [activeTab, setActiveTab] = useState('rag'); // 'rag', 'practitioner', or 'templates'
  const [pendingCases, setPendingCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({ prescription_text: '', safety_precautions: '', doctor_notes: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Template states
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  
  // Template management states (for the Templates tab)
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', category: '', prescription_text: '', safety_precautions: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    if (activeTab === 'practitioner') {
      fetchPendingCases();
      fetchTemplates();
    } else if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab]);

  // ─── Template APIs ─────────────────────────────────
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await naturopathyAPI.getTemplates();
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleApplyTemplate = (template) => {
    setPrescriptionForm(prev => ({
      ...prev,
      prescription_text: template.prescription_text,
      safety_precautions: template.safety_precautions || ''
    }));
  };

  const handleGenerateAI = async () => {
    if (!selectedCase) return;
    if (!confirm('This will use AI to generate a prescription for this case. This may take 15-30 seconds. Continue?')) return;
    
    setGeneratingAI(true);
    try {
      const res = await naturopathyAPI.generateAIPrescription(selectedCase.session_id);
      setPrescriptionForm(prev => ({
        ...prev,
        prescription_text: res.prescription_text || prev.prescription_text,
        safety_precautions: res.safety_precautions || prev.safety_precautions
      }));
    } catch (err) {
      console.error("AI generation failed:", err);
      alert("AI generation failed. Please try again or use a template.");
    } finally {
      setGeneratingAI(false);
    }
  };

  // ─── Template CRUD (Templates tab) ────────────────
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.category.trim() || !templateForm.prescription_text.trim()) {
      alert("Please fill in all required fields (Name, Category, Prescription Text).");
      return;
    }
    setSavingTemplate(true);
    try {
      await naturopathyAPI.createTemplate(templateForm);
      setTemplateForm({ name: '', category: '', prescription_text: '', safety_precautions: '' });
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to create template:", err);
      alert("Failed to create template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      await naturopathyAPI.updateTemplate(editingTemplate.id, templateForm);
      setEditingTemplate(null);
      setTemplateForm({ name: '', category: '', prescription_text: '', safety_precautions: '' });
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to update template:", err);
      alert("Failed to update template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;
    try {
      await naturopathyAPI.deleteTemplate(id);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to delete template:", err);
      alert("Failed to delete template.");
    }
  };

  const startEditTemplate = (t) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      category: t.category,
      prescription_text: t.prescription_text,
      safety_precautions: t.safety_precautions || ''
    });
    setShowTemplateForm(true);
  };

  const startNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', category: '', prescription_text: '', safety_precautions: '' });
    setShowTemplateForm(true);
  };

  // ─── Practitioner Console ─────────────────────────
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
      
      // Start with empty form — doctor picks a template or generates with AI
      setPrescriptionForm({
        prescription_text: '',
        safety_precautions: '',
        doctor_notes: ''
      });
    } catch (err) {
      console.error("Failed to fetch case details:", err);
      alert("Failed to load case details.");
    } finally {
      setLoadingDetails(false);
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

  // ─── RAG Document Management (unchanged) ──────────
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
    
    const eventSource = new EventSource(`http://localhost:8080/api/admin/ingest/${filename}?t=${Date.now()}`, {
      withCredentials: true
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

  // ─── Category badge colors ────────────────────────
  const categoryColors = {
    'Heart Disease': { bg: '#fde2e2', color: '#c53030' },
    'Arthritis': { bg: '#e9d8fd', color: '#6b46c1' },
    'Eye Problem': { bg: '#bee3f8', color: '#2b6cb0' },
    'Body Pain': { bg: '#fefcbf', color: '#975a16' },
  };
  const getCategoryStyle = (cat) => categoryColors[cat] || { bg: '#e2e8f0', color: '#4a5568' };

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
        {['rag', 'practitioner', 'templates'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)} 
            style={{ 
              padding: '16px 24px', 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === tab ? '3px solid var(--forest)' : 'none', 
              color: activeTab === tab ? 'var(--forest)' : '#666',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {tab === 'rag' ? 'RAG Knowledge Base' : tab === 'practitioner' ? 'Practitioner Console' : '📋 Manage Templates'}
          </button>
        ))}
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
                    {llmError && (
                      <div className="llm-error-banner">
                        <span className="llm-error-icon">⚠</span> {llmError}
                      </div>
                    )}

                    {llmAnswer && (
                      <div className="llm-answer-box">
                        <div className="llm-answer-header">
                          <span className="llm-answer-label">✦ AI Answer</span>
                        </div>
                        <p className="llm-answer-text">{llmAnswer}</p>
                      </div>
                    )}

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

        ) : activeTab === 'templates' ? (
          /* ═══════════════════════════════════════════════
             TEMPLATE MANAGEMENT TAB
             ═══════════════════════════════════════════════ */
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--forest)' }}>Prescription Templates</h2>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.9rem' }}>
                  Create and manage reusable AYUSH prescription templates. These appear in the Practitioner Console for quick case approvals.
                </p>
              </div>
              <button className="admin-btn-primary" onClick={startNewTemplate} style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 20px' }}>
                <Plus size={16} /> New Template
              </button>
            </div>

            {/* Template Form (Create/Edit) */}
            {showTemplateForm && (
              <section className="admin-card" style={{ marginBottom: '24px', border: '2px solid var(--forest)', position: 'relative' }}>
                <button 
                  onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }} 
                  style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                >
                  <X size={20} />
                </button>
                <h3 style={{ margin: '0 0 16px', color: 'var(--forest)' }}>
                  {editingTemplate ? `✏️ Edit: ${editingTemplate.name}` : '➕ Create New Template'}
                </h3>
                <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>Template Name *</label>
                      <input 
                        type="text"
                        required
                        value={templateForm.name}
                        onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="e.g. Heart Disease — Cardiovascular Protocol"
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>Category *</label>
                      <input 
                        type="text"
                        required
                        value={templateForm.category}
                        onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                        placeholder="e.g. Heart Disease, Arthritis, Eye Problem"
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>Prescription Text *</label>
                    <textarea
                      required
                      value={templateForm.prescription_text}
                      onChange={e => setTemplateForm({ ...templateForm, prescription_text: e.target.value })}
                      placeholder="Full AYUSH protocol including herbal medicines, dietary guidelines, lifestyle modifications..."
                      style={{ width: '100%', height: '240px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>Safety Precautions & Red Flags</label>
                    <textarea
                      value={templateForm.safety_precautions}
                      onChange={e => setTemplateForm({ ...templateForm, safety_precautions: e.target.value })}
                      placeholder="Contraindications, drug interactions, warnings..."
                      style={{ width: '100%', height: '80px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', resize: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" className="admin-btn-outline" onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}>
                      Cancel
                    </button>
                    <button type="submit" className="admin-btn-primary" disabled={savingTemplate} style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 20px' }}>
                      {savingTemplate ? <RefreshCw size={14} className="spin-icon" /> : <Save size={14} />}
                      {savingTemplate ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Template List */}
            {loadingTemplates ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
                <RefreshCw className="spin-icon" size={28} />
                <p>Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px', color: '#888', background: '#fafaf9', borderRadius: '12px', border: '1px solid #eee' }}>
                <BookOpen size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h3 style={{ margin: '0 0 8px', color: '#555' }}>No Templates Yet</h3>
                <p>Create your first prescription template to speed up case approvals.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {templates.map(t => {
                  const catStyle = getCategoryStyle(t.category);
                  return (
                    <section key={t.id} className="admin-card" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--forest-dark)' }}>{t.name}</h3>
                            <span style={{
                              background: catStyle.bg, color: catStyle.color,
                              padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
                            }}>
                              {t.category}
                            </span>
                          </div>
                          <pre style={{ 
                            margin: '8px 0', padding: '12px', background: '#f5f7f5', borderRadius: '6px',
                            fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            maxHeight: '120px', overflowY: 'auto', border: '1px solid #eee'
                          }}>
                            {t.prescription_text.substring(0, 300)}{t.prescription_text.length > 300 ? '...' : ''}
                          </pre>
                          {t.safety_precautions && (
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#c05621', background: '#fff8f1', padding: '6px 10px', borderRadius: '4px', display: 'inline-block' }}>
                              ⚠️ {t.safety_precautions.substring(0, 150)}{t.safety_precautions.length > 150 ? '...' : ''}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                          <button 
                            className="admin-btn-outline btn-small" 
                            onClick={() => startEditTemplate(t)}
                            style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                          <button 
                            className="admin-btn-outline btn-small" 
                            onClick={() => handleDeleteTemplate(t.id)}
                            style={{ display: 'flex', gap: '4px', alignItems: 'center', color: '#e53e3e', borderColor: '#e53e3e' }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

        ) : (
          /* ═══════════════════════════════════════════════
             PRACTITIONER CONSOLE TAB
             ═══════════════════════════════════════════════ */
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

                  {/* Patient Intake Transcript */}
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>💬 Patient Intake Transcript</h3>
                    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', maxHeight: '300px', overflowY: 'auto', background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                  {/* Prescription Form */}
                  <form onSubmit={handleSubmitApproval} style={{ borderTop: '1px solid #ddd', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🧑‍⚕️ Issue Official AYUSH Prescription</h3>
                    
                    {/* Template Selector + AI Generate */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '6px' }}>
                          Load from Template:
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {loadingTemplates ? (
                            <span style={{ fontSize: '0.85rem', color: '#888' }}>Loading templates...</span>
                          ) : templates.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: '#888' }}>No templates available.</span>
                          ) : (
                            templates.map(t => {
                              const catStyle = getCategoryStyle(t.category);
                              return (
                                <button 
                                  key={t.id}
                                  type="button" 
                                  className="admin-btn-outline btn-small" 
                                  onClick={() => handleApplyTemplate(t)}
                                  title={t.name}
                                  style={{ 
                                    fontSize: '0.8rem', padding: '6px 12px',
                                    borderColor: catStyle.color,
                                    color: catStyle.color,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {t.category}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={generatingAI}
                        style={{ 
                          display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 16px',
                          background: generatingAI ? '#f0f0f0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: generatingAI ? '#888' : '#fff', border: 'none', borderRadius: '6px',
                          fontWeight: 600, fontSize: '0.85rem', cursor: generatingAI ? 'wait' : 'pointer',
                          opacity: generatingAI ? 0.7 : 1
                        }}
                      >
                        {generatingAI ? <RefreshCw size={14} className="spin-icon" /> : <Sparkles size={14} />}
                        {generatingAI ? 'Generating...' : 'Generate with AI'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>Naturopathy Protocol Plan (Text)</label>
                        <textarea 
                          required
                          value={prescriptionForm.prescription_text}
                          onChange={e => setPrescriptionForm({...prescriptionForm, prescription_text: e.target.value})}
                          style={{ width: '100%', height: '180px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                          placeholder="Write or select a template above. You can edit the text before approving."
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
