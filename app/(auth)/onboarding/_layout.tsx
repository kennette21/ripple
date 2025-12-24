import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'white' },
        gestureEnabled: false, // Prevent swiping back during onboarding
      }}
    >
      <Stack.Screen name="manifesto" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="discover" />
    </Stack>
  );
}
