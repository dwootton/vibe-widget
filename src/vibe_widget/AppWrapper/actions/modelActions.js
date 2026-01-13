export function requestGrabEdit(model, { element, prompt }) {
  if (model?.__vibeCommClosed) return;
  model.set("grab_edit_request", {
    element,
    prompt,
    request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
  });
  model.save_changes();
}

export function resetRuntimeErrorsForRetry(model) {
  if (model?.__vibeCommClosed) return;
  model.set("error_message", "");
  model.set("widget_error", "");
  model.set("retry_count", 0);
  model.set("status", "retrying");
  model.save_changes();
}

export function applyAuditChanges(model, { changes, baseCode }) {
  if (model?.__vibeCommClosed) return;
  const currentState = model.get("audit_state") || {};
  model.set("audit_state", {
    ...currentState,
    apply_request: {
      changes: changes || [],
      base_code: baseCode || ""
    }
  });
  model.save_changes();
}

export function requestAudit(model, level) {
  if (model?.__vibeCommClosed) return;
  const currentState = model.get("audit_state") || {};
  model.set("audit_state", {
    ...currentState,
    request: {
      level: level || "fast",
      request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
  });
  model.save_changes();
}

export function updateCode(model, nextCode) {
  if (model?.__vibeCommClosed) return;
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
}

export function approveExecution(model) {
  if (model?.__vibeCommClosed) return;
  const currentState = model.get("execution_state") || {};
  model.set("execution_state", {
    ...currentState,
    approved: true
  });
  model.save_changes();
}

export function requestStatePrompt(model, payload) {
  if (model?.__vibeCommClosed) return;
  const base = payload || {};
  model.set("state_prompt_request", {
    ...base,
    request_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
  });
  model.save_changes();
}

export function appendWidgetLogs(model, entries) {
  if (model?.__vibeCommClosed) return;
  const nextEntries = Array.isArray(entries) ? entries : [];
  if (nextEntries.length === 0) {
    return;
  }
  const existing = model.get("widget_logs") || [];
  const next = existing.concat(nextEntries).slice(-200);
  try {
    model.set("widget_logs", next);
    model.save_changes();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "");
    if (message.toLowerCase().includes("cannot send")) {
      return;
    }
    throw err;
  }
}
