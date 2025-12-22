import { useState } from 'react';
import { signUpWithEmail } from '@lib/supabase';

interface UseSignUpResult {
  signUp: (email: string, password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  resetError: () => void;
}

export function useSignUp(): UseSignUpResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { user, error: authError } = await signUpWithEmail(email, password);

      if (authError) {
        setError(authError.message);
        return false;
      }

      return !!user;
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetError = () => setError(null);

  return {
    signUp,
    isLoading,
    error,
    resetError,
  };
}
