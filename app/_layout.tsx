import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@providers/AuthProvider';
import { ImageZoomProvider } from '@providers/ImageZoomProvider';
import { QueryProvider } from '@providers/QueryProvider';
import { ThemeProvider } from '@providers/ThemeProvider';
import { LoadingScreen } from '@components/common';
import { DevAccountSwitcher } from '@components/dev/DevAccountSwitcher';
import { supabase } from '@lib/supabase';

function handleSplashScreenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  // Expo Go and Fast Refresh can remount the JS app after the native splash
  // controller has already been removed. That is safe to ignore.
  if (!message.includes('No native splash screen registered')) {
    console.warn('Splash screen lifecycle error:', error);
  }
}

// Keep the native splash visible while the initial auth state is loading.
void SplashScreen.preventAutoHideAsync().catch(handleSplashScreenError);

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
  const hasHiddenSplash = useRef(false);

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
    if (isLoading || hasHiddenSplash.current) return;

    hasHiddenSplash.current = true;
    void SplashScreen.hideAsync().catch(handleSplashScreenError);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

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
        <Stack.Screen name="friends" />
        <Stack.Screen
          name="edit-post"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="crop"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ImageZoomProvider>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <RootLayoutNav />
              <DevAccountSwitcher />
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </ImageZoomProvider>
    </GestureHandlerRootView>
  );
}
