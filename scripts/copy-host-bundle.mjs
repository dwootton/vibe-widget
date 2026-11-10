// Copy the standalone host bundle into the R package's htmlwidgets lib.
// A node script instead of `mkdir -p && cp` so `npm run build-app-wrapper:host`
// also works where npm runs scripts through Windows cmd.exe.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src/vibe_widget/hosts/static/vibewidget-host.js");
const target = join(root, "r/vibewidget/inst/htmlwidgets/lib/vibewidget-host/vibewidget-host.js");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied host bundle -> ${target}`);
