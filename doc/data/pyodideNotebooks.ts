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
    - Export the selected planet name
    """,
    data="../testdata/ellipseplanet.pdf",
    exports=vw.exports(
        selected_planet=vw.export("name of the currently selected planet")
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
    exports=vw.exports(
        selected_planet=vw.export("selected planet name")
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
 * Widget Revision demo notebook
 * Showcases iterative refinement of widgets
 */
export const REVISE_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>Widget Revision Demo</h2>
      <p class="text-lg text-slate/70">
        Start with a basic chart, then refine it iteratively using <code>vw.revise()</code>.
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
      <p>Use <code>vw.revise()</code> to add a vertical dashed line when hovering.</p>
    `,
  },
  {
    type: 'code',
    content: `# Revise to add interactive hover crosshair
timeline_v2 = vw.revise(
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
      <h3>How Revision Works</h3>
      <pre class="bg-slate/5 p-4 rounded-lg overflow-x-auto text-sm"><code># Create initial widget
chart = vw.create("scatter plot of data", df)

# Refine it with revise()
chart_v2 = vw.revise(
    "add hover tooltips and color by category",
    chart,  # Pass the original widget
    data=df  # Optionally pass updated data
)

# Keep refining!
chart_v3 = vw.revise(
    "add zoom and pan controls",
    chart_v2
)
      </code></pre>
      <p class="mt-4">
        Each revision builds on the previous version, maintaining context
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
        This widget <strong>exports</strong> <code>selected_indices</code> - 
        when you brush-select points, it updates the shared variable.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: 'code',
    content: `# Create scatter plot that exports selected indices
scatter = vw.create(
    description="temperature across days in Seattle, colored by weather condition",
    data=data,
    exports=vw.exports(
        selected_indices=vw.export("List of selected point indices")
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
        This widget <strong>imports</strong> <code>selected_indices</code> from the scatter plot.
        When the selection changes, it automatically updates to show filtered counts.
      </p>
    `,
    defaultCollapsed: true,
  },
  {
    type: 'code',
    content: `# Create bar chart that imports selected_indices
bars = vw.create(
    "horizontal bar chart of weather conditions' count for selected points",
    vw.imports(
        data,
        selected_indices=scatter.selected_indices
    ),
)

bars`,
    label: 'Bar Chart',
  },
  {
    type: 'markdown',
    content: `
      <h3>How It Works</h3>
      <pre class="bg-material-dark/5 p-4 rounded-lg overflow-x-auto"><code class="text-sm"># Widget A exports a trait
scatter = vw.create(
    ...,
    exports=vw.exports(
        selected_indices=vw.export("description")
    )
)

# Widget B imports that trait
bars = vw.create(
    ...,
    vw.imports(
        df,
        selected_indices=scatter.selected_indices
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
        Play against a machine learning AI! The model is trained on thousands of games
        using scikit-learn's GradientBoostingClassifier.
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
import numpy as np
import pandas as pd



vw.config(model="google/gemini-3-flash-preview", api_key="demo")`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `# Check loaded training data
print(f"Loaded X_moves: {len(x_moves_df)} moves")
print(f"Loaded O_moves: {len(o_moves_df)} moves")
print(f"Columns: {list(x_moves_df.columns[:10])}...")`,
    defaultCollapsed: true,
    label: 'Data Check',
  },
  {
    type: 'markdown',
    content: `
      <h3>Training the AI</h3>
      <p>We train two models - one for predicting rows and one for columns.</p>
    `,
    defaultCollapsed: true,
  },
  {
    type: 'code',
    content: `# Feature columns (board state encoding)
feature_cols = ['00-1', '00-2', '01-1', '01-2', '02-1', '02-2', 
                '10-1', '10-2', '11-1', '11-2', '12-1', '12-2', 
                '20-1', '20-2', '21-1', '21-2', '22-1', '22-2']


# Prepare X training data (all winning games for X)
X_features = x_moves_df[feature_cols]
X_move_I = x_moves_df['move_I']
X_move_J = x_moves_df['move_J']

# Split for evaluation
X_train_feat, X_test_feat, X_train_I, X_test_I, X_train_J, X_test_J = train_test_split(
    X_features, X_move_I, X_move_J, test_size=0.15, random_state=42
)


# Train X player models with improved parameters
print("Training X row predictor (GradientBoosting with depth 5)...")
lr_I_X = GradientBoostingClassifier(
    n_estimators=100, 
    max_depth=5, 
    learning_rate=0.1,
    random_state=42
)
lr_I_X.fit(X_train_feat, X_train_I)

print("Training X column predictor (GradientBoosting with depth 5)...")
lr_J_X = GradientBoostingClassifier(
    n_estimators=100, 
    max_depth=5, 
    learning_rate=0.1,
    random_state=42
)
lr_J_X.fit(X_train_feat, X_train_J)

# Evaluate X models
X_I_acc = lr_I_X.score(X_test_feat, X_test_I)
X_J_acc = lr_J_X.score(X_test_feat, X_test_J)

# Prepare O training data (only winning games for O)
o_winning = o_moves_df[(o_moves_df['winner'] == 1) & (o_moves_df['move_I'] != -1)]

O_features = o_winning[feature_cols]
O_move_I = o_winning['move_I']
O_move_J = o_winning['move_J']

# Split for evaluation
O_train_feat, O_test_feat, O_train_I, O_test_I, O_train_J, O_test_J = train_test_split(
    O_features, O_move_I, O_move_J, test_size=0.15, random_state=42
)

# Train O player models with improved parameters
print("Training O row predictor (GradientBoosting with depth 5)...")
lr_I_O = GradientBoostingClassifier(
    n_estimators=100, 
    max_depth=5, 
    learning_rate=0.1,
    random_state=42
)
lr_I_O.fit(O_train_feat, O_train_I)

print("Training O column predictor (GradientBoosting with depth 5)...")
lr_J_O = GradientBoostingClassifier(
    n_estimators=100, 
    max_depth=5, 
    learning_rate=0.1,
    random_state=42
)
lr_J_O.fit(O_train_feat, O_train_J)

# Evaluate O models
O_I_acc = lr_I_O.score(O_test_feat, O_test_I)
O_J_acc = lr_J_O.score(O_test_feat, O_test_J)
`,
    defaultCollapsed: true,
    label: 'Train AI',
  },
  {
    type: 'code',
    content: `# Helper functions for AI
# Helper functions for board conversion
def board_to_features(board_list):
    """
    Convert board state ['x','o','b',...] to feature vector for model.
    board_list: 9-element list in order [00, 01, 02, 10, 11, 12, 20, 21, 22]
    Returns: 18-element list with one-hot encoding
    """
    features = []
    for cell in board_list:
        if cell == 'o':
            features.extend([1.0, 0.0])
        elif cell == 'x':
            features.extend([0.0, 1.0])
        else:  # 'b' for blank
            features.extend([0.0, 0.0])
    return features

def get_empty_positions(board_list):
    """Get list of empty (row, col) positions"""
    empty = []
    for idx, cell in enumerate(board_list):
        if cell == 'b':
            row = idx // 3
            col = idx % 3
            empty.append((row, col))
    return empty

def check_winning_move(board_state, player):
    """Check if there's a winning move for the player"""
    empty_positions = get_empty_positions(board_state)
    for row, col in empty_positions:
        idx = row * 3 + col
        test_board = board_state.copy()
        test_board[idx] = player
        if check_winner(test_board) == player:
            return (row, col)
    return None

