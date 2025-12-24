// import htm from "https://esm.sh/htm";

// const html = htm.bind(React.createElement);

/**
 * Reusable UI Components
 */
export const StoryCard = ({ story, html, React }) => {
  const isTopStory = story.score > 100;
  const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : null;

  return html`
    <div style=${{
      padding: '12px 16px',
      borderBottom: '1px solid #eee',
      backgroundColor: isTopStory ? '#fffdfa' : '#fff',
      borderLeft: isTopStory ? '4px solid #ff6600' : '4px solid transparent',
      transition: 'background-color 0.2s ease'
    }} className="story-card">
      <div style=${{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <a href=${story.url} target="_blank" style=${{
          color: '#000',
          textDecoration: 'none',
          fontWeight: '500',
          fontSize: '15px'
        }}>${story.title}</a>
        ${domain && html`<span style=${{ color: '#828282', fontSize: '12px' }}>(${domain})</span>`}
      </div>
      <div style=${{ color: '#828282', fontSize: '12px', display: 'flex', gap: '12px' }}>
        <span>${story.score} points by ${story.by}</span>
        <span>${new Date(story.time * 1000).toLocaleString()}</span>
        <span style=${{ cursor: 'pointer' }}>${story.descendants || 0} comments</span>
      </div>
    </div>
  `;
};

export const Header = ({ html, React, filter, setFilter, minScore, setMinScore, sortBy, setSortBy }) => {
  return html`
    <header style=${{
      backgroundColor: '#ff6600',
      padding: '8px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style=${{ border: '1px solid white', padding: '2px 6px', fontWeight: 'bold', color: 'white' }}>Y</div>
          <h1 style=${{ fontSize: '16px', margin: 0, color: '#000', fontWeight: 'bold' }}>Hacker News</h1>
        </div>
        <div style=${{ display: 'flex', gap: '10px' }}>
             <button 
                onClick=${() => setSortBy('score')}
                style=${{ 
                    background: sortBy === 'score' ? '#000' : 'transparent',
                    color: sortBy === 'score' ? '#fff' : '#000',
                    border: 'none', padding: '2px 8px', cursor: 'pointer', fontSize: '12px'
                }}>Top</button>
             <button 
                onClick=${() => setSortBy('time')}
                style=${{ 
                    background: sortBy === 'time' ? '#000' : 'transparent',
                    color: sortBy === 'time' ? '#fff' : '#000',
                    border: 'none', padding: '2px 8px', cursor: 'pointer', fontSize: '12px'
                }}>New</button>
        </div>
      </div>
      
      <div style=${{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#f6f6ef', padding: '6px 12px', borderRadius: '2px' }}>
        <input 
          type="text" 
          placeholder="Search stories..." 
          value=${filter}
          onInput=${(e) => setFilter(e.target.value)}
          style=${{ border: '1px solid #ccc', padding: '2px 6px', fontSize: '12px', flex: 1 }}
        />
        <div style=${{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span>Min Score: ${minScore}</span>
          <input 
            type="range" 
            min="0" 
            max="500" 
            value=${minScore} 
            onInput=${(e) => setMinScore(parseInt(e.target.value))}
            style=${{ accentColor: '#ff6600' }}
          />
        </div>
      </div>
    </header>
  `;
};

export default function HackerNewsWidget({ model, html, React }) {
  // Use model data or provide fallback mock data for the demo
  const rawData = model.get("data");
  const [stories, setStories] = React.useState([]);
  const [filter, setFilter] = React.useState("");
  const [minScore, setMinScore] = React.useState(0);
  const [sortBy, setSortBy] = React.useState("score");

  React.useEffect(() => {
    // In a real scenario, we'd fetch from HN API if data is empty
    // Here we'll simulate or process the model data
    if (rawData && Array.isArray(rawData) && rawData.length > 5) {
        setStories(rawData.filter(d => d.title));
    } else {
        // Fallback Mock Data for visualization if model data is empty/malformed
        setStories([
            { id: 1, title: "Show HN: A React widget for Jupyter", by: "jovyan", score: 156, time: Date.now()/1000 - 3600, descendants: 42, url: "https://github.com" },
            { id: 2, title: "Why SQLite is all you need", by: "db_fan", score: 480, time: Date.now()/1000 - 7200, descendants: 128, url: "https://sqlite.org" },
            { id: 3, title: "The future of ESM in Browser", by: "modern_web", score: 89, time: Date.now()/1000 - 500, descendants: 12, url: "https://web.dev" },
            { id: 4, title: "New Rust-based JavaScript bundler claims 10x speed", by: "ferris", score: 210, time: Date.now()/1000 - 15000, descendants: 56, url: "https://rust-lang.org" },
            { id: 5, title: "My experience building a compiler in Zig", by: "lowlevel", score: 45, time: Date.now()/1000 - 20000, descendants: 8, url: "https://ziglang.org" },
            { id: 6, title: "The lost art of writing documentation", by: "writer", score: 320, time: Date.now()/1000 - 80000, descendants: 95, url: "https://docs.com" }
        ]);
    }
  }, [rawData]);

  const filteredStories = React.useMemo(() => {
    return stories
      .filter(s => s.title?.toLowerCase().includes(filter.toLowerCase()))
      .filter(s => (s.score || 0) >= minScore)
      .sort((a, b) => {
        if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
        return (b.time || 0) - (a.time || 0);
      });
  }, [stories, filter, minScore, sortBy]);

  return html`
    <div style=${{ 
      height: '500px', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#f6f6ef',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden',
      border: '1px solid #ddd',
      borderRadius: '4px'
    }}>
      <${Header} 
        filter=${filter} 
        setFilter=${setFilter} 
        minScore=${minScore} 
        setMinScore=${setMinScore}
        sortBy=${sortBy}
        setSortBy=${setSortBy}
        html=${html}
        React=${React}
      />
      
      <div style=${{ 
        flex: 1, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        ${filteredStories.length > 0 
          ? filteredStories.map(story => html`
              <${StoryCard} 
                key=${story.id} 
                story=${story} 
                html=${html} 
                React=${React} 
              />
            `)
          : html`<div style=${{ padding: '40px', textAlign: 'center', color: '#828282' }}>No stories match your filters.</div>`
        }
      </div>
      
      <footer style=${{ 
        padding: '12px', 
        borderTop: '2px solid #ff6600', 
        fontSize: '11px', 
        textAlign: 'center',
        color: '#828282'
      }}>
        Guidelines | FAQ | Lists | API | Security | Legal | Apply to YC | Contact
      </footer>
    </div>
  `;
}