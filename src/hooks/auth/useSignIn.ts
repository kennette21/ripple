import { useState } from 'react';
import { signInWithEmail, signInWithMagicLink } from '@lib/supabase';

interface UseSignInResult {
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMagic: (email: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  magicLinkSent: boolean;
  resetError: () => void;
}

export function useSignIn(): UseSignInResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await signInWithEmail(email, password);

      if (authError) {
        setError(authError.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithMagic = async (email: string) => {
    setIsLoading(true);
    setError(null);
    setMagicLinkSent(false);

    try {
      const { error: authError } = await signInWithMagicLink(email);

      if (authError) {
        setError(authError.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetError = () => setError(null);

  return {
    signIn,
    signInWithMagic,
    isLoading,
    error,
    magicLinkSent,
    resetError,
  };
}
