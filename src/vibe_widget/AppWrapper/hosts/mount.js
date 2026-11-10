// Entry point for the standalone (non-Jupyter) host bundle. Picks a
// transport port by `options.mode`, builds a host model over it, and hands
// that model to the *unchanged* `render({ model, el })` entry point the
// AnyWidget bundle also uses - so everything above the model boundary
// (AppWrapper, its hooks, the generated-widget mount) is identical between
// the Jupyter and host builds.
import AppWrapper from "../AppWrapper.js";
import { createHostModel } from "./hostModel.js";
import { createStaticPort } from "./staticPort.js";
import { createWsPort } from "./wsPort.js";

export function mount(el, options) {
  if (!el) throw new Error("VibeWidgetHost.mount requires a container element");
  const mode = options && options.mode;

  let port;
  if (mode === "live") {
    const { wsUrl, sessionId, token } = options;
    if (!wsUrl || !sessionId) {
      throw new Error("VibeWidgetHost.mount({mode:'live'}) requires wsUrl and sessionId");
    }
    port = createWsPort({ url: `${wsUrl}/ws/${sessionId}`, sessionId, token });
  } else if (mode === "static") {
    port = createStaticPort({ snapshot: options.snapshot || {} });
  } else {
    throw new Error(`VibeWidgetHost.mount: unknown mode ${JSON.stringify(mode)} (expected "live" or "static")`);
  }

  const model = createHostModel(port);
  AppWrapper.render({ model, el });

  return {
    model,
    close() {
      port.close();
    },
  };
}
