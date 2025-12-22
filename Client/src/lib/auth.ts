import { queryClient } from './queryClient';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const logout = async () => {
  const token = localStorage.getItem("token");
  
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
  }
  
  // Clear React Query cache and localStorage
  queryClient.clear();
  localStorage.removeItem("token");
  
  // Redirect to login
  window.location.href = '/login';
};
