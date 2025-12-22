const ApiResponseHandle = require('../utils/ApiResponseHandle');

async function chatRoutes(fastify, options) {
  // Get chat history
  fastify.get('/api/chat/history', async (request, reply) => {
    try {
      const response = new ApiResponseHandle(200, [], 'Chat history retrieved successfully');
      reply.send(response);
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve chat history'
      });
    }
  });

  // Send message
  fastify.post('/api/chat/message', async (request, reply) => {
    try {
      const { message } = request.body;
      const response = new ApiResponseHandle(200, { message, timestamp: new Date() }, 'Message sent successfully');
      reply.send(response);
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Failed to send message'
      });
    }
  });
}

module.exports = chatRoutes;
