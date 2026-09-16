// Live-mode widget binding. Deliberately separate from `vibewidget.js`
// (the static-mode binding) so this one carries NO package htmlDependency
// for the ~3.8MB host bundle - see vibewidget_live.yaml for why that
// matters specifically for Positron. Instead, the bundle is fetched once
// per page from the local Python server's own /assets endpoint, keyed off
// `x.wsUrl` (which already encodes host:port), and cached on `window` so
// multiple live widgets on the same page (or the same widget re-rendered)
// share one load.
(function () {
  function loadHostBundleOnce(wsUrl) {
    if (window.VibeWidgetHost) {
      return Promise.resolve(window.VibeWidgetHost);
    }
    if (!window.__vibewidgetHostLoading) {
      const httpOrigin = wsUrl.replace(/^ws/, "http");
      window.__vibewidgetHostLoading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `${httpOrigin}/assets/vibewidget-host.js`;
        script.onload = () => resolve(window.VibeWidgetHost);
        script.onerror = () =>
          reject(new Error(`[vibewidget] failed to load host bundle from ${script.src}`));
        document.head.appendChild(script);
      });
    }
    return window.__vibewidgetHostLoading;
  }

  HTMLWidgets.widget({
    name: "vibewidget_live",
    type: "output",

    factory: function (el, width, height) {
      let mounted = null;

      return {
        renderValue: function (x) {
          if (mounted) {
            try {
              mounted.close();
            } catch (err) {
              console.error("[vibewidget] error closing previous mount", err);
            }
            mounted = null;
          }
          loadHostBundleOnce(x.wsUrl)
            .then((VibeWidgetHost) => {
              mounted = VibeWidgetHost.mount(el, x);
            })
            .catch((err) => {
              console.error(err);
              el.textContent = String(err.message || err);
            });
        },

        resize: function () {},
      };
    },
  });
})();
