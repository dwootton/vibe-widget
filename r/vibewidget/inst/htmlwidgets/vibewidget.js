HTMLWidgets.widget({
  name: "vibewidget",
  type: "output",

  factory: function (el, width, height) {
    // `mounted` holds the return value of `VibeWidgetHost.mount()`:
    // { model, close() }. A widget can be re-rendered in place (e.g. Shiny
    // re-sends `x`, or the same output slot gets a new vibewidget) - the
    // previous mount is always torn down first so its WebSocket connection
    // (in live mode) does not leak.
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
        mounted = VibeWidgetHost.mount(el, x);
      },

      resize: function (width, height) {
        // The mounted app fills its container via normal CSS layout;
        // nothing further to do when the container itself is resized.
      },
    };
  },
});
