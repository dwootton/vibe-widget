import React from "https://esm.sh/react@18";

/**
 * A skeleton loader for the paper cards.
 */
export const SkeletonCard = ({ html }) => {
  const skeletonStyle = {
    flex: '0 0 320px',
    height: '240px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '16px',
    marginRight: '16px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid #e5e7eb'
  };

  const lineStyle = (width, height = '12px') => ({
    width,
    height,
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    animation: 'pulse 1.5s infinite ease-in-out'
  });

  return html`
    <div style=${skeletonStyle}>
      <div style=${lineStyle('40%', '10px')}></div>
      <div style=${lineStyle('90%', '20px')}></div>
      <div style=${lineStyle('70%', '12px')}></div>
      <div style=${{ marginTop: '12px', ...lineStyle('100%', '60px') }}></div>
    </div>
  `;
};

/**
 * Individual Paper Card Component
 */
export const PaperCard = ({ paper, html }) => {
  const cardStyle = {
    flex: '0 0 320px',
    height: '240px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '16px',
    marginRight: '16px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default',
    overflow: 'hidden'
  };

  const titleStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px 0',
    display: '-webkit-box',
    WebkitLineClamp: '2',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: '1.4'
  };

  const authorStyle = {
    fontSize: '12px',
    color: '#4b5563',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const sessionStyle = {
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#2563eb',
    marginBottom: '8px'
  };

  const abstractStyle = {
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#6b7280',
    display: '-webkit-box',
    WebkitLineClamp: '4',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  };

  // Format authors if they are objects
  const authorText = Array.isArray(paper.authors)
    ? paper.authors.map(a => typeof a === 'string' ? a : (a.name || 'Unknown')).join(', ')
    : paper.authors || 'N/A';

  return html`
    <div style=${cardStyle} className="paper-card-hover">
      <div style=${sessionStyle}>${paper.session || 'General Session'}</div>
      <h3 style=${titleStyle} title=${paper.title}>${paper.title}</h3>
      <div style=${authorStyle}>${authorText}</div>
      <p style=${abstractStyle}>${paper.abstract}</p>
    </div>
  `;
};

/**
 * Main Widget Component
 */
export default function PaperCardsWidget({ model, html, React }) {
  const [papers, setPapers] = React.useState(model.get("related_papers") || []);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handleChange = () => {
      const val = model.get("related_papers");
      setPapers(val || []);
    };
    model.on("change:related_papers", handleChange);
    return () => model.off("change:related_papers", handleChange);
  }, [model]);

  const wrapperStyle = {
    width: '100%',
    padding: '20px 0',
    overflowX: 'auto',
    display: 'flex',
    scrollbarWidth: 'thin',
    WebkitOverflowScrolling: 'touch',
    minHeight: '280px'
  };

  const listStyle = {
    display: 'flex',
    padding: '0 20px',
    alignItems: 'center'
  };

  const headerStyle = {
    padding: '0 24px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px'
  };

  const countBadgeStyle = {
    fontSize: '12px',
    backgroundColor: '#e5e7eb',
    padding: '2px 8px',
    borderRadius: '12px',
    color: '#4b5563'
  };

  return html`
    <div style=${{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f9fafb', borderRadius: '16px', padding: '16px 0' }}>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .paper-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
          border-color: #3b82f6 !important;
        }
        ::-webkit-scrollbar {
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      </style>

      <div style=${headerStyle}>
        <span>Related Papers</span>
        ${papers.length > 0 && html`<span style=${countBadgeStyle}>${papers.length}</span>`}
      </div>

      <div style=${wrapperStyle} ref=${containerRef}>
        <div style=${listStyle}>
          ${papers.length === 0
      ? [1, 2, 3, 4, 5].map(() => html`<${SkeletonCard} html=${html} />`)
      : papers.map((paper, i) => html`<${PaperCard} key=${paper.index || i} paper=${paper} html=${html} />`)
    }
        </div>
      </div>
    </div>
  `;
}