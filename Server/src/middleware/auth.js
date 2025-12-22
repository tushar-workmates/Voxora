import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const authenticateToken = async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    reply.code(401).send({ success: false, message: 'Access token required' });
    return;
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    // Convert string ID to ObjectId for database operations
    user.id = new mongoose.Types.ObjectId(user.id);
    request.user = user;
  } catch (error) {
    reply.code(403).send({ success: false, message: 'Invalid token' });
  }
};

export default authenticateToken;
