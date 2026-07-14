const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const supabaseArgs = ["--yes", "supabase@2.109.1"];
const localSupabaseUrl = `http://${process.env.LOCAL_SUPABASE_HOST ?? "127.0.0.1"}:54321`;
const localSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const resetDatabase = process.argv.includes("--reset-db");

const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--reset-db");
if (unknownArgs.length > 0) {
  console.error(`Unknown option: ${unknownArgs.join(", ")}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npxCommand, [...supabaseArgs, "start", "--yes"]);
if (resetDatabase) {
  run(npxCommand, [...supabaseArgs, "db", "reset", "--yes"]);
}
run(npmCommand, ["run", "start"], {
  env: {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: localSupabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: localSupabaseAnonKey,
  },
});
