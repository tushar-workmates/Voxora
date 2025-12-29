import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import axios from 'axios';
import connectDB from './src/config/db.js';
import leadRoutes from './src/routes/leadRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import appointmentRoutes from './src/routes/appointmentRoutes.js';
import User from './src/models/User.js';

dotenv.config();

// Debug: Check if JWT_SECRET is loaded
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');

const fastify = Fastify({ logger: true });

// ----------------------
// FIXED CORS CONFIG
// ----------------------
fastify.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// ⚠️ DO NOT ADD fastify.options() manually — Fastify CORS handles it automatically

// Body + Multipart
fastify.register(formbody);
fastify.register(multipart);

// Connect MongoDB
connectDB();
connectDB();

// ----------------------
// Auth Routes
// ----------------------
fastify.register(authRoutes);

// ----------------------
// Token Validation Route
// ----------------------
fastify.get('/api/validate-token', async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    reply.code(401);
    return { success: false, message: 'No token provided' };
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const userData = await User.findById(user.id);
    return { success: true, user: { name: userData.name, email: user.email } };
  } catch (error) {
    reply.code(401);
    return { success: false, message: 'Invalid token' };
  }
});



// ----------------------
// Lead Routes
// ----------------------
fastify.register(leadRoutes);

// ----------------------
// Appointment Routes
// ----------------------
fastify.register(appointmentRoutes);

// ----------------------
// Call Proxy Route
// ----------------------
fastify.post('/api/calls/make', async (request, reply) => {
  const { phoneNumber } = request.body;

  if (!phoneNumber) {
    reply.code(400);
    return { success: false, error: "Missing phone number" };
  }

  try {
    const response = await axios.post(
      'https://edd58e806aba.ngrok-free.app/make_call',
      { to: phoneNumber }
    );

    return { success: true, call: response.data };

  } catch (error) {
    reply.code(500);
    return { success: false, error: 'Call service unavailable - index.js not running' };
  }
});

// ----------------------
// Health Check
// ----------------------
fastify.get('/health', async () => ({ status: 'OK' }));

// ----------------------
// Start Server
// ----------------------
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 7006, host: '127.0.0.1' });
    console.log(`Server running on port ${process.env.PORT || 7006}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
