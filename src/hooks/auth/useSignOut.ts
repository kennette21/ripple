import { useState } from 'react';
import { signOut as supabaseSignOut } from '@lib/supabase';
import { queryClient } from '@lib/queryClient';

interface UseSignOutResult {
  signOut: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useSignOut(): UseSignOutResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabaseSignOut();

      if (authError) {
        setError(authError.message);
      } else {
        // Clear all cached queries on sign out
        queryClient.clear();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signOut,
    isLoading,
    error,
  };
}
