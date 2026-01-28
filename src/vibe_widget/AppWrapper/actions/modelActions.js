function withModelSync(model, handler) {
  if (!model) return;
  try {
    handler();
    model.__vibeCommClosed = false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "");
    if (message.toLowerCase().includes("cannot send")) {
      model.__vibeCommClosed = true;
      return;
    }
    throw err;
  }
}

export function requestGrabEdit(model, { element, prompt }) {
  withModelSync(model, () => {
    model.set("grab_edit_request", {
      element,
      prompt,
      request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });
    model.save_changes();
  });
}

export function resetRuntimeErrorsForRetry(model) {
  withModelSync(model, () => {
    model.set("error_message", "");
    model.set("widget_error", "");
    model.set("retry_count", 0);
    model.set("status", "retrying");
    model.save_changes();
  });
}

export function applyAuditChanges(model, { changes, baseCode }) {
  withModelSync(model, () => {
    const currentState = model.get("audit_state") || {};
    model.set("audit_state", {
      ...currentState,
      apply_request: {
        changes: changes || [],
        base_code: baseCode || ""
      }
    });
    model.save_changes();
  });
}

export function requestAudit(model, level) {
  withModelSync(model, () => {
    const currentState = model.get("audit_state") || {};
    model.set("audit_state", {
      ...currentState,
      request: {
        level: level || "fast",
        request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    });
    model.save_changes();
  });
}

export function updateCode(model, nextCode) {
  withModelSync(model, () => {
    model.set("error_message", "");
    model.set("widget_error", "");
    model.set("last_runtime_error", "");
    const currentExec = model.get("execution_state") || {};
    const mode = currentExec.mode || "auto";
    const approved = currentExec.approved !== false;
    const shouldRun = mode === "auto" || (mode === "approve" && approved);
    if (shouldRun) {
      model.set("logs", ["Validating updated code", "Testing runtime"]);
      model.set("execution_state", { ...currentExec, runtime_check: true });
    } else {
      model.set("logs", ["Code updated. Awaiting approval."]);
      model.set("execution_state", { ...currentExec, runtime_check: false });
    }
    model.set("status", "ready");
    model.set("code", nextCode);
    model.save_changes();
  });
}

export function approveExecution(model) {
  withModelSync(model, () => {
    const currentState = model.get("execution_state") || {};
    model.set("execution_state", {
      ...currentState,
      approved: true
    });
    model.save_changes();
  });
}

export function requestStatePrompt(model, payload) {
  withModelSync(model, () => {
    const base = payload || {};
    model.set("state_prompt_request", {
      ...base,
      request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });
    model.save_changes();
  });
}

export function requestSaveWidget(model, { path, includeInputs }) {
  return new Promise((resolve, reject) => {
    if (!model || typeof model.send !== "function") {
      reject(new Error("Widget comm not available."));
      return;
    }
    const requestId = `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const handler = (content) => {
      if (!content || content.type !== "save_widget_result" || content.request_id !== requestId) {
        return;
      }
      if (typeof model.off === "function") {
        model.off("msg:custom", handler);
      }
      if (content.error) {
        reject(new Error(content.error));
      } else {
        resolve(content.path || "");
      }
    };
    if (typeof model.on === "function") {
      model.on("msg:custom", handler);
    }
    try {
      model.send({
        type: "save_widget",
        request_id: requestId,
        path: path || "widget.vw",
        include_inputs: !!includeInputs
      });
    } catch (err) {
      if (typeof model.off === "function") {
        model.off("msg:custom", handler);
      }
      reject(err);
    }
  });
}

export function appendWidgetLogs(model, entries) {
  const nextEntries = Array.isArray(entries) ? entries : [];
  if (nextEntries.length === 0) {
    return;
  }
  withModelSync(model, () => {
    const existing = model.get("widget_logs") || [];
    const next = existing.concat(nextEntries).slice(-200);
    model.set("widget_logs", next);
    model.save_changes();
  });
}
