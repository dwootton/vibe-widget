export function requestGrabEdit(model, { element, prompt }) {
  model.set("grab_edit_request", {
    element,
    prompt
  });
  model.save_changes();
}

export function resetRuntimeErrorsForRetry(model) {
  model.set("error_message", "");
  model.set("widget_error", "");
  model.set("retry_count", 0);
  model.set("status", "retrying");
  model.save_changes();
}

export function applyAuditChanges(model, { changes, baseCode }) {
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
  model.set("error_message", "");
  model.set("code", nextCode);
  model.save_changes();
}

export function approveExecution(model) {
  const currentState = model.get("execution_state") || {};
  model.set("execution_state", {
    ...currentState,
    approved: true
  });
  model.save_changes();
}

export function requestStatePrompt(model, payload) {
  model.set("state_prompt_request", payload || {});
  model.save_changes();
}

export function appendWidgetLogs(model, entries) {
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
