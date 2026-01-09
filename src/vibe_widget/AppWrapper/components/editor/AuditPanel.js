import React from "react";
import { tw } from "../../styles/setup.js";

const panelClass = tw("font-mono text-text-primary text-[12px] min-w-0 h-full flex flex-col min-h-0");
const headerClass = tw("text-[11px] uppercase tracking-[0.08em] flex justify-between mb-2");
const cardClass = tw(
  "border-b border-[rgba(242,240,233,0.2)] rounded-[4px] px-2 py-3 transition-shadow duration-150"
);
const dimmedClass = tw("opacity-50");
const highlightClass = tw("ring-1 ring-accent ring-inset");
const cardTitleClass = tw("text-[10px] uppercase flex items-center gap-1");
const impactDotClass = tw("w-2 h-2 rounded-full");
const actionsClass = tw("flex gap-1 my-1");
const actionButtonClass = tw(
  "w-5 h-5 border border-[rgba(242,240,233,0.3)] rounded-[2px] bg-surface-2 text-text-primary text-[10px] transition-colors duration-150 hover:bg-surface-3"
);
const metaClass = tw("mb-1");
const metaButtonClass = tw(
  "border border-[rgba(242,240,233,0.2)] rounded-[2px] px-2 py-[2px] uppercase tracking-[0.04em] text-[10px] bg-surface-2 text-text-primary"
);
const summaryClass = tw("text-[11px] leading-[1.5]");
const detailClass = tw("text-[11px] leading-[1.5]");
const listClass = tw("text-[11px] leading-[1.5]");
const alternativeClass = tw("text-accent underline text-[11px] cursor-pointer");
const emptyClass = tw(
  "border border-[rgba(242,240,233,0.2)] rounded-[2px] bg-surface-2 text-[11px] p-2 flex-1"
);
const emptyActionListClass = tw("mt-2 space-y-1 text-[11px]");
const toggleButtonClass = tw("text-accent underline text-[11px] cursor-pointer");
const emptyListItemClass = tw("flex items-center justify-between gap-2 text-[11px]");
const gridClass = tw("space-y-2 flex-1 min-h-0 overflow-auto pr-1");
const titleTextClass = tw("truncate max-w-[200px]");

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
    <div class={panelClass}>
      <div class={headerClass}>
        <span>Audit Overview</span>
        <span>{concernCountLabel}</span>
      </div>
      {!showEmpty ? (
        <div class={gridClass}>
          {visibleConcerns.map((entry, index) => {
            const resolved = entry && entry.concern ? entry : { concern: entry };
            const concern = resolved?.concern;
            if (!concern) return null;
            const cardId = resolved.cardId || concern.id || `concern-${index}`;
            if (dismissedConcerns && dismissedConcerns[cardId]) {
              return null;
            }
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
            const classes = [
              cardClass,
              isDimmed ? dimmedClass : "",
              isHighlighted ? highlightClass : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={cardId}
                class={classes}
                onClick={() => onToggleExpanded(cardId)}
                onMouseEnter={() => onHoverCard(cardId)}
                onMouseLeave={() => onHoverCard(null)}
              >
                <div class={cardTitleClass} title={`Impact: ${impact}`}>
                  <span class={impactDotClass} style={{ background: impactColor }}></span>
                  <span class={titleTextClass} title={concern.id || "concern"}>
                    {concern.id || "concern"}
                  </span>
                </div>
                <div class={actionsClass}>
                  <button
                    class={actionButtonClass}
                    title="Add to Changes"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddPendingChange(concern, cardId, { itemId: `${cardId}-base`, source: "base" });
                    }}
                  >
                    +
                  </button>
                  <button
                    class={actionButtonClass}
                    title="Dismiss"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDismissConcern(cardId, concern.id || "concern");
                    }}
                  >
                    ×
                  </button>
                </div>
                <div class={metaClass}>
                  <button
                    class={metaButtonClass}
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
                  class={summaryClass}
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
                  <div class={detailClass}>{detailText}</div>
                )}
                {isExpanded && concern.alternatives && concern.alternatives.length > 0 && (
                  <div class={listClass}>
                    Recommendations:{" "}
                    {Array.isArray(concern.alternatives)
                      ? concern.alternatives.map((alt, index) => {
                          const altText = alt.option || alt;
                          const isLast = index === concern.alternatives.length - 1;
                          return (
                            <span key={`${cardId}-alt-${index}`}>
                              <span
                                class={alternativeClass}
                                role="button"
                                tabIndex="0"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAddPendingChange(concern, cardId, {
                                    itemId: `${cardId}-alt-${index}`,
                                    label: `Recommendation: ${altText}`,
                                    source: "recommendation",
                                    alternative: altText
                                  });
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onAddPendingChange(concern, cardId, {
                                      itemId: `${cardId}-alt-${index}`,
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
        <div class={emptyClass}>
          {hasAuditPayload
            ? "All audits resolved."
            : (
              <>
                {onRunAudit && (
                  <button class={toggleButtonClass} onClick={onRunAudit}>Run an Audit</button>
                )}{" "}
                to see findings.
              </>
            )
          }
          {Object.keys(dismissedConcerns).length > 0 && (
            <div class={emptyActionListClass}>
              <button class={toggleButtonClass} onClick={onToggleDismissed}>
                {showDismissed ? "Hide dismissed" : "Show dismissed"}
              </button>
              {showDismissed && (
                <div>
                  {Object.entries(dismissedConcerns).map(([cardId, label]) => (
                    <div key={cardId} class={emptyListItemClass}>
                      <span>{label}</span>
                      <button class={toggleButtonClass} onClick={() => onRestoreDismissed(cardId)}>
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
