const StateManager = require('../services/stateManager');

const saveGraphState = async (request, reply) => {
  try {
    const { sessionId, state } = request.body;
    StateManager.saveState(sessionId, state);
    reply.send({ success: true });
  } catch (error) {
    reply.code(500).send({ success: false, message: error.message });
  }
};

const loadGraphState = async (request, reply) => {
  try {
    const { sessionId } = request.params;
    const state = StateManager.loadState(sessionId);
    reply.send({ success: true, state });
  } catch (error) {
    reply.code(500).send({ success: false, message: error.message });
  }
};

module.exports = { saveGraphState, loadGraphState };
