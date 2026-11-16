const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/notifications/deviceNotifications.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;

function loadNotifications({ platform, environment, granted = true, previousToken = null }) {
  const calls = [];
  const storage = new Map(previousToken ? [['ripple.expo-push-token', previousToken]] : []);
  const record = (name, result) => (...args) => {
    calls.push({ name, args });
    return result;
  };
  const modules = {
    'expo-constants': {
      __esModule: true,
      default: {
        executionEnvironment: environment,
        expoConfig: { extra: { eas: { projectId: 'test-project' } } },
      },
      ExecutionEnvironment: { StoreClient: 'storeClient' },
    },
    'expo-linking': { openSettings: record('openSettings') },
    'expo-notifications': {
      IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
      AndroidImportance: { DEFAULT: 3 },
      setNotificationHandler: record('setNotificationHandler'),
      setNotificationChannelAsync: record('setNotificationChannelAsync'),
      getPermissionsAsync: record('getPermissionsAsync', {
        granted,
        status: granted ? 'granted' : 'denied',
      }),
      requestPermissionsAsync: record('requestPermissionsAsync', {
        granted,
        status: granted ? 'granted' : 'denied',
      }),
      getExpoPushTokenAsync: record('getExpoPushTokenAsync', { data: 'test-push-token' }),
    },
    'expo-secure-store': {
      getItemAsync: async (key) => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      deleteItemAsync: async (key) => { storage.delete(key); },
    },
    'react-native': { Platform: { OS: platform } },
    '@/lib/supabase/client': { supabase: { rpc: record('rpc', { error: null }) } },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected native dependency: ${name}`);
      return modules[name];
    },
  });
  return { notifications: exports, calls, storage };
}

for (const [platform, environment] of [
  ['ios', 'storeClient'],
  ['android', 'storeClient'],
  ['web', 'standalone'],
]) {
  test(`${platform} (${environment}) skips device notification APIs and backend registration`, async () => {
    const { notifications, calls } = loadNotifications({ platform, environment });
    assert.equal(notifications.supportsDeviceNotifications, false);
    notifications.configureForegroundNotifications();
    await notifications.ensureAndroidNotificationChannels();
    assert.equal(await notifications.getDeviceNotificationPermission(), 'unsupported');
    assert.equal(await notifications.requestDeviceNotifications(), 'unsupported');
    assert.equal(await notifications.syncPushDeviceRegistration(), 'unsupported');
    await notifications.unregisterCurrentPushDevice();
    assert.deepEqual(calls, []);
  });
}

test('an installed iOS build still registers and persists its push token', async () => {
  const { notifications, calls, storage } = loadNotifications({
    platform: 'ios', environment: 'standalone',
  });
  assert.equal(notifications.supportsDeviceNotifications, true);
  assert.equal(await notifications.syncPushDeviceRegistration(), 'granted');
  const registration = calls.find((call) => call.name === 'rpc');
  assert.equal(registration.args[0], 'register_push_device');
  assert.equal(registration.args[1].p_expo_push_token, 'test-push-token');
  assert.equal(registration.args[1].p_permission_status, 'granted');
  assert.equal(registration.args[1].p_platform, 'ios');
  assert.equal(storage.get('ripple.expo-push-token'), 'test-push-token');
});

test('revoking permission unregisters the previous native push token', async () => {
  const { notifications, calls, storage } = loadNotifications({
    platform: 'ios', environment: 'standalone', granted: false, previousToken: 'old-token',
  });
  assert.equal(await notifications.syncPushDeviceRegistration(), 'denied');
  const registration = calls.find((call) => call.name === 'rpc');
  assert.equal(registration.args[0], 'unregister_push_device');
  assert.equal(registration.args[1].p_expo_push_token, 'old-token');
  assert.equal(storage.has('ripple.expo-push-token'), false);
  assert.equal(calls.some((call) => call.name === 'getExpoPushTokenAsync'), false);
});

test('notification responses without custom data do not navigate', () => {
  const { notifications } = loadNotifications({ platform: 'ios', environment: 'standalone' });
  assert.equal(notifications.getNotificationDestination({
    notification: { request: { content: {} } },
  }), null);
});

test('a notification without a post or profile target opens the activity screen', () => {
  const { notifications } = loadNotifications({ platform: 'ios', environment: 'standalone' });
  assert.equal(notifications.getNotificationDestination({
    notification: { request: { content: { data: { screen: 'notifications' } } } },
  }), '/notifications');
});
