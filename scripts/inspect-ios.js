const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { build } = require('../eas.json');

const args = process.argv.slice(2);
const startOnly = args[0] === '--start';
if (startOnly) args.shift();

const productionEnv = build.production.env;

console.log(`Inspecting Ripple against ${productionEnv.EXPO_PUBLIC_SUPABASE_URL}`);

const result = spawnSync(
  process.execPath,
  [
    require.resolve('expo/bin/cli'),
    ...(startOnly
      ? ['start', '--dev-client', '--localhost', '--scheme', 'exp+ripple']
      : ['run:ios']),
    ...args,
  ],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: productionEnv.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: productionEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // Clear local overrides inherited from the shell or Expo dotenv files.
      EXPO_PUBLIC_LOCAL_SUPABASE_URL: '',
      EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY: '',
    },
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
