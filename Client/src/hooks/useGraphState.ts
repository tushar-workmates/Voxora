import { useState, useEffect } from 'react';
import { saveGraphState, loadGraphState } from '@/services/api';

export const useGraphState = (sessionId: string) => {
  const [state, setState] = useState({ messages: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadState();
  }, [sessionId]);

  const loadState = async () => {
    try {
      const result = await loadGraphState(sessionId);
      if (result.success && result.state) {
        setState(result.state);
      }
    } catch (error) {
      console.log('Failed to load state');
    } finally {
      setIsLoading(false);
    }
  };

  const updateState = async (newState: any) => {
    setState(newState);
    try {
      await saveGraphState(sessionId, newState);
    } catch (error) {
      console.log('Failed to save state');
    }
  };

  return { state, updateState, isLoading };
};
