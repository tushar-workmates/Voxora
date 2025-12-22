import { useState } from 'react';
import { useGraphState } from '@/hooks/useGraphState';

const getOrCreateSessionId = () => {
  const EXPIRY_HOURS = 4;
  const stored = localStorage.getItem('chat_session');
  
  if (stored) {
    const { sessionId, timestamp } = JSON.parse(stored);
    const isExpired = Date.now() - timestamp > EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (!isExpired) {
      // Update timestamp for activity
      localStorage.setItem('chat_session', JSON.stringify({ sessionId, timestamp: Date.now() }));
      return sessionId;
    }
  }
  
  // Create new session
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('chat_session', JSON.stringify({ sessionId: newSessionId, timestamp: Date.now() }));
  return newSessionId;
};

export const PersistentChat = () => {
  const sessionId = getOrCreateSessionId();
  const { state, updateState, isLoading } = useGraphState(sessionId);
  const [input, setInput] = useState('');

  const addMessage = (content: string, role: 'user' | 'assistant') => {
    const newMessages = [...state.messages, { role, content, timestamp: Date.now() }];
    updateState({ ...state, messages: newMessages });
    
    // Update activity timestamp
    const stored = localStorage.getItem('chat_session');
    if (stored) {
      const session = JSON.parse(stored);
      localStorage.setItem('chat_session', JSON.stringify({ ...session, timestamp: Date.now() }));
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage(input, 'user');
    setInput('');
    
    // Simulate AI response
    setTimeout(() => {
      addMessage('AI response here', 'assistant');
    }, 1000);
  };

  if (isLoading) return <div>Loading chat...</div>;

  return (
    <div>
      <div className="messages">
        {state.messages.map((msg: any, i: number) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};
