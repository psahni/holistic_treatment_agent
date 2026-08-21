export const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

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
  startSession: async (patientInfo, mode = "question") => {
    try {
      const data = await fetchWithCredentials(`${API_BASE}/api/naturo/start`, {
        method: 'POST',
        body: JSON.stringify({
          message: "",
          patient_info: {
            age: parseInt(patientInfo.age) || 30,
            gender: patientInfo.gender || 'other',
            region: patientInfo.region || 'India',
            occupation: patientInfo.name || 'Not specified',
            investigations: patientInfo.investigations || ''
          },
          session_id: null,
          mode: mode || "question"
        })
      });
      return { session_id: data.session_id, message: data.message };
    } catch(e) {
      console.warn('Backend not responding, using mock session:', e.message);
      return { session_id: 'mock-session-' + Date.now(), message: "Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today." };
    }
  },
  
  sendMessage: async (sessionId, message, mode = null) => {
    try {
      return await fetchWithCredentials(`${API_BASE}/api/naturo/chat`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, message, mode })
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
  
  streamMessage: async function* (sessionId, message, mode = null) {
    const res = await fetch(`${API_BASE}/api/naturo/chat_stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message, mode })
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            if (data.error) throw new Error(data.error);
            yield data;
          } catch (e) {
            console.error('Failed to parse stream JSON:', e);
          }
        }
      }
    }
  },
  
  getSession: async (sessionId) => {
    return fetchWithCredentials(`${API_BASE}/api/session/${sessionId}`);
  },

  submitIntake: async (sessionId, userResponses) => {
    return fetchWithCredentials(`${API_BASE}/api/naturo/submit_intake`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, user_responses: userResponses })
    });
  },

  // Practitioner Endpoints
  getPendingCases: async (options = {}) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/pending-cases`, {
      method: 'GET',
      ...options
    });
  },

  getAdminCaseDetails: async (sessionId) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/cases/${sessionId}`, {
      method: 'GET'
    });
  },

  approveCase: async (sessionId, approvalData) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/cases/${sessionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(approvalData)
    });
  },

  // Patient History Endpoints
  getPatientHistory: async () => {
    return fetchWithCredentials(`${API_BASE}/api/naturo/history`, {
      method: 'GET'
    });
  },

  getPatientCaseDetails: async (caseId) => {
    return fetchWithCredentials(`${API_BASE}/api/naturo/cases/${caseId}`, {
      method: 'GET'
    });
  },

  deletePatientCase: async (caseId) => {
    return fetchWithCredentials(`${API_BASE}/api/naturo/cases/${caseId}`, {
      method: 'DELETE'
    });
  },


  // Prescription Template Endpoints
  getTemplates: async (options = {}) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/templates`, {
      method: 'GET',
      ...options
    });
  },

  createTemplate: async (templateData) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/templates`, {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  },

  updateTemplate: async (templateId, templateData) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData)
    });
  },

  deleteTemplate: async (templateId) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/templates/${templateId}`, {
      method: 'DELETE'
    });
  },

  generateAIPrescription: async (sessionId, doctorPrompt) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/cases/${sessionId}/generate-ai-prescription`, {
      method: 'POST',
      body: JSON.stringify({ doctor_prompt: doctorPrompt })
    });
  },

  saveDraft: async (sessionId, draftData) => {
    return fetchWithCredentials(`${API_BASE}/api/admin/cases/${sessionId}/draft`, {
      method: 'POST',
      body: JSON.stringify(draftData)
    });
  }
};
