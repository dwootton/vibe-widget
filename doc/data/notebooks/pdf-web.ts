import type { NotebookCell, NotebookSpec } from "./types";

const cells: NotebookCell[] = [
  {
    type: "markdown",
    content: `
      <h2>PDF & Web Data Extraction</h2>
      <p class="text-lg text-slate/70">
        Vibe Widget can extract data from PDFs and web pages, then create interactive visualizations.
        This demo shows two examples: a 3D solar system from PDF data and a Hacker News clone from web scraping.
      </p>
    `,
  },
  {
    type: "code",
    content: `import vibe_widget as vw
import pandas as pd

vw.models()`,
    defaultCollapsed: true,
    label: "Setup",
  },
  {
    type: "code",
    content: `# Configure (demo mode - no actual LLM calls)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: "Config",
  },
  {
    type: "markdown",
    content: `
      <h3>Example 1: 3D Solar System from PDF</h3>
      <p>
        Extract planet data from a PDF and visualize it as an interactive 3D solar system.
        Click on planets to select them!
      </p>
    `,
  },
  {
    type: "code",
    content: `# Create 3D Solar System widget
solar_system = vw.create(
    """3D solar system using Three.js showing planets orbiting the sun.
    - Create spheres for each planet with relative sizes
    - Position planets at their relative distances from sun
    - Make planets clickable to select them
    - Highlight selected planet with a bright glow
    - Add orbit controls for rotation
    - Default selection: Earth
    - Output the selected planet name
    """,
    data="../testdata/ellipseplanet.pdf",
    outputs=vw.outputs(
        selected_planet="name of the currently selected planet"
    ),
)

solar_system`,
    label: "3D Solar System",
  },
  {
    type: "markdown",
    content: `
      <h3>Example 2: Hacker News Clone from Web Scraping</h3>
      <p>
        Scrape Hacker News stories and display them in an interactive interface.
        Filter by score, search by keywords, and sort by different criteria!
      </p>
    `,
  },
  {
    type: "code",
    content: `# Create interactive Hacker News widget
hn_clone = vw.create(
    """Create an interactive Hacker News clone widget with:
    - Display stories in a clean, modern layout
    - Show story title (clickable link), author, score, comments count
    - Sort stories by score (highest first) or time (newest first)
    - Filter stories by minimum score threshold using a slider
    - Highlight top stories (score > 100) with an orange accent
    - Add a search box to filter stories by title keywords
    - Use modern, minimalist design with orange (#ff6600) accents
    """,
    data="https://news.ycombinator.com",
)

hn_clone`,
    label: "Hacker News Clone",
  },
  {
    type: "markdown",
    content: `
      <h3>How It Works</h3>
      <pre class="bg-material-dark/5 p-4 rounded-lg overflow-x-auto"><code class="text-sm"># PDF Extraction
solar_system = vw.create(
    description="3D visualization...",
    data="../testdata/planets.pdf",  # PDF path
    outputs=vw.outputs(
        selected_planet="selected planet name"
    )
)

# Web Scraping
hn_clone = vw.create(
    description="Hacker News clone...",
    data="https://news.ycombinator.com",  # URL
)
      </code></pre>
      <p class="mt-4">
        Vibe Widget automatically detects the data type (PDF, URL, CSV, etc.) and
        handles extraction, parsing, and visualization generation!
      </p>
    `,
    defaultCollapsed: true,
  },
];

export const pdfWeb: NotebookSpec = {
  cells,
  dataFiles: [
    { url: "/testdata/planets.csv", varName: "planets_df", type: "csv" },
    { url: "/testdata/hn_stories.json", varName: "hn_df", type: "json" },
  ],
};
