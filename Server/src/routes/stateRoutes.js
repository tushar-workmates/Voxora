const ApiResponseHandle = require('../utils/ApiResponseHandle');

async function stateRoutes(fastify, options) {
  // Get application state
  fastify.get('/api/state', async (request, reply) => {
    try {
      const state = {
        status: 'active',
        timestamp: new Date(),
        version: '1.0.0'
      };
      const response = new ApiResponseHandle(200, state, 'State retrieved successfully');
      reply.send(response);
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve state'
      });
    }
  });

  // Update application state
  fastify.post('/api/state', async (request, reply) => {
    try {
      const { status } = request.body;
      const state = {
        status: status || 'active',
        timestamp: new Date(),
        version: '1.0.0'
      };
      const response = new ApiResponseHandle(200, state, 'State updated successfully');
      reply.send(response);
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Failed to update state'
      });
    }
  });
}

module.exports = stateRoutes;
