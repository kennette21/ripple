import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

const PUSH_TOKEN_STORAGE_KEY = 'ripple.expo-push-token';

export type DeviceNotificationPermission =
  | 'denied'
  | 'granted'
  | 'provisional'
  | 'undetermined'
  | 'unsupported';

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function mapPermission(
  permission: Notifications.NotificationPermissionsStatus
): DeviceNotificationPermission {
  const iosStatus = permission.ios?.status;

  if (
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'provisional';
  }

  if (permission.granted) return 'granted';
  if (permission.status === 'denied') return 'denied';
  return 'undetermined';
}

export function configureForegroundNotifications() {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Promise.all([
    Notifications.setNotificationChannelAsync('new-posts', {
      name: 'New posts',
      description: 'New posts from people you follow',
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('activity', {
      name: 'Activity',
      description: 'Comments, replies, and new followers',
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
      sound: 'default',
    }),
  ]);
}

export async function getDeviceNotificationPermission():
  Promise<DeviceNotificationPermission> {
  if (Platform.OS === 'web') return 'unsupported';

  const permission = await Notifications.getPermissionsAsync();
  return mapPermission(permission);
}

export async function unregisterCurrentPushDevice() {
  if (Platform.OS === 'web') return;

  const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  const { error } = await supabase.rpc('unregister_push_device', {
    p_expo_push_token: token,
  });

  if (error) throw error;
  await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
}

export async function syncPushDeviceRegistration() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return 'unsupported' as const;
  }

  await ensureAndroidNotificationChannels();
  const permission = await Notifications.getPermissionsAsync();
  const permissionStatus = mapPermission(permission);

  if (
    permissionStatus !== 'granted' &&
    permissionStatus !== 'provisional'
  ) {
    await unregisterCurrentPushDevice();
    return permissionStatus;
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('Expo project ID is unavailable');
  }

  const previousToken = await SecureStore.getItemAsync(
    PUSH_TOKEN_STORAGE_KEY
  );
  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  const { error } = await supabase.rpc('register_push_device', {
    p_expo_push_token: token,
    p_permission_status: permissionStatus,
    p_platform: Platform.OS,
    p_previous_expo_push_token: previousToken,
  });

  if (error) throw error;

  await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
  return permissionStatus;
}

export async function requestDeviceNotifications() {
  if (Platform.OS === 'web') return 'unsupported' as const;

  await ensureAndroidNotificationChannels();
  const permission = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  const permissionStatus = mapPermission(permission);

  if (
    permissionStatus === 'granted' ||
    permissionStatus === 'provisional'
  ) {
    await syncPushDeviceRegistration();
  } else {
    await unregisterCurrentPushDevice();
  }

  return permissionStatus;
}

export async function openDeviceNotificationSettings() {
  await Linking.openSettings();
}

export function getNotificationDestination(
  response: Notifications.NotificationResponse
) {
  const data = response.notification.request.content.data;

  if (typeof data.postId === 'string') {
    return {
      pathname: '/post/[id]' as const,
      params: { id: data.postId },
    };
  }

  if (typeof data.profileId === 'string') {
    return {
      pathname: '/user/[id]' as const,
      params: { id: data.profileId },
    };
  }

  if (data.screen === 'notifications') {
    return '/(main)/(notifications)' as const;
  }

  return null;
}
