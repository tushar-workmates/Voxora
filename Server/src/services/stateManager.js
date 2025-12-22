const sessions = new Map();

class StateManager {
  static saveState(sessionId, state) {
    sessions.set(sessionId, JSON.stringify(state));
  }

  static loadState(sessionId) {
    const state = sessions.get(sessionId);
    return state ? JSON.parse(state) : null;
  }

  static clearState(sessionId) {
    sessions.delete(sessionId);
  }
}

module.exports = StateManager;
