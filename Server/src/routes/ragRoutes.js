const axios = require('axios');
const auth = require('../middleware/auth');
const ApiResponseHandle = require('../utils/ApiResponseHandle');

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Python backend configuration
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:6000';
const PYTHON_API_KEY = process.env.PYTHON_API_KEY || 'your-secret-api-key-here';

// Create axios instance for Python backend
const pythonApi = axios.create({
  baseURL: PYTHON_BACKEND_URL,
  timeout: 30000, // 30 seconds timeout
});

// Check if Python backend is available
async function isPythonBackendAvailable() {
  try {
    const response = await pythonApi.get('/health', {
      headers: {
        'x-api-key': PYTHON_API_KEY,
      }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function ragRoutes(fastify, options) {
  // Test endpoint without auth for debugging
  fastify.get('/rag/test', async (request, reply) => {
    try {
      const response = await pythonApi.get('/health');
      reply.send(new ApiResponseHandle(200, response.data, 'Python backend connection test successful'));
    } catch (error) {
      console.error('Python backend test failed:', error.message);
      reply.code(503).send(new ApiResponseHandle(503, null, `Python backend test failed: ${error.message}`));
    }
  });

  // Health check for Python backend
  fastify.get('/rag/health', { preHandler: auth }, async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (isAvailable) {
        const response = await pythonApi.get('/health', {
          headers: {
            'x-api-key': PYTHON_API_KEY,
            'x-user-id': request.user.id.toString()
          }
        });
        reply.send(new ApiResponseHandle(200, response.data, 'Python backend is healthy'));
      } else {
        reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available'));
      }
    } catch (error) {
      reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend health check failed'));
    }
  });

  // Test chat endpoint without auth for debugging
  fastify.post('/rag/test-chat', async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available'));
      }

      const { message } = request.body;
      if (!message) {
        return reply.code(400).send(new ApiResponseHandle(400, null, 'Message is required'));
      }

      const response = await pythonApi.post('/chat', {
        query: message,
        user_id: 'test_user'
      });

      reply.send(new ApiResponseHandle(200, response.data, 'Chat response generated successfully'));
    } catch (error) {
      console.error('Chat test failed:', error.message);
      reply.code(500).send(new ApiResponseHandle(500, null, `Chat test failed: ${error.message}`));
    }
  });

  // Test list files endpoint without auth for debugging
  fastify.get('/rag/test-list', async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.send(new ApiResponseHandle(200, { files: [], total_vectors: 0, user_id: 'test_user' }, 'Python backend not available, returning mock data'));
      }

      const response = await pythonApi.get('/stats/test_user');
      reply.send(new ApiResponseHandle(200, response.data, 'Files listed successfully'));
    } catch (error) {
      console.error('List files test failed:', error.message);
      // Return mock data on error
      reply.send(new ApiResponseHandle(200, { files: [], total_vectors: 0, user_id: 'test_user' }, 'Using mock data'));
    }
  });

  // Test upload endpoint without auth for debugging
  fastify.post('/rag/test-upload', async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available. Please start the Python server.'));
      }

      // Handle multipart form data
      const data = await request.file();
      if (!data) {
        return reply.code(400).send(new ApiResponseHandle(400, null, 'No files uploaded'));
      }

      // Read the file buffer
      const buffer = await data.toBuffer();

      // Create FormData for Python backend
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: data.filename,
        contentType: data.mimetype
      });
      formData.append('user_id', 'test_user');

      // Forward to Python backend
      const response = await pythonApi.post('/upload', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      reply.send(new ApiResponseHandle(200, response.data, 'File uploaded successfully'));
    } catch (error) {
      console.error('Upload test failed:', error.message);
      reply.code(500).send(new ApiResponseHandle(500, null, `Upload test failed: ${error.message}`));
    }
  });

  // Upload files (requires authentication)
  fastify.post('/rag/upload', { preHandler: auth }, async (request, reply) => {
    try {
      // Handle multipart form data
      const data = await request.file();
      if (!data) {
        return reply.code(400).send(new ApiResponseHandle(400, null, 'No files uploaded'));
      }

      // Read the file buffer
      const buffer = await data.toBuffer();

      // Create FormData for Hybrid service
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: data.filename,
        contentType: data.mimetype
      });
      formData.append('user_id', request.user.id.toString());

      // Call Hybrid service for PDF processing and Pinecone storage
      const HYBRID_URL = process.env.HYBRID_SERVICE_URL || 'http://localhost:8000';
      console.log(`Calling Hybrid service at: ${HYBRID_URL}/upload_pdf`);
      
      const hybridResponse = await axios.post(`${HYBRID_URL}/upload_pdf`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 60000
      });

      console.log('Hybrid service response:', hybridResponse.data);
      
      // Save file metadata for listing (initialize global array if needed)
      if (!global.uploadedFiles) {
        global.uploadedFiles = [];
      }
      
      // Add file metadata to global storage with frontend-compatible format
      const fileMetadata = {
        id: `${request.user.id}_${data.filename}_${Date.now()}`, // Unique ID for frontend
        name: data.filename, // Frontend expects 'name'
        filename: data.filename, // Keep original for backend operations
        type: data.filename.split('.').pop()?.toUpperCase() || 'PDF', // File extension
        size: formatFileSize(buffer.length), // Human readable size
        uploadDate: new Date().toLocaleDateString(), // Formatted date
        user_id: request.user.id.toString(),
        upload_date: new Date().toISOString(), // ISO date for backend
        chunks: hybridResponse.data.total_chunks || 0,
        status: 'processed'
      };
      
      // Remove any existing file with same name and user_id to avoid duplicates
      global.uploadedFiles = global.uploadedFiles.filter(
        file => !(file.filename === data.filename && file.user_id === request.user.id.toString())
      );
      
      // Add the new file metadata
      global.uploadedFiles.push(fileMetadata);
      
      reply.send(new ApiResponseHandle(200, hybridResponse.data, 'File uploaded and processed successfully'));
    } catch (error) {
      console.error('Upload error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        reply.code(503).send(new ApiResponseHandle(503, null, 'Hybrid service not available at http://localhost:8000. Please start the Hybrid service.'));
      } else {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Upload failed';
        reply.code(500).send(new ApiResponseHandle(500, null, errorMessage));
      }
    }
  });

  // Send chat message (requires Python backend and authentication)
  fastify.post('/rag/chat', { preHandler: auth }, async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available. Please start the Python server for chat functionality.'));
      }

      // Transform request format for Python backend
      const { message } = request.body;
      const chatRequest = {
        query: message,
        user_id: request.user.id.toString()
      };

      const response = await pythonApi.post('/chat', chatRequest, {
        headers: {
          'x-api-key': PYTHON_API_KEY,
          'x-user-id': request.user.id.toString(),
          'Content-Type': 'application/json'
        }
      });
      reply.send(new ApiResponseHandle(200, response.data, 'Chat response generated successfully'));
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Chat request failed';
      reply.code(500).send(new ApiResponseHandle(500, null, errorMessage));
    }
  });

  // List files (requires Python backend and authentication)
  fastify.get('/rag/list_files', { preHandler: auth }, async (request, reply) => {
    try {
      // Initialize global array if it doesn't exist
      if (!global.uploadedFiles) {
        global.uploadedFiles = [];
      }
      
      // Get files from memory storage (in real implementation, this would be from database)
      const userFiles = global.uploadedFiles.filter(file => file.user_id === request.user.id.toString());
      
      const response = {
        files: userFiles,
        total_vectors: userFiles.reduce((sum, file) => sum + (file.chunks || 0), 0),
        user_id: request.user.id.toString()
      };
      
      reply.send(new ApiResponseHandle(200, response, 'Files listed successfully'));
    } catch (error) {
      console.error('List files error:', error.message);
      // Return empty data on error
      const mockData = {
        files: [],
        total_vectors: 0,
        user_id: request.user.id.toString()
      };
      reply.send(new ApiResponseHandle(200, mockData, 'Error occurred, showing empty file list'));
    }
  });

  // Delete file (requires Python backend and authentication)
  fastify.post('/rag/delete', { preHandler: auth }, async (request, reply) => {
    try {
      const { filename } = request.body;
      if (!filename) {
        return reply.code(400).send(new ApiResponseHandle(400, null, 'Filename is required'));
      }

      // Initialize global array if it doesn't exist
      if (!global.uploadedFiles) {
        global.uploadedFiles = [];
      }

      // Remove file from global storage (match by both 'name' and 'filename' for compatibility)
      const initialLength = global.uploadedFiles.length;
      global.uploadedFiles = global.uploadedFiles.filter(
        file => !(
          (file.filename === filename || file.name === filename) && 
          file.user_id === request.user.id.toString()
        )
      );
      
      const wasDeleted = global.uploadedFiles.length < initialLength;
      
      if (wasDeleted) {
        reply.send(new ApiResponseHandle(200, { filename, deleted: true }, 'File deleted successfully'));
      } else {
        reply.code(404).send(new ApiResponseHandle(404, null, 'File not found'));
      }
    } catch (error) {
      const errorMessage = error.message || 'Delete failed';
      reply.code(500).send(new ApiResponseHandle(500, null, errorMessage));
    }
  });

  // Get chat history (requires Python backend and authentication)
  fastify.get('/rag/chat_history', { preHandler: auth }, async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available. Please start the Python server to get chat history.'));
      }

      const response = await pythonApi.get('/chat_history', {
        headers: {
          'x-api-key': PYTHON_API_KEY,
          'x-user-id': request.user.id.toString()
        }
      });
      reply.send(new ApiResponseHandle(200, response.data, 'Chat history retrieved successfully'));
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to get chat history';
      reply.code(500).send(new ApiResponseHandle(500, null, errorMessage));
    }
  });

  // Clear chat history (requires Python backend and authentication)
  fastify.post('/rag/clear_chat_history', { preHandler: auth }, async (request, reply) => {
    try {
      const isAvailable = await isPythonBackendAvailable();
      if (!isAvailable) {
        return reply.code(503).send(new ApiResponseHandle(503, null, 'Python backend is not available. Please start the Python server to clear chat history.'));
      }

      const response = await pythonApi.post('/clear_chat_history', {}, {
        headers: {
          'x-api-key': PYTHON_API_KEY,
          'x-user-id': request.user.id.toString(),
          'Content-Type': 'application/json'
        }
      });
      reply.send(new ApiResponseHandle(200, response.data, 'Chat history cleared successfully'));
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to clear chat history';
      reply.code(500).send(new ApiResponseHandle(500, null, errorMessage));
    }
  });
}

module.exports = ragRoutes;
