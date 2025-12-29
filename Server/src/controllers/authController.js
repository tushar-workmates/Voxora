import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiResponseHandle from '../utils/ApiResponseHandle.js';
import ApiErrorHandle from '../utils/ApiErrorHandle.js';

const generateToken = (userId, email) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET not set in environment!');
    throw new Error('JWT_SECRET not configured');
  }
  console.log('Generating token for userId:', userId); // Debug log
  const token = jwt.sign({ id: userId, email }, process.env.JWT_SECRET, { expiresIn: '24h' });
  console.log('Generated token:', token); // Debug log
  return token;
};

const register = async (request, reply) => {
  try {
    const { email, password, companyWebsite, changePassword } = request.body;

    if (!email || !password) {
      throw new ApiErrorHandle(400, 'Email and password are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiErrorHandle(400, 'User already exists');
    }

    const user = new User({
      email,
      password,
      companyWebsite: companyWebsite || '',
      changePassword: changePassword || ''
    });

    await user.save();

    const token = generateToken(user._id, user.email);
    
    const response = new ApiResponseHandle(201, { 
      user: { id: user._id, email: user.email, companyWebsite: user.companyWebsite }, 
      token 
    }, 'User registered successfully');
    
    reply.code(201).send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Registration failed');
  }
};

const login = async (request, reply) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      throw new ApiErrorHandle(400, 'Email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiErrorHandle(401, 'Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiErrorHandle(401, 'Invalid credentials');
    }

    const token = generateToken(user._id, user.email);
    
    const response = new ApiResponseHandle(200, { 
      user: { id: user._id, email: user.email, companyWebsite: user.companyWebsite }, 
      token 
    }, 'Login successful');
    
    reply.send(response);
  } catch (error) {
    if (error instanceof ApiErrorHandle) {
      throw error;
    }
    throw new ApiErrorHandle(500, 'Login failed');
  }
};

const logout = async (request, reply) => {
  try {
    const response = new ApiResponseHandle(200, null, 'Logout successful');
    reply.send(response);
  } catch (error) {
    throw new ApiErrorHandle(500, 'Logout failed');
  }
};

export {
  register,
  login,
  logout
};
