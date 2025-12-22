const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  text: { type: String, required: true },
  isUser: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  messages: [messageSchema],
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true
});

chatSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema);
