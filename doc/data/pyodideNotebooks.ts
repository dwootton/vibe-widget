import type { NotebookCell } from '../components/PyodideNotebook';

/**
 * Cross-widget interactions demo notebook
 * Showcases scatter plot → bar chart filtering
 */
/**
 * PDF & Web Data Extraction demo notebook
 * Showcases extracting data from PDFs and web pages
 */
export const PDF_WEB_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>PDF & Web Data Extraction</h2>
      <p class="text-lg text-slate/70">
        Vibe Widget can extract data from PDFs and web pages, then create interactive visualizations.
        This demo shows two examples: a 3D solar system from PDF data and a Hacker News clone from web scraping.
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
import pandas as pd

vw.models()`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `# Configure (demo mode - no actual LLM calls)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Config',
  },
  {
    type: 'markdown',
    content: `
      <h3>Example 1: 3D Solar System from PDF</h3>
      <p>
        Extract planet data from a PDF and visualize it as an interactive 3D solar system.
        Click on planets to select them!
      </p>
    `,
  },
  {
    type: 'code',
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
    label: '3D Solar System',
  },
  {
    type: 'markdown',
    content: `
      <h3>Example 2: Hacker News Clone from Web Scraping</h3>
      <p>
        Scrape Hacker News stories and display them in an interactive interface.
        Filter by score, search by keywords, and sort by different criteria!
      </p>
    `,
  },
  {
    type: 'code',
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
    label: 'Hacker News Clone',
  },
  {
    type: 'markdown',
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

/**
 * Widget Editing demo notebook
 * Showcases iterative refinement of widgets
 */
export const REVISE_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>Widget Editing Demo</h2>
      <p class="text-lg text-slate/70">
        Start with a basic chart, then refine it iteratively using <code>vw.edit()</code>.
        Watch how we add interactive features step by step!
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
import pandas as pd

vw.models()`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `# Configure (demo mode)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Config',
  },
  {
    type: 'code',
    content: `# Load COVID-19 data
print(f"COVID-19 data loaded: {len(covid_df)} days")
print(f"Columns: {list(covid_df.columns)}")
covid_df.head(3)`,
    defaultCollapsed: true,
    label: 'Load Data',
  },
  {
    type: 'markdown',
    content: `
      <h3>Step 1: Basic Line Chart</h3>
      <p>Create a simple line chart showing COVID-19 trends over time.</p>
    `,
  },
  {
    type: 'code',
    content: `# Create basic line chart
timeline = vw.create(
    "line chart showing confirmed, deaths, recovered over time",
    data=covid_df
)

timeline`,
    label: 'Basic Chart',
  },
  {
    type: 'markdown',
    content: `
      <h3>Step 2: Add Interactive Hover</h3>
      <p>Use <code>vw.edit()</code> to add a vertical dashed line when hovering.</p>
    `,
  },
  {
    type: 'code',
    content: `# Edit to add interactive hover crosshair
timeline_v2 = vw.edit(
    "add vertical dashed line when user hovering, highlight crossed data points",
    timeline,
    data=covid_df
)

timeline_v2`,
    label: 'Enhanced Chart',
  },
  {
    type: 'markdown',
    content: `
      <h3>How Editing Works</h3>
      <pre class="bg-slate/5 p-4 rounded-lg overflow-x-auto text-sm"><code># Create initial widget
chart = vw.create("scatter plot of data", df)

# Refine it with edit()
chart_v2 = vw.edit(
    "add hover tooltips and color by category",
    chart,  # Pass the original widget
    data=df  # Optionally pass updated data
)

# Keep refining!
chart_v3 = vw.edit(
    "add zoom and pan controls",
    chart_v2
)
      </code></pre>
      <p class="mt-4">
        Each edit builds on the previous version, maintaining context
        while adding new features. This allows for rapid iterative development!
      </p>
    `,
    defaultCollapsed: true,
  },
];

export const CROSS_WIDGET_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>Cross-Widget Interactions</h2>
      <p class="text-lg text-slate/70">
        This demo shows how widgets can communicate with each other. 
        Select points in the scatter plot and watch the bar chart update automatically!
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
import pandas as pd

vw.models()`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `# Configure (demo mode - no actual LLM calls)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Config',
  },
  {
    type: 'code',
    content: `# Load Seattle weather data
# (data is pre-loaded from /testdata/seattle-weather.csv)
print(f"Weather data loaded: {len(data)} rows")
print(f"Columns: {list(data.columns)}")
data.head(3)`,
    defaultCollapsed: true,
    label: 'Load Data',
  },
  {
    type: 'markdown',
    content: `
      <h3>Widget 1: Scatter Plot with Brush Selection</h3>
      <p>
        This widget <strong>outputs</strong> <code>selected_indices</code> - 
        when you brush-select points, it updates the shared variable.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: 'code',
    content: `# Create scatter plot that outputs selected indices
scatter = vw.create(
    description="temperature across days in Seattle, colored by weather condition",
    data=data,
    outputs=vw.outputs(
        selected_indices="List of selected point indices"
    ),
)

scatter`,
    label: 'Scatter Plot',
  },
  {
    type: 'markdown',
    content: `
      <h3>Widget 2: Bar Chart (Linked)</h3>
      <p>
        This widget <strong>inputs</strong> <code>selected_indices</code> from the scatter plot.
        When the selection changes, it automatically updates to show filtered counts.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: 'code',
    content: `# Create bar chart that inputs selected_indices
bars = vw.create(
    "horizontal bar chart of weather conditions' count for selected points",
    vw.inputs(
        data,
        selected_indices=scatter.outputs.selected_indices
    ),
)

bars`,
    label: 'Bar Chart',
  },
  {
    type: 'markdown',
    content: `
      <h3>How It Works</h3>
      <pre class="bg-material-dark/5 p-4 rounded-lg overflow-x-auto"><code class="text-sm"># Widget A outputs a trait
scatter = vw.create(
    ...,
    outputs=vw.outputs(
        selected_indices="description"
    )
)

# Widget B inputs that trait
bars = vw.create(
    ...,
    vw.inputs(
        df,
        selected_indices=scatter.outputs.selected_indices
    )
)
    </code></pre>
    <p class="mt-4">
        Vibe Widget automatically creates bidirectional links using traitlets,
        so changes flow between widgets in real-time!
      </p>
    `,
    defaultCollapsed: true,
  },
];

