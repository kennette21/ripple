const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function contactsHarness() {
  const state = {
    permission: { status: 'undetermined', canAskAgain: true },
    reads: 0, prompts: 0, contactReads: 0, profileReads: 0,
    request: null, queryError: null,
  };
  const slots = [];
  const effects = [];
  let cursor = 0;
  let mounted = false;
  let onAppState;
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value) => { slots[index] = value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useCallback: (callback) => callback,
      useEffect: (effect) => { if (!mounted) effects.push(effect); },
    },
    'react-native': { AppState: {
      currentState: 'active',
      addEventListener: (_, listener) => {
        onAppState = listener;
        return { remove: () => { onAppState = null; } };
      },
    } },
    'expo-contacts': {
      getPermissionsAsync: async () => { state.reads++; return state.permission; },
      requestPermissionsAsync: async () => {
        state.prompts++;
        return state.request ? state.request() : state.permission;
      },
      Fields: { PhoneNumbers: 'phoneNumbers', Name: 'name' },
      getContactsAsync: async () => {
        state.contactReads++;
        return { data: [{ name: 'A friend', phoneNumbers: [{ number: '+1 (555) 123-4567' }] }] };
      },
    },
    '@tanstack/react-query': { useQuery: (options) => options },
    '@/lib/query/keys': { queryKeys: { friends: { contacts: (id) => ['contacts', id] } } },
    '@/lib/supabase/client': { supabase: { from: () => ({ select: () => ({ not: () => ({
      neq: async () => {
        state.profileReads++;
        return { data: [{ id: 'friend', phone_number: '5551234567' }], error: state.queryError };
      },
    }) }) }) } },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/hooks/social/useContacts.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return {
    state,
    query: exports.useContactsOnRipple,
    render() { cursor = 0; return exports.useRequestContactsPermission(); },
    async mount() {
      const cleanups = effects.map((effect) => effect());
      mounted = true;
      await new Promise(setImmediate);
      return () => cleanups.forEach((cleanup) => cleanup?.());
    },
    async resume() {
      onAppState('background');
      onAppState('active');
      await new Promise(setImmediate);
    },
  };
}

test('mounting and returning from Settings only check permission; they never request access', async () => {
  const h = contactsHarness();
  h.render();
  const cleanup = await h.mount();
  assert.equal(h.state.prompts, 0);
  assert.equal(h.render().permission.status, 'undetermined');
  h.state.permission = { status: 'granted', accessPrivileges: 'limited' };
  await h.resume();
  assert.equal(h.render().permission.status, 'granted');
  h.state.permission = { status: 'denied', canAskAgain: false };
  await h.resume();
  assert.equal(h.render().permission.status, 'denied');
  assert.equal(h.state.prompts, 0);
  assert.equal(h.state.contactReads, 0);
  cleanup();
});

test('only the explicit action prompts, denial stays quiet, and duplicate taps do not prompt twice', async () => {
  const h = contactsHarness();
  const hook = h.render();
  await h.mount();
  let finish;
  h.state.request = () => new Promise((resolve) => { finish = resolve; });
  const first = hook.requestPermission();
  assert.equal(h.render().isRequesting, true);
  assert.equal(await hook.requestPermission(), false);
  finish({ status: 'denied', canAskAgain: false });
  assert.equal(await first, false);
  assert.equal(h.state.prompts, 1);
  assert.equal(h.render().permission.status, 'denied');
  assert.equal(h.render().isRequesting, false);
  assert.equal(h.render().error, null);
});

test('query retries cannot request permission or read the phonebook without existing access', async () => {
  const h = contactsHarness();
  assert.equal(h.query('viewer', false).enabled, false);
  assert.equal(h.query(undefined, true).enabled, false);
  assert.equal(h.query('viewer', true).enabled, true);
  const query = h.query('viewer', false);
  await query.queryFn();
  assert.equal(h.state.prompts, 0);
  assert.equal(h.state.contactReads, 0);
  assert.equal(h.state.profileReads, 0);
  h.state.permission = { status: 'granted', accessPrivileges: 'limited' };
  const matches = await query.queryFn();
  assert.equal(matches.length, 1);
  assert.equal(matches[0].contactName, 'A friend');
  assert.equal(h.state.contactReads, 1);
  assert.equal(h.state.prompts, 0);
  h.state.queryError = new Error('Offline');
  await assert.rejects(query.queryFn(), /Offline/);
});

test('permission request failures can be retried without leaving the action busy', async () => {
  const h = contactsHarness();
  h.render();
  await h.mount();
  h.state.request = async () => { throw new Error('Device unavailable'); };
  assert.equal(await h.render().requestPermission(), false);
  assert.match(h.render().error.message, /Device unavailable/);
  assert.equal(h.render().isRequesting, false);
  h.state.request = null;
  h.state.permission = { status: 'granted' };
  assert.equal(await h.render().requestPermission(), true);
  assert.equal(h.render().error, null);
});
