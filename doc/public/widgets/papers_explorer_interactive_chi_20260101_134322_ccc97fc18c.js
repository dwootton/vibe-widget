import * as d3 from "https://esm.sh/d3@7";

export const SearchBar = ({ model, html, React }) => {
  const [query, setQuery] = React.useState("");

  const handleSubmit = () => {
    const currentCount = model.get("submit_count") || 0;
    model.set("query_text", query);
    model.set("submit_count", currentCount + 1);
    model.save_changes();
  };

  return html`
    <div style=${{ 
      display: 'flex', 
      gap: '8px', 
      marginBottom: '16px', 
      padding: '12px', 
      background: '#f8f9fa', 
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <input 
        type="text" 
        placeholder="Search papers..." 
        value=${query}
        onInput=${(e) => setQuery(e.target.value)}
        onKeyDown=${(e) => e.key === 'Enter' && handleSubmit()}
        style=${{ 
          flex: 1, 
          padding: '8px 12px', 
          borderRadius: '4px', 
          border: '1px solid #ddd',
          fontSize: '14px'
        }}
      />
      <button 
        onClick=${handleSubmit}
        style=${{ 
          padding: '8px 20px', 
          background: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        Submit
      </button>
    </div>
  `;
};

export const PaperPlot = ({ model, html, React }) => {
  const containerRef = React.useRef(null);
  const tooltipRef = React.useRef(null);
  const data = model.get("data") || [];

  React.useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const width = containerRef.current.clientWidth;
    const height = 500;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "#fff")
      .style("border-radius", "8px");

    const g = svg.append("g");

    const xExtent = d3.extent(data, d => d.x);
    const yExtent = d3.extent(data, d => d.y);

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    const zoom = d3.zoom()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    const nodes = g.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", 4)
      .attr("fill", "#bdc3c7")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer");

    const tooltip = d3.select(tooltipRef.current);
    nodes.on("mouseenter", (event, d) => {
      d3.select(event.currentTarget)
        .transition().duration(200)
        .attr("r", 8)
        .attr("stroke-width", 2);
      
      tooltip.style("opacity", 1)
        .html(`
          <div style="font-weight: bold; margin-bottom: 4px;">${d.title}</div>
          <div style="font-size: 11px; color: #666;">${String(d.authors).slice(0, 100)}...</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget)
        .transition().duration(200)
        .attr("r", 4)
        .attr("stroke-width", 0.5);
      tooltip.style("opacity", 0);
    });

    const handleSimilarityUpdate = () => {
      const scores = model.get("similarity_scores");
      if (!Array.isArray(scores) || scores.length === 0) return;

      const indexedScores = scores.map((s, i) => ({ s, i }));
      indexedScores.sort((a, b) => b.s - a.s);
      
      const top5 = indexedScores.slice(0, 5).map(item => ({
        index: item.i,
        ...data[item.i]
      }));
      model.set("related_papers", top5);
      model.save_changes();

      const bestIdx = indexedScores[0].i;
      const originX = xScale(data[bestIdx].x);
      const originY = yScale(data[bestIdx].y);

      nodes.transition().duration(300).attr("fill", "#ecf0f1");

      const getColor = (s, max) => {
        const ratio = s / (max || 1);
        if (ratio > 0.9) return "#4FC3F7";
        if (ratio > 0.7) return "#64B5F6";
        if (ratio > 0.4) return "#90CAF9";
        return "#E3F2FD";
      };

      nodes.each(function(d, i) {
        const dx = xScale(d.x) - originX;
        const dy = yScale(d.y) - originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delay = dist * 5;

        d3.select(this)
          .transition()
          .delay(delay)
          .duration(800)
          .ease(d3.easeBackOut)
          .attr("fill", i === bestIdx ? "#FF9800" : getColor(scores[i], indexedScores[0].s))
          .attr("r", i === bestIdx ? 10 : 5)
          .transition()
          .duration(400)
          .attr("r", i === bestIdx ? 8 : 4);
      });
    };

    model.on("change:similarity_scores", handleSimilarityUpdate);

    return () => {
      model.off("change:similarity_scores", handleSimilarityUpdate);
      svg.remove();
    };
  }, [data]);

  return html`
    <div style=${{ position: 'relative', width: '100%' }}>
      <div ref=${containerRef} style=${{ width: '100%', height: '500px', border: '1px solid #eee', borderRadius: '8px' }}></div>
      <div ref=${tooltipRef} style=${{
        position: 'fixed',
        pointerEvents: 'none',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 12px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: '12px',
        maxWidth: '240px',
        zIndex: 1000,
        opacity: 0,
        transition: 'opacity 0.2s'
      }}></div>
    </div>
  `;
};

export default function Widget({ model, html, React }) {
  React.useEffect(() => {
    if (model.get("submit_count") === undefined) {
      model.set({
        "query_text": "",
        "submit_count": 0,
        "related_papers": []
      });
      model.save_changes();
    }
  }, []);

  return html`
    <div style=${{ 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      padding: '20px', 
      maxWidth: '1000px', 
      margin: '0 auto',
      color: '#2c3e50'
    }}>
      <header style=${{ marginBottom: '24px' }}>
        <h1 style=${{ fontSize: '24px', margin: '0 0 8px 0' }}>CHI 2025 Paper Explorer</h1>
        <p style=${{ fontSize: '14px', color: '#666', margin: 0 }}>Discover research through semantic similarity</p>
      </header>

      <${SearchBar} model=${model} html=${html} React=${React} />
      <${PaperPlot} model=${model} html=${html} React=${React} />
      
      <div style=${{ marginTop: '20px', fontSize: '12px', color: '#95a5a6', textAlign: 'center' }}>
        Interactive Embedding Visualization • Radiating Wave Similarity Search
      </div>
    </div>
  `;
}