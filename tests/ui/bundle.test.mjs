import test from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./domEnv.mjs";

installDom();

test("the built AppWrapper bundle imports and exports render()", async () => {
  const bundle = await import("../../src/vibe_widget/AppWrapper.bundle.js");
  assert.equal(typeof bundle.default.render, "function");
  assert.equal(typeof globalThis.ReactProvided, "object");
  assert.equal(typeof globalThis.__VIBE_TW, "function");
});

test("surface classes resolve to --jp-* variables with the dark fallback", async () => {
  const { twind, virtual } = await import("@twind/core");
  const config = (await import("../../src/vibe_widget/AppWrapper/styles/twind.config.js")).default;
  const tw = twind(config, virtual());

  tw("bg-surface-2 text-text-primary border-border-medium");
  const css = tw.target.join("\n");

  assert.match(css, /var\(--jp-layout-color1, ?#0f0f0f\)/);
  assert.match(css, /var\(--jp-ui-font-color0, ?#f2f0e9\)/);
  assert.match(css, /var\(--jp-border-color2, ?rgba\(242, ?240, ?233, ?0\.2\)\)/);
});
