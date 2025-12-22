import { register, login, logout } from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import ApiResponseHandle from '../utils/ApiResponseHandle.js';

async function authRoutes(fastify, options) {
  // Register route
  fastify.post('/register', register);

  // Login route
  fastify.post('/login', login);

  // Logout route
  fastify.post('/logout', logout);

  // Get profile route - returns email only
  fastify.get('/get-profile', { preHandler: auth }, async (request, reply) => {
    const response = new ApiResponseHandle(200, { email: request.user.email }, 'Profile retrieved successfully');
    reply.send(response);
  });

  // Protected route
  fastify.get('/protected', { preHandler: auth }, async (request, reply) => {
    const response = new ApiResponseHandle(200, { user: request.user }, 'Protected route accessed successfully');
    reply.send(response);
  });
}

export default authRoutes;
