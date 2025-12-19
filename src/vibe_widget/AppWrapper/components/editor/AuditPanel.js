import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export default function AuditPanel({
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
  onScrollToLines
}) {
  return html`
    <div class="audit-panel">
      <div class="audit-panel-header">
        <span>Audit Overview</span>
        <span>${visibleConcerns.length} concerns</span>
      </div>
      ${visibleConcerns.length > 0 ? html`
        <div class="audit-grid">
          ${visibleConcerns.map(({ concern, cardId, index }) => {
            const isExpanded = !!expandedCards[cardId];
            const showTechnical = !!technicalCards[cardId];
            const impact = (concern.impact || "low").toLowerCase();
            const impactColor = impact === "high"
              ? "#f87171"
              : impact === "medium"
                ? "#f59e0b"
                : "#34d399";
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
            return html`
              <div
                class="audit-card ${isDimmed ? "dimmed" : ""} ${isHighlighted ? "highlight" : ""}"
                onClick=${() => onToggleExpanded(cardId)}
              >
                <div class="audit-card-title" title=${`Impact: ${impact}`}>
                  <span class="impact-dot" style=${{ background: impactColor }}></span>
                  <span>${concern.id || "concern"}</span>
                </div>
                <div class="audit-card-actions">
                  <button
                    class="audit-add-button"
                    title="Add to Changes"
                    onClick=${(event) => {
                      event.stopPropagation();
                      onAddPendingChange(concern, cardId, { itemId: `${cardId}-base` });
                    }}
                  >
                    +
                  </button>
                  <button
                    class="audit-dismiss-button"
                    title="Dismiss"
                    onClick=${(event) => {
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
                    onClick=${(event) => {
                      event.stopPropagation();
                      if (location.length > 0) {
                        onScrollToLines(location);
                      }
                    }}
                  >
                    ${lineLabel}
                  </button>
                </div>
                <div
                  class="audit-card-summary"
                  onClick=${(event) => {
                    if (!canToggleTechnical) return;
                    event.stopPropagation();
                    onToggleTechnical(cardId);
                  }}
                  title=${canToggleTechnical ? "Click to toggle technical note" : ""}
                >
                  ${descriptionText}
                </div>
                ${isExpanded && detailText && html`
                  <div class="audit-card-detail">${detailText}</div>
                `}
                ${isExpanded && concern.alternatives && concern.alternatives.length > 0 && html`
                  <div class="audit-card-list">
                    Recommendations: ${Array.isArray(concern.alternatives) ? concern.alternatives.map((alt, altIndex) => {
                      const altText = alt.option || alt;
                      const isLast = altIndex === concern.alternatives.length - 1;
                      return html`
                        <span>
                          <span
                            class="audit-alternative"
                            role="button"
                            tabindex="0"
                            onClick=${(event) => {
                              event.stopPropagation();
                              onAddPendingChange(concern, cardId, {
                                itemId: `${cardId}-alt-${altIndex}`,
                                label: `Recommendation: ${altText}`,
                                alternative: altText
                              });
                            }}
                            onKeyDown=${(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onAddPendingChange(concern, cardId, {
                                  itemId: `${cardId}-alt-${altIndex}`,
                                  label: `Recommendation: ${altText}`,
                                  alternative: altText
                                });
                              }
                            }}
                          >
                            ${altText}
                          </span>${!isLast ? ", " : ""}
                        </span>
                      `;
                    }) : ""}
                  </div>
                `}
              </div>
            `;
          })}
        </div>
      ` : html`
        <div class="audit-empty">
          All audits resolved.
          ${Object.keys(dismissedConcerns).length > 0 && html`
            <div>
              <button onClick=${onToggleDismissed}>
                ${showDismissed ? "Hide dismissed" : "Show dismissed"}
              </button>
            </div>
            ${showDismissed && html`
              <div class="audit-dismissed-list">
                ${Object.entries(dismissedConcerns).map(([cardId, label]) => html`
                  <div class="audit-dismissed-item">
                    <span>${label}</span>
                    <button onClick=${() => onRestoreDismissed(cardId)}>
                      Restore
                    </button>
                  </div>
                `)}
              </div>
            `}
          `}
        </div>
      `}
    </div>
  `;
}
