import axios from 'axios';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const DB_CHAT_BASE_URL = import.meta.env.VITE_DB_CHAT_BASE_URL;
const MAIN_API_BASE_URL = import.meta.env.VITE_MAIN_API_BASE_URL;
const CALL_SERVER_URL = import.meta.env.VITE_CALL_SERVER_URL;

console.log('API_BASE_URL =', API_BASE_URL);

// Main API instances
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor to include token in requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  if (token && token !== 'fake-jwt-token' && token !== 'null' && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const dbChatApi = axios.create({
  baseURL: DB_CHAT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mainApi = axios.create({
  baseURL: MAIN_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Call server API for transcript endpoints
const callServerApi = axios.create({
  baseURL: CALL_SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
});

mainApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'fake-jwt-token') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========== AUTH APIs ==========
export const validateToken = async (token?: string) => {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await api.get('/api/validate-token', { headers });
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await api.post('/login', { email, password });
  if (response.data.success) {
    // Get user data from token validation using the new token
    const tokenData = await validateToken(response.data.data.token);
    if (tokenData.success) {
      response.data.data.user = tokenData.user;
    }
  }
  return response.data;
};

export const register = async (email: string, password: string, companyWebsite?: string) => {
  const response = await api.post('/register', { email, password, companyWebsite });
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/logout');
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/get-profile');
  return response.data;
};

// ========== TRANSCRIPT APIs ==========
// INBOUND Transcripts
export const getInboundTranscripts = async (page: number = 1, limit: number = 20) => {
  // Get user email from localStorage
  const userStr = localStorage.getItem('user');
  let email = '';
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      email = user.email;
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  const response = await callServerApi.get('/api/transcripts', {
    params: { page, limit, email }
  });
  return response.data;
};

export const getInboundTranscript = async (requestUuid: string) => {
  const response = await callServerApi.get(`/api/transcripts/${requestUuid}`);
  return response.data;
};

// OUTBOUND Transcripts
export const getOutboundTranscripts = async (page: number = 1, limit: number = 20) => {
  // Get userId from token
  const token = localStorage.getItem('token');
  let userId = null;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.id;
    } catch (e) {
      console.error('Error parsing token:', e);
    }
  }

  const response = await callServerApi.get('/api/outbound-transcripts', {
    params: { page, limit, userId }
  });
  return response.data;
};

export const getOutboundTranscript = async (requestUuid: string) => {
  const response = await callServerApi.get(`/api/transcripts/${requestUuid}`);
  return response.data;
};

// Common transcript operations
export const generateTranscriptSummary = async (callSid: string, style: string = 'concise') => {
  const response = await callServerApi.post(`/api/transcripts/${callSid}/summary`, { style });
  return response.data;
};

export const getTranscriptSummary = async (callSid: string) => {
  const response = await callServerApi.get(`/api/transcripts/${callSid}/summary`);
  return response.data;
};

export const deleteTranscriptSummary = async (callSid: string) => {
  const response = await callServerApi.delete(`/api/transcripts/${callSid}/summary`);
  return response.data;
};

// ========== CALL MANAGEMENT ==========
export const makeCall = async (phoneNumber: string) => {
  console.log('Making call to:', phoneNumber);
  
  try {
    // Get userId from JWT token
    const token = localStorage.getItem('token');
    let userId = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.id;
        // console.log('Extracted userId from token:', userId);
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
    
    const response = await callServerApi.post('/make_call', { 
      to: phoneNumber,
      userId: userId
    });
    return response.data;
  } catch (error: any) {
    console.error('Error making call:', error);
    throw error;
  }
};

// ========== APPOINTMENT APIs ==========
export const getAppointments = async () => {
  const response = await api.get('/api/appointments');
  return response.data;
};

export const confirmAppointment = async (appointmentId: string) => {
  const response = await callServerApi.post(`/api/appointments/${appointmentId}/confirm`);
  return response.data;
};

export const getAppointmentsByPhone = async (phoneNumber: string) => {
  const response = await api.get(`/api/appointments/${phoneNumber}`);
  return response.data;
};

export const createAppointment = async (appointmentData: {
  name: string;
  phoneNumber: string;
  date: string;
  purpose: string;
  status?: string;
}) => {
  const response = await api.post('/api/appointments', appointmentData);
  return response.data;
};

export const updateAppointmentStatus = async (id: string, status: string) => {
  const response = await api.patch(`/api/appointments/${id}/status`, { status });
  return response.data;
};

export const deleteAppointment = async (id: string) => {
  const response = await api.delete(`/api/appointments/${id}`);
  return response.data;
};

export const seedAppointments = async () => {
  const response = await api.post('/api/appointments/seed');
  return response.data;
};

// ========== FILE MANAGEMENT ==========
export const getFiles = async () => {
  const response = await mainApi.get('/api/files');
  return response.data;
};


export const uploadPdf = async (file: File) => {
  const formData = new FormData();

  // ✅ MUST be "file" (FastAPI expects this)
  formData.append('file', file);

  const response = await mainApi.post('/api/upload-pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};


export const deleteFile = async (filename: string) => {
  const response = await mainApi.post('/rag/delete', { filename });
  return response.data;
};

// ========== CHAT APIs ==========
export const sendChatMessage = async (query: string, sessionId: string) => {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        session_id: sessionId,
      }),
    }
  );

  return await res.json();
};



export const sendDbChatMessage = async (query: string) => {
  const response = await dbChatApi.post('/api/db-chat', { query });
  return response.data;
};

// ========== CHAT PERSISTENCE ==========
export const saveChat = async (sessionId: string, messages: any[]) => {
  const response = await api.post('/chat/save', { sessionId, messages });
  return response.data;
};

export const loadChat = async (sessionId: string) => {
  const response = await api.get(`/chat/load/${sessionId}`);
  return response.data;
};

export const getChatSessions = async () => {
  const response = await api.get('/chat/sessions');
  return response.data;
};

// ========== LEAD MANAGEMENT ==========
export const createLead = async (leadData: { fullName: string; email: string; phone: string; company: string; status?: string }) => {
  const response = await api.post('/api/leads', leadData);
  return response.data;
};

export const getAllLeads = async () => {
  const response = await api.get('/api/leads');
  return response.data;
};

export const deleteLead = async (id: string) => {
  const response = await api.delete(`/api/leads/${id}`);
  return response.data;
};

export const importLeads = async (leads: Array<{ name: string; email: string; phone: string; company: string }>) => {
  const response = await api.post('/api/leads/import', { leads });
  return response.data;
};

export const updateLeadStatus = async (id: string, status: string) => {
  const response = await api.patch(`/api/leads/${id}/status`, { status });
  return response.data;
};

export const importCsvFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/api/leads/import-csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const seedLeads = async () => {
  const response = await api.post('/api/leads/seed');
  return response.data;
};

// ========== TRANSCRIPTION MANAGEMENT ==========
export const getTranscriptions = async () => {
  const response = await dbChatApi.get('/api/transcriptions');
  return response.data;
};

// WebSocket URL
export const getTranscriptWebSocketUrl = () => {
  return `${CALL_SERVER_URL}/transcript-stream`;
};



export default api;