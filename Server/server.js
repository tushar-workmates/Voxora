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
// Login Route
// ----------------------
fastify.post('/login', async (request, reply) => {
  const { email, password } = request.body;

  if (!email || !password) {
    reply.code(400);
    return { success: false, message: 'Email and password required' };
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      reply.code(401);
      return { success: false, message: 'Invalid credentials' };
    }

    const token = jwt.sign(
      { email: user.email, id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      data: { token },
      message: 'Login successful'
    };
  } catch (error) {
    reply.code(500);
    return { success: false, message: 'Server error' };
  }
});

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
// Logout Route
// ----------------------
fastify.post('/logout', async (request, reply) => {
  return {
    success: true,
    message: 'Logout successful'
  };
});

// ----------------------
// Get Profile Route
// ----------------------
fastify.get('/get-profile', async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return reply.status(401).send({ error: 'Access token required' });
  }
  
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const userData = await User.findById(user.id);
    
    if (!userData) {
      return reply.status(404).send({ error: 'User not found' });
    }
    
    return {
      statusCode: 200,
      data: { email: userData.email },
      message: 'Profile retrieved successfully'
    };
  } catch (error) {
    return reply.status(403).send({ error: 'Invalid token' });
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
