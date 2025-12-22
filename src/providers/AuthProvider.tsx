import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    setSession,
    setProfile,
    setLoading,
    setInitialized,
  } = useAuthStore();

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (profile doesn't exist yet)
        console.error('Error fetching profile:', error);
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  }, [setProfile]);

  // Refresh profile (can be called after profile updates)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(initialSession);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    }

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        console.log('Auth event:', event);
        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading, setInitialized, fetchProfile]);

  const isAuthenticated = !!session?.user;
  const needsOnboarding = isAuthenticated && (!profile || !profile.onboarding_completed);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isLoading,
    isAuthenticated,
    needsOnboarding,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
