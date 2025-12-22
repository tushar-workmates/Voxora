import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

interface DbChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  query?: string;
  results?: any[];
  error?: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchDbChatSession = async (): Promise<DbChatMessage[]> => {
  const response = await fetch(`${API_URL}/db-chat/session`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch db chat session');
  }
  
  const data = await response.json();
  return data.messages || [];
};

const sendDbMessage = async (message: string): Promise<DbChatMessage> => {
  const response = await fetch(`${API_URL}/db-chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ message }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to send db message');
  }
  
  const data = await response.json();
  return data.message;
};

export const useDbChat = () => {
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
    queryKey: ['dbChat', userId],
    queryFn: fetchDbChatSession,
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendDbMessage,
    onMutate: async (newMessage: string) => {
      await queryClient.cancelQueries({ queryKey: ['dbChat', userId] });
      
      const previousMessages = queryClient.getQueryData<DbChatMessage[]>(['dbChat', userId]);
      
      const userMessage: DbChatMessage = {
        id: `temp-${Date.now()}`,
        text: newMessage,
        isUser: true,
        timestamp: new Date().toISOString(),
      };
      
      queryClient.setQueryData<DbChatMessage[]>(['dbChat', userId], old => [...(old || []), userMessage]);
      
      return { previousMessages };
    },
    onSuccess: (aiMessage) => {
      queryClient.setQueryData<DbChatMessage[]>(['dbChat', userId], old => [...(old || []), aiMessage]);
    },
    onError: (err, newMessage, context) => {
      queryClient.setQueryData(['dbChat', userId], context?.previousMessages);
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  };
};

export const useDbLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/db-auth/logout`, {
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
