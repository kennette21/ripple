const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const projectRoot = path.resolve(__dirname, "..");
const appId = "com.proxy.ripple";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const supabaseArgs = ["--yes", "supabase@2.109.1"];
const localSupabaseUrl =
  `http://${process.env.LOCAL_SUPABASE_HOST ?? "127.0.0.1"}:54321`;
const localSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImV4cCI6MTk4MzgxMjk5Nn0.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const maestroFlows = [
  { tag: "auth", label: "sign in and sign out" },
  { tag: "photo-viewer", label: "photo gallery and fullscreen viewer" },
  { tag: "comments", label: "comment lifecycle" },
  { tag: "search-follow", label: "search and follow state" },
  { tag: "private-post-owner", label: "owner post privacy" },
  { tag: "private-post-visitor", label: "visitor post privacy" },
  { tag: "profile-edit", label: "profile editing" },
  { tag: "photo-post", label: "photo post publishing" },
  { tag: "post-lifecycle", label: "reflection lifecycle" },
];

function readOption(name) {
  const inlinePrefix = `${name}=`;
  const inlineValue = process.argv.find((argument) => argument.startsWith(inlinePrefix));
  if (inlineValue) return inlineValue.slice(inlinePrefix.length);

  const optionIndex = process.argv.indexOf(name);
  return optionIndex >= 0 ? process.argv[optionIndex + 1] : undefined;
}

const requestedTags = readOption("--include-tags")
  ?.split(",")
  .map((tag) => tag.trim())
  .filter(Boolean);
const selectedFlows = requestedTags?.length
  ? maestroFlows.filter((flow) => requestedTags.includes(flow.tag))
  : maestroFlows;

let metroProcess = null;
let activeProcess = null;
let stopping = false;

function printStep(message) {
  console.log(`\n[visual e2e] ${message}`);
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

async function runSyncWithRetries(command, args, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      runSync(command, args);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      const retryDelayMs = attempt * 3000;
      console.warn(
        `[visual e2e] Command failed; retrying in ${retryDelayMs / 1000}s ` +
        `(${attempt}/${attempts})`
      );
      await delay(retryDelayMs);
    }
  }
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      ...options,
    });
    activeProcess = child;

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (activeProcess === child) activeProcess = null;
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} ${signal ? `was stopped by ${signal}` : `exited with ${code}`}`
        )
      );
    });
  });
}

function getBootedSimulator() {
  const result = spawnSync(
    "xcrun",
    ["simctl", "list", "devices", "booted", "--json"],
    { cwd: projectRoot, encoding: "utf8" }
  );

  if (result.status !== 0) return null;

  const runtimes = Object.values(JSON.parse(result.stdout).devices ?? {});
  return runtimes.flat().find((device) => device.state === "Booted") ?? null;
}

async function waitForBootedSimulator(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const simulator = getBootedSimulator();
    if (simulator) return simulator;
    await delay(1000);
  }

  throw new Error("No iOS Simulator booted within 60 seconds.");
}

function isAppInstalled(udid) {
  const result = spawnSync(
    "xcrun",
    ["simctl", "get_app_container", udid, appId],
    { cwd: projectRoot, stdio: "ignore" }
  );
  return result.status === 0;
}

function isMetroRunning() {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:8081/status", (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body.includes("packager-status:running")));
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function waitForMetro(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isMetroRunning()) return;
    if (metroProcess?.exitCode !== null) {
      throw new Error("Metro stopped before it became ready.");
    }
    await delay(1000);
  }

  throw new Error("Metro did not become ready within 60 seconds.");
}

function stopMetro() {
  if (!metroProcess || metroProcess.exitCode !== null) return;

  try {
    if (process.platform !== "win32") {
      process.kill(-metroProcess.pid, "SIGTERM");
    } else {
      metroProcess.kill("SIGTERM");
    }
  } catch {
    metroProcess.kill("SIGTERM");
  }
}

function stopChildren(signal) {
  if (stopping) return;
  stopping = true;
  activeProcess?.kill(signal);
  stopMetro();
}

process.on("SIGINT", () => {
  stopChildren("SIGINT");
  process.exitCode = 130;
});
process.on("SIGTERM", () => {
  stopChildren("SIGTERM");
  process.exitCode = 143;
});

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("The visual Maestro runner currently requires macOS and iOS Simulator.");
  }

  if (selectedFlows.length === 0) {
    throw new Error(
      `No visual flows matched --include-tags=${requestedTags.join(",")}`
    );
  }

  printStep("Opening the iOS Simulator");
  runSync("open", ["-a", "Simulator"]);
  const simulator = await waitForBootedSimulator();
  runSync("xcrun", ["simctl", "bootstatus", simulator.udid, "-b"]);
  console.log(`[visual e2e] Using ${simulator.name} (${simulator.udid})`);

  if (!isAppInstalled(simulator.udid)) {
    printStep("Ripple is not installed; building the development app once");
    await runAsync(npxCommand, [
      "expo",
      "run:ios",
      "--no-bundler",
      "--device",
      simulator.udid,
    ]);
  }

  printStep("Starting local Supabase and resetting deterministic seed data");
  await runSyncWithRetries(
    npxCommand,
    [...supabaseArgs, "start", "--yes"]
  );
  await runSyncWithRetries(
    npxCommand,
    [...supabaseArgs, "db", "reset", "--yes"]
  );

  if (await isMetroRunning()) {
    printStep("Using the Metro server already running on port 8081");
  } else {
    printStep("Starting Metro with the local Supabase configuration");
    metroProcess = spawn(npmCommand, ["run", "start"], {
      cwd: projectRoot,
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        EXPO_NO_INTERACTIVE: "1",
        EXPO_PUBLIC_LOCAL_SUPABASE_URL: localSupabaseUrl,
        EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY: localSupabaseAnonKey,
      },
    });
    metroProcess.once("error", (error) => {
      console.error("[visual e2e] Metro failed:", error);
    });
    await waitForMetro();
  }

  printStep("Running the ordered Maestro suite in the visible simulator");
  const failedFlows = [];
  for (const flow of selectedFlows) {
    console.log(`\n[visual e2e] Flow: ${flow.label}`);
    try {
      await runAsync("maestro", [
        "test",
        "--config",
        "e2e/maestro/config.yaml",
        "--include-tags",
        flow.tag,
        ".",
      ]);
    } catch (error) {
      failedFlows.push(flow.label);
      console.error(`[visual e2e] Failed: ${flow.label} (${error.message})`);
    }
  }

  if (failedFlows.length > 0) {
    throw new Error(
      `${failedFlows.length} Maestro flow(s) failed: ${failedFlows.join(", ")}`
    );
  }
  printStep("All visual end-to-end flows passed");
}

main()
  .catch((error) => {
    console.error(`\n[visual e2e] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    stopMetro();
  });
