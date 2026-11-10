// Real-browser, real-Python end-to-end test for the host bridge: spawns
// `tests/hosts/fixtures/e2e_server.py` (a fake-provider session served over
// the real `LocalHostServer`/WebSocket protocol), drives the page with a
// real Chromium via Playwright, and confirms both halves of the round trip
// this project is actually for:
//
//   Python -> browser: the generated widget renders the real `data` rows
//     the session was created with (not a fixture DOM, the live snapshot).
//   browser -> Python: clicking a row calls `model.set/save_changes`, which
//     the WebSocket carries back to `HostSession.apply_changes`, and
//     `session.get_output("selection")` (exposed here via a debug HTTP
//     endpoint, see the fixture) reflects the click.
//
// Requires: Playwright's Chromium (`npx playwright install chromium`) and a
// Python environment with this repo importable (`PYTHONPATH` is set below
// to `src/`, matching how the rest of the test suite runs against the
// source tree rather than an installed wheel).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SERVER_SCRIPT = path.join(REPO_ROOT, "tests", "hosts", "fixtures", "e2e_server.py");

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.env.PYTHON || "python3", [SERVER_SCRIPT], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PYTHONPATH: path.join(REPO_ROOT, "src"),
        VIBE_PROVIDER: "fake",
        VIBE_DISABLE_BUNDLING: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`e2e_server.py did not become ready in time.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 30000);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const newlineIndex = stdout.indexOf("\n");
      if (newlineIndex !== -1) {
        clearTimeout(timeout);
        try {
          const info = JSON.parse(stdout.slice(0, newlineIndex));
          resolve({ proc, ...info });
        } catch (err) {
          reject(new Error(`could not parse e2e_server.py's ready line: ${stdout.slice(0, newlineIndex)}`));
        }
      }
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`e2e_server.py exited early with code ${code}.\nstderr:\n${stderr}`));
      }
    });
  });
}

function stopServer(proc) {
  return new Promise((resolve) => {
    proc.once("exit", resolve);
    proc.kill("SIGTERM");
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already exited */
      }
      resolve();
    }, 3000);
  });
}

test("live host bridge: Python data renders in the browser, and a browser click updates a Python output", async (t) => {
  const { proc, page_url: pageUrl, debug_url: debugUrl } = await startServer();
  t.after(() => stopServer(proc));

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(pageUrl);
  // Some execution modes gate first render behind an audit acknowledgement;
  // the default (auto) mode does not, so this is best-effort rather than
  // required.
  try {
    await page.getByRole("button", { name: "I Understand" }).click({ timeout: 3000 });
  } catch {
    /* no audit gate shown - fine, that's the default (auto) execution mode */
  }

  // The table renders the real rows the Python session was created with -
  // proof this is live data over the wire, not a static fixture.
  await page.getByRole("cell", { name: "5", exact: true }).waitFor({ timeout: 15000 });
  const bodyText = await page.textContent("body");
  // Browsers collapse whitespace between adjacent table cells with none in
  // the markup, so this checks for the real row/column values as
  // substrings rather than word-bounded matches.
  for (const value of ["x", "y", "1", "4", "2", "5", "3", "6"]) {
    assert.ok(bodyText.includes(value), `expected "${value}" in rendered table, got: ${bodyText}`);
  }

  const before = await (await fetch(debugUrl)).json();
  assert.equal(before, null, "no row selected yet");

  await page.getByRole("cell", { name: "5", exact: true }).click();

  await t.test("the click reaches Python within a few seconds", async () => {
    let after = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      after = await (await fetch(debugUrl)).json();
      if (after !== null) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.deepEqual(after, { x: 2, y: 5 });
  });

  assert.deepEqual(consoleErrors, [], "no console errors during the whole round trip");
});
