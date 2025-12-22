import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

interface User {
  email: string;
}

interface GlobalState {
  user: User | null;
  dbChatMessages: Message[];
  isAuthenticated: boolean;
}

type GlobalAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_DB_CHAT_MESSAGES'; payload: Message[] }
  | { type: 'ADD_DB_CHAT_MESSAGE'; payload: Message }
  | { type: 'CLEAR_DB_CHAT_MESSAGES' }
  | { type: 'LOGOUT' };

interface GlobalContextType {
  state: GlobalState;
  dispatch: React.Dispatch<GlobalAction>;
}

// Initial state
const initialMessage: Message = {
  id: "welcome",
  text: "Hello! I am your DB assistant. I can help you query the PostgreSQL database. Try asking questions about employees, departments, salaries, or titles!",
  isUser: false,
  timestamp: new Date().toISOString()
};

const initialState: GlobalState = {
  user: null,
  dbChatMessages: [initialMessage],
  isAuthenticated: false,
};

// Reducer
const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
      };
    case 'SET_DB_CHAT_MESSAGES':
      return {
        ...state,
        dbChatMessages: action.payload,
      };
    case 'ADD_DB_CHAT_MESSAGE':
      return {
        ...state,
        dbChatMessages: [...state.dbChatMessages, action.payload],
      };
    case 'CLEAR_DB_CHAT_MESSAGES':
      return {
        ...state,
        dbChatMessages: [initialMessage],
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      localStorage.removeItem('dbchat_messages');
      return {
        ...initialState,
        dbChatMessages: [initialMessage],
      };
    default:
      return state;
  }
};

// Context
const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// Hook
export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within a GlobalProvider');
  }
  return context;
};

// Provider
interface GlobalProviderProps {
  children: ReactNode;
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, initialState);

  // Load data from localStorage on mount
  useEffect(() => {
    // Load chat messages
    const savedMessages = localStorage.getItem('dbchat_messages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        if (parsedMessages.length > 0) {
          dispatch({ type: 'SET_DB_CHAT_MESSAGES', payload: parsedMessages });
        }
      } catch (e) {
        console.log('Failed to parse saved messages');
      }
    }
  }, []);

  // Save chat messages to localStorage whenever they change
  useEffect(() => {
    if (state.dbChatMessages.length > 0) {
      localStorage.setItem('dbchat_messages', JSON.stringify(state.dbChatMessages));
    }
  }, [state.dbChatMessages]);

  return (
    <GlobalContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalContext.Provider>
  );
};