/**
 * Tic-Tac-Toe AI demo notebook
 * Showcases Python ML + widget interactions
 */
export const TICTACTOE_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>Tic-Tac-Toe AI Demo</h2>
      <p class="text-lg text-slate/70">
        Play against a lightweight AI that uses observers and actions. The AI is intentionally
        imperfect so you can still win.
      </p>
    `,
  },
  {
    type: 'code',
    content: `import time
import math
import random
import vibe_widget as vw`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `def check_winner(board):
    wins = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6)
    ]
    for a, b, c in wins:
        if board[a] == board[b] == board[c] and board[a] != 'b':
            return board[a]
    if 'b' not in board:
        return 'tie'
    return None

def minimax(board, depth, is_maximizing):
    result = check_winner(board)
    if result == 'o': return 10 - depth
    if result == 'x': return -10 + depth
    if result == 'tie': return 0

    if is_maximizing:
        best_score = -math.inf
        for i in range(9):
            if board[i] == 'b':
                board[i] = 'o'
                score = minimax(board, depth + 1, False)
                board[i] = 'b'
                best_score = max(score, best_score)
        return best_score
    else:
        best_score = math.inf
        for i in range(9):
            if board[i] == 'b':
                board[i] = 'x'
                score = minimax(board, depth + 1, True)
                board[i] = 'b'
                best_score = min(score, best_score)
        return best_score

def pick_best_move(board_list, mistake_rate=0.25):
    empty_spots = [i for i, x in enumerate(board_list) if x == 'b']
    if not empty_spots:
        return None

    # Sometimes make a random move so the AI isn't perfect.
    if random.random() < mistake_rate:
        return random.choice(empty_spots)

    # If board is empty, prefer center to save search time.
    if len(empty_spots) == 9:
        return 4

    best_score = -math.inf
    best_moves = []
    for i in empty_spots:
        board_list[i] = 'o'
        score = minimax(board_list, 0, False)
        board_list[i] = 'b'
        if score > best_score:
            best_score = score
            best_moves = [i]
        elif score == best_score:
            best_moves.append(i)
    return random.choice(best_moves) if best_moves else None`,
    defaultCollapsed: true,
    label: 'AI Logic',
  },
  {
    type: 'markdown',
    content: `
      <h3>The Game Board</h3>
      <p>Click cells to play as <strong style="color: #007bff">X (Blue)</strong>. The AI will respond as <strong style="color: #dc3545">O (Red)</strong>!</p>
    `,
  },
  {
    type: 'code',
    content: `# Create the game board widget with outputs and an AI action
game_board = vw.create(
    """Interactive Tic-Tac-Toe game board
    - Human plays X, AI plays O
    - Click cells to make moves
    - Outputs board_state, current_turn, game_over
    - Action ai_move receives an index 0-8 (row-major)
    """,
    outputs=vw.outputs(
        board_state="9-element array of 'x', 'o', or 'b'",
        game_over="boolean",
        current_turn="'x' or 'o'"
    ),
    actions=vw.actions(
        ai_move=vw.action(
            "AI move at index 0-8 (row-major)",
            params={"index": "0-8 row-major"}
        )
    ),
)

game_board`,
    label: 'Game Board',
  },
  {
    type: 'code',
    content: `def on_turn_change(event):
    if event["new"] != "o":
        return

    # Let the UI finish updating.
    time.sleep(0.1)

    board_state = game_board.outputs.board_state.value
    if not board_state or game_board.outputs.game_over.value:
        return

    if isinstance(board_state, str):
        import ast
        board_state = ast.literal_eval(board_state)

    board_list = list(board_state)
    if len(board_list) != 9:
        return

    move_index = pick_best_move(board_list, mistake_rate=0.25)
    if move_index is None:
        return

    game_board.actions.ai_move(index=move_index)

game_board.observe(on_turn_change, names=["current_turn"])`,
    label: 'AI Observer',
  },
];

/**
 * Data files to preload for each notebook
 */
export const WEATHER_DATA_FILES = [
  { url: '/testdata/seattle-weather.csv', varName: 'data' },
];

export const TICTACTOE_DATA_FILES = [
];

export const PDF_WEB_DATA_FILES = [
  { url: '/testdata/planets.csv', varName: 'planets_df' },
  { url: '/testdata/hn_stories.json', varName: 'hn_df', type: 'json' },
];

export const REVISE_DATA_FILES = [
  { url: '/testdata/day_wise.csv', varName: 'covid_df' },
];
/**
 * Map notebook name to its required data files
 */
export const NOTEBOOK_DATA_MAP: Record<string, typeof WEATHER_DATA_FILES> = {
  'cross-widget': WEATHER_DATA_FILES,
  'tictactoe': TICTACTOE_DATA_FILES,
  'pdf-web': PDF_WEB_DATA_FILES,
  'edit': REVISE_DATA_FILES,
};
