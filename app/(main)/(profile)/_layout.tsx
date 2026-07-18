import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="recently-deleted" />
      <Stack.Screen name="settings/index" />
    </Stack>
  );
}
