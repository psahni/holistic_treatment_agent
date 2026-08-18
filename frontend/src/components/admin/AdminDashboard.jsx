import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Search, Play, RefreshCw, LogOut, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock, User, FileText, Send, Plus, Edit3, Sparkles, BookOpen, X, Save, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({ prescription_text: '', safety_precautions: '', doctor_notes: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [doctorPrompt, setDoctorPrompt] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSampleLayout, setShowSampleLayout] = useState(false);
  const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' });
  
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
    const controller = new AbortController();
    const { signal } = controller;

    if (activeTab === 'practitioner') {
      fetchPendingCases({ signal });
      fetchTemplates({ signal });
    } else if (activeTab === 'templates') {
      fetchTemplates({ signal });
    }

    return () => {
      controller.abort();
    };
  }, [activeTab]);

  // ─── Template APIs ─────────────────────────────────
  const fetchTemplates = async (options = {}) => {
    setLoadingTemplates(true);
    try {
      const res = await naturopathyAPI.getTemplates(options);
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) {
      if (err.name === 'AbortError') return;
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
    if (!doctorPrompt.trim()) {
      alert("Please provide a prompt for the AI prescription generator.");
      return;
    }
    
    setGeneratingAI(true);
    try {
      const res = await naturopathyAPI.generateAIPrescription(selectedCase.session_id, doctorPrompt);
      setPrescriptionForm(prev => ({
        ...prev,
        prescription_text: res.prescription_text || prev.prescription_text,
        safety_precautions: res.safety_precautions || prev.safety_precautions
      }));
    } catch (err) {
      console.error("AI generation failed:", err);
      const errorMsg = err.response?.data?.detail || err.message || "AI generation failed. Please try again or use a template.";
      alert(errorMsg);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedCase) return;
    setSavingDraft(true);
    try {
      await naturopathyAPI.saveDraft(selectedCase.session_id, prescriptionForm);
      setSuccessModal({ show: true, title: "Draft Saved", message: "Your prescription draft has been saved successfully. You can return to this case later to complete it." });
      await fetchPendingCases();
    } catch (err) {
      console.error("Draft save failed:", err);
      alert("Failed to save draft.");
    } finally {
      setSavingDraft(false);
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
  const fetchPendingCases = async (options = {}) => {
    setLoadingCases(true);
    try {
      const res = await naturopathyAPI.getPendingCases(options);
      setPendingCases(res.cases || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
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
      
      // Start with loaded draft or empty form
      setPrescriptionForm({
        prescription_text: res.doctor_prescription?.prescription_text || '',
        safety_precautions: res.doctor_prescription?.safety_precautions || '',
        doctor_notes: res.doctor_notes || ''
      });
      setDoctorPrompt('');
    } catch (err) {
      console.error("Failed to fetch case details:", err);
      alert("Failed to load case details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!selectedCase) return;
    setSubmittingReview(true);
    try {
      await naturopathyAPI.approveCase(selectedCase.session_id, prescriptionForm);
      setSuccessModal({ show: true, title: "Prescription Sent", message: "Prescription submitted successfully! The patient has been emailed." });
      setShowPreviewModal(false);
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
          <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: sidebarOpen ? '320px 1fr' : '60px 1fr', gap: '24px', transition: 'grid-template-columns 0.3s ease' }}>
            {/* Pending Cases Queue */}
            <section 
              className={sidebarOpen ? "admin-card" : ""} 
              style={{ 
                maxHeight: 'calc(100vh - 200px)', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: sidebarOpen ? undefined : '0',
                background: sidebarOpen ? undefined : 'transparent',
                boxShadow: sidebarOpen ? undefined : 'none'
              }}
            >
              <div 
                className={sidebarOpen ? "card-header" : ""} 
                style={{ 
                  display: 'flex', 
                  justifyContent: sidebarOpen ? 'space-between' : 'center', 
                  alignItems: 'center', 
                  paddingBottom: sidebarOpen ? undefined : '16px', 
                  borderBottom: sidebarOpen ? undefined : 'none',
                  marginTop: sidebarOpen ? '0' : '8px'
                }}
              >
                {sidebarOpen && <h2>Pending Cases ({pendingCases.length})</h2>}
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)} 
                  style={{ 
                    background: sidebarOpen ? 'none' : '#fff', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: 'var(--forest)', 
                    padding: '8px', 
                    borderRadius: '50%',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: sidebarOpen ? 'none' : '0 2px 5px rgba(0,0,0,0.1)'
                  }}
                  title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>
              </div>
              
              {sidebarOpen ? (
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
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', paddingTop: '16px' }}>
                  {pendingCases.map(c => (
                    <div 
                      key={c.session_id} 
                      onClick={() => handleSelectCase(c)}
                      title={c.patient_name}
                      style={{ 
                        cursor: 'pointer', 
                        color: selectedCase?.session_id === c.session_id ? 'var(--forest)' : '#718096',
                        background: selectedCase?.session_id === c.session_id ? '#e6f0e6' : 'transparent',
                        padding: '10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <User size={20} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Case Details and Review Panel */}
            <section className="admin-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: 0 }}>
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
                <div style={{ display: 'flex', height: '100%', flexDirection: 'row' }}>
                  
                  {/* Left Side: Patient Details */}
                  <div style={{ width: '40%', borderRight: '1px solid #ddd', padding: '24px', overflowY: 'auto', background: '#fafaf9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h2 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.4rem' }}>{selectedCase.patient_name}</h2>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>MRN-{selectedCase.case_id.toString().padStart(8, '0')}</div>
                      </div>
                      <span className="badge badge-warning" style={{ background: '#feebc8', color: '#c05621', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Pending Review
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span><Clock size={12} style={{display:'inline', verticalAlign:'text-bottom'}}/> {selectedCase.created_at || new Date().toLocaleDateString()}</span>
                      <span>Age {selectedCase.age}</span>
                      <span>{selectedCase.gender}</span>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Chief Complaint</h4>
                      <div style={{ background: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', color: '#2d3748', borderLeft: '4px solid var(--forest)' }}>
                        "{selectedCase.conversation_history?.[0]?.content || selectedCase.symptoms || 'General wellness consultation.'}"
                      </div>
                    </div>

                    {selectedCase.vitals && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Vitals</h4>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(selectedCase.vitals).map(([key, val]) => (
                            <div key={key} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', flex: '1 1 calc(33% - 8px)' }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest)' }}>{val}</div>
                              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>{key}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Reported Symptoms</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: '#4a5568', lineHeight: '1.6' }}>
                        {selectedCase.conversation_history?.filter(m => m.role === 'user').slice(1).map((msg, i) => (
                          <li key={i}>{msg.content}</li>
                        ))}
                      </ul>
                    </div>

                    {selectedCase.medical_history && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Medical History</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', lineHeight: '1.5' }}>
                          {selectedCase.medical_history}
                        </p>
                      </div>
                    )}

                    {selectedCase.current_medications && selectedCase.current_medications.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Current Medications</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {selectedCase.current_medications.map((med, i) => (
                            <div key={i} style={{ background: '#fff', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#4a5568' }}>
                              💊 {med}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCase.investigations && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Investigations</h4>
                        <div style={{ background: '#ebf8fa', border: '1px solid #b2ebf2', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: '#00838f', lineHeight: '1.5' }}>
                          {selectedCase.investigations}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Treatment Plan */}
                  <div style={{ width: '60%', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff' }}>
                    
                    <div>
                      <h2 style={{ margin: 0, color: 'var(--forest-dark)', fontSize: '1.5rem', marginBottom: '4px' }}>Treatment Plan</h2>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Generate or write a prescription for <strong>{selectedCase.patient_name}</strong>.</p>
                    </div>

                    {/* AI Prescription Generator */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={16} color="#667eea" /> AI Prescription Generator
                        </h3>
                        <button 
                          type="button" 
                          className="admin-btn-outline btn-small"
                          onClick={() => setShowSampleLayout(true)}
                          style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: '#cbd5e0', color: '#4a5568' }}
                        >
                          View Sample Layout
                        </button>
                      </div>
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#718096' }}>
                        Describe your clinical intent — the AI drafts a structured prescription using the patient record.
                      </p>
                      
                      {/* Optional: Template selector could go here if still wanted */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {templates.map(t => (
                          <button 
                            key={t.id}
                            type="button" 
                            onClick={() => { setDoctorPrompt(t.name); handleApplyTemplate(t); }}
                            style={{ background: '#e2e8f0', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', color: '#4a5568', cursor: 'pointer' }}
                          >
                            Load: {t.name}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={doctorPrompt}
                        onChange={(e) => setDoctorPrompt(e.target.value)}
                        placeholder="e.g. Generate 5 days subscription focusing on gut health..."
                        style={{ width: '100%', height: '80px', padding: '12px', border: '1px solid #cbd5e0', borderRadius: '8px', resize: 'vertical', fontSize: '0.9rem', marginBottom: '12px', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          type="button"
                          onClick={handleGenerateAI}
                          disabled={generatingAI}
                          style={{ 
                            display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 20px',
                            background: generatingAI ? '#cbd5e0' : 'var(--forest-dark)',
                            color: '#fff', border: 'none', borderRadius: '8px',
                            fontWeight: 600, fontSize: '0.9rem', cursor: generatingAI ? 'wait' : 'pointer',
                          }}
                        >
                          {generatingAI ? <RefreshCw size={16} className="spin-icon" /> : <Sparkles size={16} />}
                          {generatingAI ? 'Generating...' : 'Generate Prescription'}
                        </button>
                      </div>
                    </div>

                    {/* Prescription Box */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Edit3 size={16} /> Prescription <span style={{ background: '#edf2f7', color: '#718096', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Editable</span>
                        </h3>
                        <button 
                          type="button" 
                          onClick={handleSaveDraft}
                          disabled={savingDraft}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #cbd5e0', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', color: '#4a5568', cursor: 'pointer', transition: '0.2s' }}
                        >
                          {savingDraft ? <RefreshCw size={14} className="spin-icon" /> : <Save size={14} />}
                          {savingDraft ? 'Saving...' : 'Save as Draft'}
                        </button>
                      </div>
                      <textarea
                        value={prescriptionForm.prescription_text}
                        onChange={(e) => setPrescriptionForm({...prescriptionForm, prescription_text: e.target.value})}
                        style={{ width: '100%', height: '200px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none', background: '#fcfcfc' }}
                        placeholder="AI drafted prescription will appear here..."
                      />
                    </div>

                    {/* Treatment Notes Box */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> Treatment Notes & Red Flags
                      </h3>
                      <textarea
                        value={prescriptionForm.safety_precautions}
                        onChange={(e) => setPrescriptionForm({...prescriptionForm, safety_precautions: e.target.value})}
                        style={{ width: '100%', height: '100px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', resize: 'vertical', fontSize: '0.9rem', outline: 'none', background: '#fcfcfc' }}
                        placeholder="Write additional treatment context, clinical reasoning, referrals, dietary advice, and follow-up instructions here."
                      />
                    </div>

                    {/* Bottom Action Bar */}
                    <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        style={{ background: 'none', border: '1px solid #cbd5e0', borderRadius: '8px', padding: '10px 16px', fontSize: '0.9rem', color: '#4a5568', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
                      >
                        <Save size={16} /> Save Prescription & Notes as Draft
                      </button>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          type="button" 
                          onClick={() => setPrescriptionForm({ prescription_text: '', safety_precautions: '', doctor_notes: '' })}
                          style={{ background: 'none', border: 'none', padding: '10px 16px', fontSize: '0.9rem', color: '#718096', cursor: 'pointer' }}
                        >
                          Clear All
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowPreviewModal(true)}
                          disabled={!prescriptionForm.prescription_text}
                          className="admin-btn-primary"
                          style={{ padding: '10px 24px', display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '8px' }}
                        >
                          <Send size={16} /> Preview & Submit
                        </button>
                      </div>
                    </div>
                    
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#2d3748' }}>Review Prescription</h2>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '0.85rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>Patient Details</h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: '#2d3748' }}>
                  <span><strong>Name:</strong> {selectedCase?.patient_name}</span>
                  <span><strong>Age:</strong> {selectedCase?.age}</span>
                  <span><strong>Gender:</strong> {selectedCase?.gender}</span>
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '0.85rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>Official Prescription</h3>
                <div style={{ background: '#fcfcfc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', color: '#2d3748', lineHeight: '1.5' }}>
                  {prescriptionForm.prescription_text}
                </div>
              </div>
              
              {prescriptionForm.safety_precautions && (
                <div>
                  <h3 style={{ fontSize: '0.85rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>Treatment Notes / Red Flags</h3>
                  <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', padding: '12px', fontSize: '0.9rem', color: '#c53030' }}>
                    {prescriptionForm.safety_precautions}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: '1px solid #cbd5e0', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>Back to Edit</button>
              <button onClick={handleSubmitApproval} disabled={submittingReview} style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center' }}>
                {submittingReview ? <RefreshCw className="spin-icon" size={18} /> : <CheckCircle size={18} />}
                {submittingReview ? 'Submitting...' : 'Confirm & Send to Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample Layout Modal / Dump Component */}
      {showSampleLayout && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#2d3748' }}>Prescription Sample Layout</h3>
              <button onClick={() => setShowSampleLayout(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', fontSize: '0.9rem', color: '#4a5568', lineHeight: '1.6' }}>
              <p>For best results, instruct the AI to generate or format the prescription using this standard structure:</p>
              <pre style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', marginTop: '12px' }}>
{`AYUSH [CONDITION] PROTOCOL
========================

1. HERBAL MEDICINES:
- [Herb Name] ([Botanical Name]) — [Dosage] [Frequency] with [Carrier e.g., warm water]
- [Herb 2]...

2. DIETARY GUIDELINES:
- Recommended: [Foods to eat]
- Avoid: [Foods to avoid]
- Hydration: [Specific instructions]

3. LIFESTYLE & YOGA:
- Exercise: [Specific asanas or activities]
- Routine: [Sleep cycle, stress management]

4. FOLLOW-UP:
- Review in [X] days
- Required Tests: [If any]`}
              </pre>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={() => setShowSampleLayout(false)} className="admin-btn-primary">Got it</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {successModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1050] p-6">
          <div className="bg-white rounded-xl w-full max-w-[400px] shadow-2xl overflow-hidden">
            <div className="px-6 py-8 text-center flex flex-col items-center">
              <CheckCircle size={56} color="var(--forest)" className="mb-4" />
              <h3 className="m-0 mb-3 text-slate-800 text-xl font-bold">{successModal.title}</h3>
              <p className="m-0 text-slate-600 text-[0.95rem] leading-relaxed">
                {successModal.message}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-center">
              <button 
                onClick={() => setSuccessModal({ show: false, title: '', message: '' })} 
                className="admin-btn-primary w-full p-2.5"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
