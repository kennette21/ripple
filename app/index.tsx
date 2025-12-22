import { Redirect } from 'expo-router';
import { useAuth } from '@providers/AuthProvider';
import { LoadingScreen } from '@components/common';

export default function Index() {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(auth)/onboarding/profile-setup" />;
  }

  return <Redirect href="/(main)/(feed)" />;
}
