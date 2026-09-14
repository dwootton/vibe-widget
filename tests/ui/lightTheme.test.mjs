import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// These components paint themselves onto a pinned dark surface (their own
// bg-[#...] or the editor shell's). The text-*/surface-* tokens follow --jp-*
// and invert in a light host (Quarto, JupyterLab light, VS Code light), which
// leaves black text on a near-black panel. Inside a pinned surface the
// foreground has to be pinned too.
const PINNED_DARK = [
  "src/vibe_widget/AppWrapper/components/AuditNotice.js",
  "src/vibe_widget/AppWrapper/components/ProgressMap.js",
  "src/vibe_widget/AppWrapper/components/editor/CodeEditor.js",
  "src/vibe_widget/AppWrapper/components/editor/EditorHeader.js",
  "src/vibe_widget/AppWrapper/components/editor/AuditPanel.js"
];

// bg-accent is a pinned orange in every theme, so its foreground is pinned too
// wherever it appears.
const ACCENT_SURFACES = ["src/vibe_widget/AppWrapper/components/SaveDialog.js"];

const THEME_TOKEN = /\b(?:text|bg)-(?:text-(?:primary|secondary|muted|disabled)|surface-[1-4])\b/;

async function offendingLines(path, predicate) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return source
    .split("\n")
    .map((line, i) => [i + 1, line.trim()])
    .filter(([, line]) => !line.startsWith("//") && predicate(line))
    .map(([n, line]) => `${n}: ${line.slice(0, 90)}`);
}

for (const path of PINNED_DARK) {
  test(`${path} pins its foreground on its pinned dark surface`, async () => {
    const bad = await offendingLines(path, (line) => THEME_TOKEN.test(line));
    assert.deepEqual(bad, [], `theme-following token on a pinned dark surface:\n${bad.join("\n")}`);
  });
}

for (const path of ACCENT_SURFACES) {
  test(`${path} pins the foreground it puts on bg-accent`, async () => {
    const bad = await offendingLines(
      path,
      (line) => /bg-accent/.test(line) && THEME_TOKEN.test(line)
    );
    assert.deepEqual(bad, [], `theme-following token on bg-accent:\n${bad.join("\n")}`);
  });
}
