import { supabase } from './client';
import type { AuthError, User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

// Sign up with email and password
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  return { user: data.user, error };
}

// Sign in with email and password
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { user: data.user, error };
}

// Sign in with magic link (passwordless)
export async function signInWithMagicLink(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // This is the URL the user will be redirected to after clicking the magic link
      emailRedirectTo: 'ripple://auth/callback',
    },
  });

  return { error };
}

// Sign out
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Reset password
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'ripple://auth/reset-password',
  });

  return { error };
}

// Update password (when user is already authenticated)
export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { error };
}

// Verify OTP (for magic link callback)
export async function verifyOtp(
  email: string,
  token: string,
  type: 'email' | 'magiclink' = 'magiclink'
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type,
  });

  return { user: data.user, error };
}
