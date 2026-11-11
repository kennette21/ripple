const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

function load(file, modules = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}

const keys = load('src/lib/query/keys.ts').queryKeys;

function peopleQuery(query, profiles = [], failedTable) {
  const requests = [];
  const supabase = createClient('https://ripple.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(input);
      requests.push(url);
      if (url.pathname.endsWith(`/${failedTable}`)) {
        return new Response(JSON.stringify({ message: 'Request failed' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
      const rows = url.pathname.endsWith('/profiles') ? profiles
        : url.pathname.endsWith('/blocks') ? [{ blocked_id: 'blocked' }]
          : [{ following_id: 'person-0' }];
      return new Response(JSON.stringify(rows), { status: 200,
        headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const { useCommunityPeople } = load('src/hooks/social/useCommunityPeople.ts', {
    '@tanstack/react-query': { useInfiniteQuery: (options) => options },
    '@/lib/query/keys': { queryKeys: keys },
    '@/lib/supabase/client': { supabase },
  });
  const options = useCommunityPeople(query, 'viewer');
  return { requests, options, useCommunityPeople, run: (offset = 0) => options.queryFn({
    pageParam: offset, signal: new AbortController().signal,
  }) };
}

test('community pages are bounded and fetch follow state only for returned people', async () => {
  const profiles = Array.from({ length: 31 }, (_, i) => ({ id: `person-${i}`, username: `user_${i}` }));
  const query = peopleQuery('', profiles);
  const first = await query.run();
  assert.equal(first.people.length, 30);
  assert.equal(first.people[0].isFollowing, true);
  assert.equal(first.people[1].isFollowing, false);
  assert.equal(query.options.getNextPageParam(first), 30);
  const request = query.requests.find((url) => url.pathname.endsWith('/profiles'));
  assert.equal(request.searchParams.get('limit'), '31');
  assert.equal(request.searchParams.get('id'), 'neq.viewer');
  assert.equal(request.searchParams.get('order'), 'created_at.desc,id.desc');
  assert.equal(request.searchParams.get('select'), 'id,username,display_name,avatar_url');
  assert.deepEqual(request.searchParams.getAll('id'), ['neq.viewer', 'not.in.(blocked)']);
  const follows = query.requests.find((url) => url.pathname.endsWith('/follows'));
  assert.equal(follows.searchParams.get('following_id').includes('person-30'), false);
  await query.run(first.nextOffset);
  assert.equal(query.requests.filter((url) => url.pathname.endsWith('/profiles'))[1].searchParams.get('offset'), '30');
});

test('search accepts @handles and treats wildcard and filter punctuation as literal text', async () => {
  const query = peopleQuery('  @a_%,x"  ');
  await query.run();
  assert.equal(query.options.queryKey.at(-1), 'a_%,x"');
  const filter = query.requests.find((url) => url.pathname.endsWith('/profiles')).searchParams.get('or');
  assert.equal(filter, '(username.ilike."%a\\\\_\\\\%,x\\"%",display_name.ilike."%a\\\\_\\\\%,x\\"%")');
  assert.equal(query.requests.some((url) => url.pathname.endsWith('/follows')), false);
  assert.equal(query.useCommunityPeople('', 'viewer', false).enabled, false);
});

test('search failures remain errors and a short final page stops pagination', async () => {
  const query = peopleQuery('absent');
  const page = await query.run();
  assert.equal(page.people.length, 0);
  assert.equal(query.options.getNextPageParam(page), undefined);
  const failed = peopleQuery('someone', [], 'profiles');
  await assert.rejects(failed.run(), (error) => error.message === 'Request failed');
});
