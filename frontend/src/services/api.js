const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const fetchWithCredentials = async (url, options = {}) => {
  const finalOptions = {
    ...options,
    credentials: 'include', // Needed for HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  const res = await fetch(url, finalOptions);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(`API Error: ${res.status}`);
    error.response = { data: errorData };
    throw error;
  }
  
  return await res.json();
};

export const naturopathyAPI = {
  // Authentication Endpoints
  signup: async (userData) => {
    return fetchWithCredentials(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },
  
  login: async (credentials) => {
    return fetchWithCredentials(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },
  
  logout: async () => {
    return fetchWithCredentials(`${API_BASE}/api/auth/logout`, {
      method: 'POST'
    });
  },
  
  getMe: async () => {
    return fetchWithCredentials(`${API_BASE}/api/auth/me`, {
      method: 'GET'
    });
  },

  // Agent Endpoints
  startSession: async (patientInfo) => {
    try {
      const data = await fetchWithCredentials(`${API_BASE}/api/naturo/start`, {
        method: 'POST',
        body: JSON.stringify({
          message: "",
          patient_info: {
            age: parseInt(patientInfo.age) || 30,
            gender: patientInfo.gender || 'other',
            region: patientInfo.region || 'India',
            occupation: patientInfo.name || 'Not specified'
          },
          session_id: null
        })
      });
      return { session_id: data.session_id, message: data.message };
    } catch(e) {
      console.warn('Backend not responding, using mock session:', e.message);
      return { session_id: 'mock-session-' + Date.now(), message: "Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today." };
    }
  },
  
  sendMessage: async (sessionId, message) => {
    try {
      return await fetchWithCredentials(`${API_BASE}/api/naturo/chat`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, message })
      });
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
    return fetchWithCredentials(`${API_BASE}/api/session/${sessionId}`);
  }
};
