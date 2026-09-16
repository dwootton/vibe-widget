import { setup, tw, css, observe } from "@twind/core";
import config from "./twind.config.js";

const twind = setup(config);

if (typeof document !== "undefined" && typeof window !== "undefined" && typeof observe === "function") {
  observe(twind);
}

if (typeof globalThis !== "undefined") {
  globalThis.__VIBE_TW = tw;
  globalThis.__VIBE_CSS = css;
}

export { tw, css };
