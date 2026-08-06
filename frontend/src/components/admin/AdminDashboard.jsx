import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Search, Play, RefreshCw, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

export default function AdminDashboard({ onLogout }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [ingestionState, setIngestionState] = useState(null); // { filename, progress, message, status }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/docs', { credentials: 'include' });
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
      await fetch('http://localhost:8000/api/admin/logout', { method: 'POST', credentials: 'include' });
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
      const res = await fetch('http://localhost:8000/api/admin/upload', {
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
      const res = await fetch(`http://localhost:8000/api/admin/docs/${filename}`, {
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
    const eventSource = new EventSource(`http://localhost:8000/api/admin/ingest/${filename}?t=${Date.now()}`, {
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
    
    try {
      const res = await fetch(`http://localhost:8000/api/admin/embeddings/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <h1>RAG Pipeline Dashboard</h1>
          <button onClick={handleLogout} className="admin-btn-outline">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="admin-main">
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
                        <span className={`status-badge ${doc.status === 'ingested' ? 'success' : 'pending'}`}>
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
                <Search size={16} />
              </button>
            </form>

            <div className="search-results">
              {searchResults.length === 0 ? (
                <p className="text-center text-light mt-4">Search results will appear here.</p>
              ) : (
                searchResults.map((hit, idx) => (
                  <div key={idx} className="result-item">
                    <div className="result-meta">
                      <span className="source-tag">{hit.source} (Pg {hit.page})</span>
                      <span className="score-tag">Score: {hit.score}</span>
                    </div>
                    <p className="result-text">{hit.text.substring(0, 150)}...</p>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
