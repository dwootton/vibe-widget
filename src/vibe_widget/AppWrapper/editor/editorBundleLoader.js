let editorBundlePromise = null;
let editorModulePromise = null;
let editorModuleUrl = null;

function requestEditorBundle(model) {
  if (editorBundlePromise) {
    return editorBundlePromise;
  }
  editorBundlePromise = new Promise((resolve, reject) => {
    const handleMessage = (content) => {
      if (!content || content.type !== "editor_bundle") {
        if (content && content.type === "editor_bundle_error") {
          model.off("msg:custom", handleMessage);
          clearTimeout(timeout);
          reject(new Error(content.error || "Editor bundle load failed."));
        }
        return;
      }
      model.off("msg:custom", handleMessage);
      clearTimeout(timeout);
      resolve(content.code || "");
    };

    const timeout = setTimeout(() => {
      model.off("msg:custom", handleMessage);
      reject(new Error("Timed out waiting for editor bundle."));
    }, 15000);

    model.on("msg:custom", handleMessage);
    model.send({ type: "request_editor_bundle" });
  });

  return editorBundlePromise;
}

export function loadEditorModule(model) {
  if (editorModulePromise) {
    return editorModulePromise;
  }
  editorModulePromise = requestEditorBundle(model).then((code) => {
    if (!code) {
      throw new Error("Editor bundle is empty.");
    }
    if (!editorModuleUrl) {
      editorModuleUrl = URL.createObjectURL(
        new Blob([code], { type: "text/javascript" })
      );
    }
    return import(editorModuleUrl);
  });
  return editorModulePromise;
}
