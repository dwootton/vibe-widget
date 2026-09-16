// Bundle entry for the standalone host build (see `package.json`'s
// `build-app-wrapper:host` script, `--format=iife --global-name=VibeWidgetHost`).
// Loaded directly via a <script> tag (no module system required), so it
// exposes exactly one thing: `VibeWidgetHost.mount(el, options)`.
import { mount } from "./mount.js";

export { mount };
