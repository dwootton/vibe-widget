import React from "react";

export default function AuditPanel({
  hasAuditPayload,
  visibleConcerns,
  dismissedConcerns,
  showDismissed,
  onToggleDismissed,
  onRestoreDismissed,
  expandedCards,
  technicalCards,
  hoveredCardId,
  onHoverCard,
  onToggleExpanded,
  onToggleTechnical,
  onAddPendingChange,
  onDismissConcern,
  onScrollToLines,
  onRunAudit
}) {
  const showEmpty = visibleConcerns.length === 0;
  const concernCountLabel = hasAuditPayload ? `${visibleConcerns.length} concerns` : "No audit yet";
  return (
    <div class="audit-panel">
      <style>{`
        .audit-panel {
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #f2f0e9;
        }
        .audit-panel a { color: #f97316; }
        .audit-panel a:hover { color: #fb923c; }
        .audit-panel-header {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .audit-card {
          border-bottom: 1px solid rgba(242, 240, 233, 0.2);
          padding: 10px 0;
        }
        .audit-card-title {
          font-size: 10px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .impact-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
        }
        .audit-card-actions {
          display: flex;
          gap: 6px;
          margin: 6px 0;
        }
        .audit-card-actions button {
          border-radius: 2px;
          background: #0f0f0f;
          color: #f2f0e9;
          border: 1px solid rgba(242, 240, 233, 0.3);
          font-size: 10px;
          width: 20px;
          height: 20px;
        }
        .audit-card-actions button:hover { background: #1a1a1a; }
        .audit-line-link {
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 2px;
          padding: 2px 6px;
          background: #0f0f0f;
          color: #f2f0e9;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 10px;
        }
        .audit-card-summary,
        .audit-card-detail {
          font-size: 11px;
          line-height: 1.5;
        }
        .audit-run-link {
          background: none;
          border: none;
          color: #f97316;
          text-decoration: underline;
          cursor: pointer;
          font-size: 11px;
          padding: 0 0 0 6px;
        }
        .audit-empty {
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 2px;
          background: #0f0f0f;
          font-size: 11px;
          padding: 10px;
        }
      `}</style>
      <div class="audit-panel-header">
        <span>Audit Overview</span>
        <span>{concernCountLabel}</span>
      </div>
      {!showEmpty ? (
        <div class="audit-grid">
          {visibleConcerns.map(({ concern, cardId, index }) => {
            const isExpanded = !!expandedCards[cardId];
            const showTechnical = !!technicalCards[cardId];
            const impact = (concern.impact || "low").toLowerCase();
            const impactColor = impact === "high" ? "#f87171" : impact === "medium" ? "#f59e0b" : "#34d399";
            const location = Array.isArray(concern.location) ? concern.location : [];
            const lineLabel = location.length > 0
              ? `LINES ${Math.min(...location)}-${Math.max(...location)}`
              : "GLOBAL";
            const plainSummary = concern.summary || "";
            const technicalSummary = concern.technical_summary || "";
            const detailText = concern.details || "";
            const canToggleTechnical = technicalSummary && technicalSummary !== plainSummary;
            const descriptionText = showTechnical && canToggleTechnical ? technicalSummary : plainSummary;
            const isDimmed = hoveredCardId && hoveredCardId !== cardId;
            const isHighlighted = hoveredCardId === cardId;
            return (
              <div
                class={`audit-card ${isDimmed ? "dimmed" : ""} ${isHighlighted ? "highlight" : ""}`}
                onClick={() => onToggleExpanded(cardId)}
              >
                <div class="audit-card-title" title={`Impact: ${impact}`}>
                  <span class="impact-dot" style={{ background: impactColor }}></span>
                  <span>{concern.id || "concern"}</span>
                </div>
                <div class="audit-card-actions">
                  <button
                    class="audit-add-button"
                    title="Add to Changes"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddPendingChange(concern, cardId, { itemId: `${cardId}-base`, source: "base" });
                    }}
                  >
                    +
                  </button>
                  <button
                    class="audit-dismiss-button"
                    title="Dismiss"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDismissConcern(cardId, concern.id || "concern");
                    }}
                  >
                    ×
                  </button>
                </div>
                <div class="audit-card-meta">
                  <button
                    class="audit-line-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (location.length > 0) {
                        onScrollToLines(location);
                      }
                    }}
                  >
                    {lineLabel}
                  </button>
                </div>
                <div
                  class="audit-card-summary"
                  onClick={(event) => {
                    if (!canToggleTechnical) return;
                    event.stopPropagation();
                    onToggleTechnical(cardId);
                  }}
                  title={canToggleTechnical ? "Click to toggle technical note" : ""}
                >
                  {descriptionText}
                </div>
                {isExpanded && detailText && (
                  <div class="audit-card-detail">{detailText}</div>
                )}
                {isExpanded && concern.alternatives && concern.alternatives.length > 0 && (
                  <div class="audit-card-list">
                    Recommendations:{" "}
                    {Array.isArray(concern.alternatives)
                      ? concern.alternatives.map((alt, altIndex) => {
                          const altText = alt.option || alt;
                          const isLast = altIndex === concern.alternatives.length - 1;
                          return (
                            <span>
                              <span
                                class="audit-alternative"
                                role="button"
                                tabIndex="0"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAddPendingChange(concern, cardId, {
                                    itemId: `${cardId}-alt-${altIndex}`,
                                    label: `Recommendation: ${altText}`,
                                    source: "recommendation",
                                    alternative: altText
                                  });
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onAddPendingChange(concern, cardId, {
                                      itemId: `${cardId}-alt-${altIndex}`,
                                      label: `Recommendation: ${altText}`,
                                      source: "recommendation",
                                      alternative: altText
                                    });
                                  }
                                }}
                              >
                                {altText}
                              </span>
                              {!isLast ? ", " : ""}
                            </span>
                          );
                        })
                      : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div class="audit-empty">
          {hasAuditPayload
            ? "All audits resolved."
            : (
              <>Run an audit to see findings. {onRunAudit && <button class="audit-run-link" onClick={onRunAudit}>Run an audit</button>}</>
            )
          }
          {Object.keys(dismissedConcerns).length > 0 && (
            <div>
              <button onClick={onToggleDismissed}>
                {showDismissed ? "Hide dismissed" : "Show dismissed"}
              </button>
              {showDismissed && (
                <div class="audit-dismissed-list">
                  {Object.entries(dismissedConcerns).map(([cardId, label]) => (
                    <div class="audit-dismissed-item">
                      <span>{label}</span>
                      <button onClick={() => onRestoreDismissed(cardId)}>
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
