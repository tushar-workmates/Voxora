const axios = require('axios');
const FormData = require('form-data');
const auth = require('../middleware/auth');

const HYBRID_SERVICE_URL = process.env.HYBRID_SERVICE_URL || 'http://localhost:8001';

async function hybridProxyRoutes(fastify, options) {
  // PDF upload proxy - temporary direct handling
  fastify.post('/api/upload-pdf', { preHandler: auth }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      if (!data.filename.toLowerCase().endsWith('.pdf')) {
        return reply.code(400).send({ error: 'Only PDF files are supported' });
      }

      // For now, just return success - you can add actual PDF processing later
      reply.send({
        message: 'PDF uploaded successfully',
        filename: data.filename,
        user_id: request.user._id.toString()
      });
    } catch (error) {
      console.error('Upload error:', error.message);
      reply.code(500).send({ 
        error: 'Failed to upload PDF',
        details: error.message
      });
    }
  });

  // Chat proxy
  fastify.post('/api/chat', { preHandler: auth }, async (request, reply) => {
    try {
      console.log('Chat request received:', request.body);
      
      // Handle both 'query' and 'message' field names
      const { query, message } = request.body;
      const userQuery = query || message;
      
      if (!userQuery || !userQuery.trim()) {
        return reply.code(400).send({ error: 'Query or message is required' });
      }

      console.log('User query:', userQuery);
      console.log('User ID:', request.user._id.toString());

      const formData = new FormData();
      formData.append('query', userQuery);
      formData.append('user_id', request.user._id.toString());

      console.log('Sending request to hybrid service...');
      const response = await axios.post(`${HYBRID_SERVICE_URL}/ask`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000
      });

      console.log('Hybrid service response received');
      reply.send(response.data);
    } catch (error) {
      console.error('Chat proxy error:', error.message);
      console.error('Error details:', error.response?.data);
      console.error('Stack trace:', error.stack);
      
      // Handle different error types
      if (error.code === 'ECONNREFUSED') {
        return reply.code(503).send({ 
          error: 'Hybrid service unavailable',
          details: 'Cannot connect to AI service'
        });
      }
      
      if (error.response?.status === 422) {
        return reply.code(400).send({ 
          error: 'Invalid request format',
          details: error.response.data
        });
      }
      
      reply.code(500).send({ 
        error: 'Failed to process chat',
        details: error.response?.data || error.message
      });
    }
  });

  // DB Chat proxy (same as chat for now)
  fastify.post('/api/db-chat', { preHandler: auth }, async (request, reply) => {
    try {
      const { query } = request.body;
      if (!query) {
        return reply.code(400).send({ error: 'Query is required' });
      }

      const formData = new FormData();
      formData.append('query', query);
      formData.append('user_id', request.user._id.toString());

      const response = await axios.post(`${HYBRID_SERVICE_URL}/ask`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      reply.send(response.data);
    } catch (error) {
      console.error('DB Chat proxy error:', error.message);
      reply.code(500).send({ 
        error: 'Failed to process database query',
        details: error.response?.data || error.message
      });
    }
  });
}

module.exports = hybridProxyRoutes;
