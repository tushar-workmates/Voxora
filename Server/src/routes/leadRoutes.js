import { createLead, getAllLeads, deleteLead, importLeads, importCsv, updateLeadStatus } from '../controllers/leadController.js';
import validateLead from '../middleware/leadValidation.js';
import authenticateToken from '../middleware/auth.js';
import Lead from '../models/Lead.js';

async function leadRoutes(fastify, options) {
  fastify.post('/api/leads', { preHandler: [authenticateToken, validateLead] }, createLead);
  fastify.get('/api/leads', { preHandler: authenticateToken }, getAllLeads);
  fastify.delete('/api/leads/:id', { preHandler: authenticateToken }, deleteLead);
  fastify.patch('/api/leads/:id/status', { preHandler: authenticateToken }, updateLeadStatus);
  fastify.post('/api/leads/import', { preHandler: authenticateToken }, importLeads);
  fastify.post('/api/leads/import-csv', { preHandler: authenticateToken }, importCsv);
  
  // Seed sample leads (for testing)
  fastify.post('/api/leads/seed', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const sampleLeads = [
        {
          fullName: 'John Smith',
          email: 'john@company.com',
          phone: '+1234567890',
          company: 'Tech Corp',
          status: 'new',
          userId: request.user.id
        },
        {
          fullName: 'Sarah Johnson',
          email: 'sarah@startup.io',
          phone: '+1987654321',
          company: 'Innovation Labs',
          status: 'new',
          userId: request.user.id
        }
      ];

      await Lead.insertMany(sampleLeads);
      reply.send({ success: true, message: 'Sample leads created' });
    } catch (error) {
      reply.code(500).send({ success: false, error: error.message });
    }
  });
}

export default leadRoutes;
