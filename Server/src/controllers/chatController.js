const Chat = require('../models/Chat');

const saveChat = async (request, reply) => {
  try {
    const { sessionId, messages } = request.body;
    const userId = request.user.id;

    await Chat.findOneAndUpdate(
      { userId, sessionId },
      { messages, lastActivity: new Date() },
      { upsert: true, new: true }
    );

    reply.send({ success: true });
  } catch (error) {
    reply.code(500).send({ success: false, message: error.message });
  }
};

const loadChat = async (request, reply) => {
  try {
    const { sessionId } = request.params;
    const userId = request.user.id;

    const chat = await Chat.findOne({ userId, sessionId });
    
    reply.send({ 
      success: true, 
      messages: chat ? chat.messages : [] 
    });
  } catch (error) {
    reply.code(500).send({ success: false, message: error.message });
  }
};

const getChatSessions = async (request, reply) => {
  try {
    const userId = request.user.id;
    
    const sessions = await Chat.find({ userId })
      .select('sessionId lastActivity')
      .sort({ lastActivity: -1 });

    reply.send({ success: true, sessions });
  } catch (error) {
    reply.code(500).send({ success: false, message: error.message });
  }
};

module.exports = { saveChat, loadChat, getChatSessions };
