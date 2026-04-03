import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@providers/AuthProvider';
import { QueryProvider } from '@providers/QueryProvider';
import { ThemeProvider } from '@providers/ThemeProvider';
import { LoadingScreen } from '@components/common';
import { supabase } from '@lib/supabase';

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync();

function extractSessionFromUrl(url: string) {
  const fragment = url.split('#')[1];
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

function RootLayoutNav() {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle deep links with auth tokens
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const tokens = extractSessionFromUrl(event.url);
      if (tokens) {
        supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
      }
    }

    // Handle URL that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Listen for incoming links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    // Hide splash screen once we've determined auth state
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = (segments as string[]).includes('onboarding');

    if (!isAuthenticated && !inAuthGroup) {
      // User is not signed in, redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && needsOnboarding && !inOnboarding) {
      // User is signed in but hasn't completed onboarding
      // Start with manifesto for new users, profile-setup for returning users
      router.replace('/(auth)/onboarding/manifesto');
    } else if (isAuthenticated && !needsOnboarding && inAuthGroup) {
      // User is signed in and has completed onboarding, go to main app
      router.replace('/(main)/(feed)');
    }
  }, [isLoading, isAuthenticated, needsOnboarding, segments]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen
          name="(shared)"
          options={{
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
