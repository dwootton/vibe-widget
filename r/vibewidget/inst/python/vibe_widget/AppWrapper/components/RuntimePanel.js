import React from "react";
import { tw } from "../styles/setup.js";

function buildStatusLabel(status) {
  if (status === "retrying") return "Repairing widget";
  if (status === "blocked") return "Repair blocked";
  if (status === "error") return "Repair failed";
  if (status === "generating") return "Generating widget";
  return "Preparing widget";
}

const panelClass = tw(
  "border border-border-medium rounded-[6px] px-[10px] py-2 bg-[rgba(10,10,10,0.85)] text-text-secondary font-mono text-[12px]"
);
const headingClass = tw("text-[12px] uppercase tracking-[0.06em] text-accent mb-1");
const listClass = tw("mt-1 ml-4 list-none text-[12px] text-[#cbd5e1] space-y-1");

export default function RuntimePanel({ status, errorMessage, widgetError, recentLogs }) {
  const activeError = errorMessage || widgetError;
  const label = buildStatusLabel(status);

  return (
    <div class={panelClass}>
      <h4 class={headingClass}>{label}</h4>
      {(status === "error" || status === "blocked") && (
        <div>Repair attempt failed. Check the logs.</div>
      )}
      {activeError && (
        <div>
          <div>Last error:</div>
          <div class="text-error-light" style={{ whiteSpace: "pre-wrap" }}>{activeError}</div>
        </div>
      )}
      {recentLogs.length ? (
        <ul class={listClass}>
          {recentLogs.map((entry, idx) => (
            <li key={idx}>{entry.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
