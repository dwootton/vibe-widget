import React from "react";
import { css, tw } from "../styles/setup.js";

const bezelClass = tw(
  "w-full h-full min-h-0 box-border text-text-secondary bg-[#050505] border border-border-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] flex flex-col gap-2 px-[10px] py-[12px]"
);
const headingClass = tw(
  "flex items-center gap-2 text-xs font-mono uppercase tracking-[0.05em] text-text-primary pl-[9px]"
);
const statusDotBaseClass = tw(
  "w-2 h-2 rounded-none shadow-[0_0_0_4px_rgba(249,115,22,0.12)] flex-shrink-0"
);
const logContainerBaseClass = tw("flex-1 min-h-0 overflow-auto bg-transparent border-0 shadow-none pt-[6px]");
const logListClass = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  fontFamily:
    "JetBrains Mono, Space Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  fontSize: "12px",
  textTransform: "uppercase",
  "&::-webkit-scrollbar": {
    width: "4px",
    height: "4px"
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(243, 119, 38, 0.3)",
    borderRadius: "2px"
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: "rgba(243, 119, 38, 0.5)"
  }
});
const logEntryClass = css({
  display: "flex",
  alignItems: "baseline",
  gap: "4px",
  padding: "2px 0",
  color: "#94a3b8",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  textTransform: "uppercase"
});
const logIconClass = tw("flex-none w-[10px] ml-2 flex items-center justify-center text-text-muted");
const logIconBlockClass = tw("w-[6px] h-[6px] rounded-none bg-[rgba(148,163,184,0.6)]");
const logTextBaseClass = tw("flex-1 flex items-center gap-1 text-[12px] uppercase font-mono leading-snug text-text-muted");
const ellipsisClass = tw("inline-block min-w-[1.6em] text-left");
const footerClass = tw("pt-2");

export default function ProgressMap({
  logs = [],
  status = "ready",
  fullHeight = false,
  heading = null,
  footer = null,
  debugLabel = "ProgressMap"
}) {
  const isActive = status !== "ready" && status !== "error";
  const isDone = status === "ready";
  const [spinnerIndex, setSpinnerIndex] = React.useState(0);
  const spinnerFrames = ["|", "/", "-", "\\"];
  const logContainerRef = React.useRef(null);
  const hasInitialScroll = React.useRef(false);
  const autoFollowRef = React.useRef(true);
  const debugSink =
    typeof globalThis !== "undefined" ? globalThis.__VIBE_DEBUG_SINK : null;
  const debugEnabled = true;

  React.useEffect(() => {
    if (typeof debugSink === "function") {
      debugSink({
        source: "ProgressMap",
        event: "mount",
        label: debugLabel,
        status,
        logs: logs.length
      });
    }
    console.log("[vibe][debug] ProgressMap mount", {
      label: debugLabel,
      status,
      logs: logs.length
    });
    return () => {
      if (typeof debugSink === "function") {
        debugSink({ source: "ProgressMap", event: "unmount", label: debugLabel });
      }
      console.log("[vibe][debug] ProgressMap unmount", { label: debugLabel });
    };
  }, [debugEnabled, debugSink, debugLabel, status, logs.length]);

  React.useLayoutEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    if (!hasInitialScroll.current) {
      autoFollowRef.current = true;
    }
    const frame = window.requestAnimationFrame(() => {
      if (autoFollowRef.current) {
        el.scrollTop = el.scrollHeight;
      }
      hasInitialScroll.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [logs, isActive]);

  React.useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      autoFollowRef.current = distanceFromBottom < 12;
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 140);
    return () => clearInterval(timer);
  }, [isActive, spinnerFrames.length]);

  const hasLogs = logs.length > 0;
  const logContainerClass = [logContainerBaseClass, !fullHeight ? "max-h-[240px]" : ""]
    .filter(Boolean)
    .join(" ");
  const rootClass = [bezelClass, !hasLogs ? "justify-end gap-0" : ""].join(" ");

  return (
    <div class={rootClass}>
      {heading && (
        <div class={headingClass}>
          <span class={`${statusDotBaseClass} ${isDone ? "bg-success" : "bg-accent"}`} aria-hidden="true"></span>
          <span>{heading}</span>
        </div>
      )}
      {hasLogs && (
        <div class={logContainerClass} ref={logContainerRef}>
          <ul class={logListClass}>
            {logs.map((entry, idx) => {
              const text = typeof entry === "string" ? entry : String(entry);
              const lower = text.toLowerCase();
              const isTerminal = lower.includes("runtime error");
              const isLive = idx === logs.length - 1 && isActive;
              const hasTrailingDots = isLive && text.endsWith("...");
              const baseText = hasTrailingDots ? text.slice(0, -3) : text;
              const ellipsisFrames = [".", "..", "..."];
              const logTextColor = isTerminal
                ? "#cbd5e1"
                : isLive
                  ? "#f97316"
                  : "#94a3b8";
              const logIconClasses = [
                logIconClass,
                isLive ? "text-accent" : ""
              ].join(" ");
              const logIconStyle = isLive ? { color: "#f97316" } : undefined;
              return (
                <li
                  key={idx}
                  class={logEntryClass}
                  style={{ "--entry-index": idx }}
                >
                  <span class={logIconClasses} style={logIconStyle}>
                    {isLive ? (
                      spinnerFrames[spinnerIndex]
                    ) : (
                      <span class={logIconBlockClass} />
                    )}
                  </span>
                  <span class={logTextBaseClass} style={{ color: logTextColor }}>
                    {baseText}
                    {hasTrailingDots && (
                      <span class={ellipsisClass}>{ellipsisFrames[spinnerIndex % ellipsisFrames.length]}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {footer && <div class={footerClass}>{footer}</div>}
    </div>
  );
}
