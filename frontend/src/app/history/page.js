'use client'
import React, { useState, useEffect } from 'react';
import { naturopathyAPI } from '../../services/api';

const statusConfig = {
  pending_review: { label: 'Pending Review', color: '#e8a517', bg: '#fef9e7', icon: '⏳' },
  reviewed: { label: 'Prescription Ready', color: '#2e7d32', bg: '#e8f5e9', icon: '✅' },
  in_progress: { label: 'In Progress', color: '#1565c0', bg: '#e3f2fd', icon: '🔄' },
};

function getStatus(status) {
  return statusConfig[status] || { label: status || 'Unknown', color: '#888', bg: '#f5f5f5', icon: '❓' };
}

export default function PatientHistoryPage() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userData = await naturopathyAPI.getMe();
      setUser(userData);
      const historyRes = await naturopathyAPI.getPatientHistory();
      setCases(historyRes.cases || []);
    } catch (e) {
      setError('Please log in to view your case history.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCase = async (c) => {
    if (selectedCase?.case_id === c.case_id) {
      setSelectedCase(null);
      return;
    }
    setDetailLoading(true);
    try {
      const details = await naturopathyAPI.getPatientCaseDetails(c.case_id);
      setSelectedCase(details);
    } catch (e) {
      console.error('Failed to load case:', e);
      alert('Failed to load case details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteCase = async (caseId) => {
    console.log("Attempting to delete case ID:", caseId);
    if (!window.confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
      return;
    }
    setDetailLoading(true);
    try {
      const response = await naturopathyAPI.deletePatientCase(caseId);
      console.log("Delete response:", response);
      setSelectedCase(null);
      loadData();
    } catch (e) {
      console.error('Failed to delete case - error object:', e);
      console.error('Error details:', e.response?.data || e.message);
      alert(`Failed to delete case. Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'spin 1.5s linear infinite' }}>🌿</div>
          <p style={{ color: 'var(--text-light)' }}>Loading your case history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
        <NavBar user={null} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ marginBottom: '12px' }}>Authentication Required</h2>
            <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>{error}</p>
            <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', padding: '12px 32px' }}>Go to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
      <NavBar user={user} />

      <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>My Cases</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '1rem' }}>
            View your submitted health assessments and doctor prescriptions.
          </p>
        </div>

        {cases.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'var(--card-bg)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--card-border)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
            <h3 style={{ marginBottom: '8px' }}>No Cases Yet</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>
              You haven't submitted any health assessments yet. Start your healing journey today!
            </p>
            <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', padding: '12px 32px' }}>Start Assessment</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cases.map((c) => {
              const st = getStatus(c.status);
              const isSelected = selectedCase?.case_id === c.case_id;
              return (
                <div key={c.case_id} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {/* Case Card */}
                  <div
                    onClick={() => handleSelectCase(c)}
                    style={{
                      background: isSelected ? '#fff' : 'var(--card-bg)',
                      border: isSelected ? '2px solid var(--primary-green)' : '1px solid var(--card-border)',
                      borderRadius: isSelected ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
                      padding: '20px 24px',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem'
                      }}>
                        {st.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>
                          Case #{c.case_id}
                        </div>
                        <div style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                          Submitted: {c.created_at || 'N/A'}
                          {c.completed_at && <span> &nbsp;·&nbsp; Reviewed: {c.completed_at}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        background: st.bg, color: st.color, fontWeight: 600,
                        fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px',
                      }}>
                        {st.label}
                      </span>
                      <span style={{
                        transform: isSelected ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s ease', fontSize: '1.2rem', color: 'var(--text-light)'
                      }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isSelected && (
                    <div style={{
                      background: '#fff',
                      border: '2px solid var(--primary-green)',
                      borderTop: 'none',
                      borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                      padding: '24px',
                    }}>
                      {detailLoading ? (
                        <div style={{ textAlign: 'center', padding: '32px' }}>
                          <p style={{ color: 'var(--text-light)' }}>Loading details...</p>
                        </div>
                      ) : (
                        <CaseDetailPanel caseData={selectedCase} onDelete={handleDeleteCase} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Navbar ─── */
function NavBar({ user }) {
  return (
    <nav style={{
      padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid var(--card-border)'
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-green)', textDecoration: 'none' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 12V2"/>
          <path d="M12 12c-2.5 0-4.5 2-4.5 4.5S9.5 21 12 21"/>
          <path d="M12 12c2.5 0 4.5 2 4.5 4.5S14.5 21 12 21"/>
        </svg>
        <span style={{ fontWeight: 600, fontSize: '1.25rem' }}>NatureGuide</span>
      </a>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <a href="/" style={{ color: 'var(--text-light)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>← Back to Home</a>
        {user && <span style={{ fontWeight: 500, color: 'var(--text-light)' }}>Welcome, {user.name}</span>}
      </div>
    </nav>
  );
}

/* ─── Case Detail Panel ─── */
function CaseDetailPanel({ caseData, onDelete }) {
  if (!caseData) return null;

  const hasPrescription = caseData.doctor_prescription && caseData.status === 'reviewed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Prescription Section */}
      {hasPrescription && (
        <div style={{
          background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius-sm)',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '1.1rem', color: '#2e7d32', marginBottom: '12px' }}>
            ✅ Doctor's Prescription
          </h3>
          <div style={{ fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
            {caseData.doctor_prescription.prescription_text}
          </div>
          {caseData.doctor_prescription.safety_precautions && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#fff3e0', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
              <strong style={{ color: '#e65100' }}>⚠️ Safety Precautions:</strong>
              <p style={{ margin: '4px 0 0 0' }}>{caseData.doctor_prescription.safety_precautions}</p>
            </div>
          )}
          {caseData.doctor_prescription.approved_at && (
            <p style={{ marginTop: '12px', fontSize: '0.8rem', color: '#666' }}>
              Approved on: {caseData.doctor_prescription.approved_at}
            </p>
          )}
        </div>
      )}

      {/* Doctor Notes */}
      {caseData.doctor_notes && (
        <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>🩺 Doctor's Notes</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {caseData.doctor_notes}
          </p>
        </div>
      )}

      {/* AI Analysis Summary */}
      {caseData.root_causes && caseData.root_causes.length > 0 && (
        <div style={{ background: '#f5f7f5', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e0e0e0' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>🔮 AI Root Cause Analysis</h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: '1.7' }}>
            {caseData.root_causes.map((rc, idx) => (
              <li key={idx}><strong>{rc.cause}</strong> ({rc.category}, {rc.severity}): {rc.reasoning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conversation History */}
      {caseData.conversation_history && caseData.conversation_history.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>💬 Session Transcript</h4>
          <div style={{
            maxHeight: '300px', overflowY: 'auto', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--card-border)', background: '#fafafa'
          }}>
            {caseData.conversation_history.map((msg, idx) => (
              <div key={idx} style={{
                padding: '10px 16px', borderBottom: '1px solid #eee',
                background: msg.role === 'user' ? '#f0f7ed' : '#fff',
                fontSize: '0.85rem', lineHeight: '1.6'
              }}>
                <strong style={{ color: msg.role === 'user' ? 'var(--primary-green)' : '#555', textTransform: 'capitalize' }}>
                  {msg.role === 'user' ? '🧑 You' : '🤖 Assistant'}:
                </strong>{' '}
                {msg.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Status Message */}
      {caseData.status === 'pending_review' && (
        <div style={{
          textAlign: 'center', padding: '24px',
          background: '#fef9e7', borderRadius: 'var(--radius-sm)', border: '1px solid #f9e79f',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>Awaiting Practitioner Review</p>
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: '0 0 16px 0' }}>
            Your case has been submitted and is being reviewed by a certified AYUSH naturopathy practitioner.
            You will receive an email once the prescription is ready.
          </p>
          <button 
            onClick={() => onDelete(caseData.case_id)}
            style={{ 
              background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', 
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontWeight: 500, transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#ffcdd2'}
            onMouseOut={(e) => e.target.style.background = '#ffebee'}
          >
            Delete Case
          </button>
        </div>
      )}
    </div>
  );
}