def check_winner(board):
    """Check if there's a winner on the board"""
    # Check rows
    for i in range(3):
        if board[i*3] == board[i*3+1] == board[i*3+2] != 'b':
            return board[i*3]
    # Check columns
    for i in range(3):
        if board[i] == board[i+3] == board[i+6] != 'b':
            return board[i]
    # Check diagonals
    if board[0] == board[4] == board[8] != 'b':
        return board[0]
    if board[2] == board[4] == board[6] != 'b':
        return board[2]
    return None

def predict_best_move(board_state, player='o'):
    """
    Predict best move for given player using trained models.
    board_state: 9-element list ['x','o','b',...] in order [00,01,02,10,11,12,20,21,22]
    player: 'x' or 'o'
    Returns: (row, col) tuple or None if no valid moves
    """
    empty_positions = get_empty_positions(board_state)
    if not empty_positions:
        return None
    
    # First priority: Check if we can win
    winning_move = check_winning_move(board_state, player)
    if winning_move:
        return winning_move
    
    # Second priority: Block opponent's winning move
    opponent = 'x' if player == 'o' else 'o'
    blocking_move = check_winning_move(board_state, opponent)
    if blocking_move:
        return blocking_move
    
    # Convert board to features
    features = board_to_features(board_state)
    X_input = pd.DataFrame([features], columns=feature_cols)
    
    # Get model predictions
    if player == 'x':
        I_probs = lr_I_X.predict_proba(X_input)
        J_probs = lr_J_X.predict_proba(X_input)
    else:  # 'o'
        I_probs = lr_I_O.predict_proba(X_input)
        J_probs = lr_J_O.predict_proba(X_input)
    
    # Compute joint probability matrix (outer product)
    prob_matrix = np.dot(I_probs.T, J_probs)  # 3x3 matrix
    
    # Find best valid move
    best_score = -1
    best_move = None
    
    for row, col in empty_positions:
        score = prob_matrix[row, col]
        if score > best_score:
            best_score = score
            best_move = (row, col)
    
    return best_move`,
    defaultCollapsed: true,
    label: 'AI Functions',
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
    content: `# Create the game board widget with proper exports
