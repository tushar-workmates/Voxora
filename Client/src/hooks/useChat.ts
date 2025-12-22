import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchChatSession = async (): Promise<ChatMessage[]> => {
  const response = await fetch(`${API_URL}/chat/session`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch chat session');
  }
  
  const data = await response.json();
  return data.messages || [];
};

const sendMessage = async (message: string): Promise<ChatMessage> => {
  const token = localStorage.getItem("token");
  let userId = "default";
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.id || "default";
    } catch (e) {
      console.error('Error parsing token:', e);
    }
  }

  const response = await fetch(`${API_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ 
      query: message,
      session_id: `session_${userId}`
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
  
  const data = await response.json();
  return data.message;
};

export const useChat = () => {
  const queryClient = useQueryClient();
  
  // Get user ID for cache key
  const getUserId = () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || "default";
      } catch (e) {
        return "default";
      }
    }
    return "default";
  };

  const userId = getUserId();
  
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', userId],
    queryFn: fetchChatSession,
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onMutate: async (newMessage: string) => {
      await queryClient.cancelQueries({ queryKey: ['chat', userId] });
      
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(['chat', userId]);
      
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        text: newMessage,
        isUser: true,
        timestamp: new Date().toISOString(),
      };
      
      queryClient.setQueryData<ChatMessage[]>(['chat', userId], old => [...(old || []), userMessage]);
      
      return { previousMessages };
    },
    onSuccess: (aiMessage) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', userId], old => [...(old || []), aiMessage]);
    },
    onError: (err, newMessage, context) => {
      queryClient.setQueryData(['chat', userId], context?.previousMessages);
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  };
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
  });
};
