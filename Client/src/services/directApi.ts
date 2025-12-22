// Direct API calls to Python FastAPI server
const PYTHON_API_URL = 'http://localhost:8000';

export const uploadPdfDirect = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', 'direct_user');

  const response = await fetch(`${PYTHON_API_URL}/api/upload-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};

export const sendChatMessageDirect = async (message: string) => {
  const response = await fetch(`${PYTHON_API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  return response.json();
};
