import Appointment from '../models/Appointment.js';

export default async function appointmentRoutes(fastify) {
  // Get all appointments
  fastify.get('/api/appointments', async (request, reply) => {
    try {
      const appointments = await Appointment.find().sort({ createdAt: -1 });
      return { success: true, appointments };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Get appointments by phone number
  fastify.get('/api/appointments/:phone', async (request, reply) => {
    try {
      const { phone } = request.params;
      const appointments = await Appointment.find({ phoneNumber: phone }).sort({ createdAt: -1 });
      return { success: true, appointments };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Create appointment
  fastify.post('/api/appointments', async (request, reply) => {
    try {
      const appointment = new Appointment(request.body);
      await appointment.save();
      return { success: true, appointment };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Update appointment status
  fastify.patch('/api/appointments/:id/status', async (request, reply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;
      const appointment = await Appointment.findByIdAndUpdate(id, { status }, { new: true });
      return { success: true, appointment };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Delete appointment
  fastify.delete('/api/appointments/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await Appointment.findByIdAndDelete(id);
      return { success: true };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Seed sample appointments (for testing)
  fastify.post('/api/appointments/seed', async (request, reply) => {
    try {
      const sampleAppointments = [
        {
          name: 'John Smith',
          phoneNumber: '+1234567890',
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          purpose: 'Product Demo',
          status: 'pending'
        },
        {
          name: 'Sarah Johnson',
          phoneNumber: '+1987654321',
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          purpose: 'Consultation Call',
          status: 'confirmed'
        }
      ];

      await Appointment.insertMany(sampleAppointments);
      return { success: true, message: 'Sample appointments created' };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });
}
