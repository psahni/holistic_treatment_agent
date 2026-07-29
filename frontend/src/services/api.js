const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const naturopathyAPI = {
  startSession: async (patientInfo) => {
    try {
      const res = await fetch(`${API_BASE}/api/naturo/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Hello, I'd like to start my naturopathy assessment.",
          patient_info: {
            age: parseInt(patientInfo.age) || 30,
            gender: patientInfo.gender || 'other',
            region: patientInfo.region || 'India',
            occupation: patientInfo.name || 'Not specified'
          },
          session_id: null
        })
      });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      return { session_id: data.session_id };
    } catch(e) {
      console.warn('Backend not responding, using mock session:', e.message);
      return { session_id: 'mock-session-' + Date.now() };
    }
  },
  sendMessage: async (sessionId, message) => {
    try {
      const res = await fetch(`${API_BASE}/api/naturo/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message })
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch(e) {
      // Mock response
      return {
        reply: "This is a mock response because the backend is unavailable.",
        step: "intake",
        assessment_complete: false,
        safety_flags: null
      };
    }
  },
  getSession: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
    return res.json();
  }
};