game_board = vw.create(
    """Interactive Tic-Tac-Toe game board
    - Human plays X, AI plays O
    - Click cells to make moves
    - Exports board_state, current_turn, game_over
    - Imports ai_move to receive AI responses
    """,
    exports=vw.exports(
        board_state=vw.export("9-element array of 'x', 'o', or 'b'"),
        game_over=vw.export("boolean"),
        current_turn=vw.export("'x' or 'o'")
    ),
)

game_board`,
    label: 'Game Board',
  },
  {
    type: 'code',
    content: `# Create AI controller widget that computes moves
import time

# This widget receives board state and computes AI moves
ai_controller = vw.create(
    """AI Move Controller
    - Imports board_state and current_turn from game board
    - Computes optimal AI move using ML model
    - Exports ai_move to trigger board update
    """,
    exports=vw.exports(
        ai_move=vw.export("object {row: number, col: number}")
    ),
)

def make_ai_move(change):
    """Called when board_state or current_turn changes"""
    # Wait a bit for better UX
    time.sleep(0.3)
    
    try:
        board_state = game_board.board_state
        current_turn = game_board.current_turn
        game_over = game_board.game_over
        
        # Only make move if it's O's turn and game is not over
        if current_turn != 'o' or game_over or not board_state:
            return
        
        # Convert board_state to list if needed
        if isinstance(board_state, str):
            import ast
            board_state = ast.literal_eval(board_state)
        
        # Ensure it's a list
        board_list = list(board_state)
        
        # Validate board format (should be 9 elements)
        if len(board_list) != 9:
            print(f"Invalid board state length: {len(board_list)}, expected 9")
            return
        
        # The board widget exports in row-major order: [00,01,02,10,11,12,20,21,22]
        # Our predict_best_move expects the same format
        move = predict_best_move(board_list, player='o')
        
        if move:
            print(f"AI (O) plays at position ({move[0]}, {move[1]})")
            # Send move to AI controller which will notify game board
            ai_controller.ai_move = {"row": int(move[0]), "col": int(move[1])}
        else:
            print("No valid move found")
            
    except Exception as e:
        print(f"Error in AI move: {e}")
        import traceback
        traceback.print_exc()

# Observe changes to trigger AI moves
game_board.observe(make_ai_move, names=['current_turn'])

# Link AI controller output to game board input
game_board_linked = vw.create(
    """Game board with AI integration
    - Same as game_board but imports ai_move from AI controller
    """,
    exports=vw.exports(
        board_state=vw.export("9-element array"),
        game_over=vw.export("boolean"),
        current_turn=vw.export("'x' or 'o'")
    ),
    imports=vw.imports(
        ai_move=ai_controller
    ),
)

print("AI controller linked to game board!")
game_board`,
    label: 'AI Controller',
  },
];

/**
 * Data files to preload for each notebook
 */
export const WEATHER_DATA_FILES = [
  { url: '/testdata/seattle-weather.csv', varName: 'data' },
];

export const TICTACTOE_DATA_FILES = [
  { url: '/testdata/X_moves.csv', varName: 'x_moves_df' },
  { url: '/testdata/O_moves.csv', varName: 'o_moves_df' },
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
  'revise': REVISE_DATA_FILES,
};
