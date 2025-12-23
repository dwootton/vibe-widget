import type { NotebookCell } from '../components/PyodideNotebook';

/**
 * Cross-widget interactions demo notebook
 * Showcases scatter plot → bar chart filtering
 */
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
      <pre class="bg-slate/5 p-4 rounded-lg overflow-x-auto"><code class="text-sm"># Widget A exports a trait
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
    content: `# Create the game board widget
game_board = vw.create(
    """Interactive Tic-Tac-Toe game board
    - Human plays X, AI plays O
    - Click cells to make moves
    - Exports board_state, current_turn, game_over
    - Imports ai_move to receive AI responses
    """,
    exports={
        "board_state": "9-element array of 'x', 'o', or 'b'",
        "game_over": "boolean",
        "current_turn": "'x' or 'o'"
    },
    imports={
        "ai_move": "object {row: number, col: number} for AI move placement"
    },
)

game_board`,
    label: 'Game Board',
  },
  {
    type: 'code',
    content: `# AI controller - responds to game state changes
import time

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
            # Send move back to widget
            game_board.ai_move = {"row": int(move[0]), "col": int(move[1])}
        else:
            print("No valid move found")
            
    except Exception as e:
        print(f"Error in AI move: {e}")
        import traceback
        traceback.print_exc()

# Observe changes to trigger AI moves
game_board.observe(make_ai_move, names=['current_turn'])`,
    label: 'AI Controller',
  },
];

/**
 * PDF & Web Extraction demo notebook
 * Shows how vibe_widget can handle PDF tables and web scraping
 */
export const PDF_WEB_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>PDF & Web Data Extraction</h2>
      <p class="text-lg text-slate/70">
        Vibe Widget can automatically extract data from PDFs and websites, 
        then create beautiful interactive visualizations!
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
import pandas as pd

vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'markdown',
    content: `
      <h3>Example 1: Solar System from PDF</h3>
      <p>
        Extract planetary data from a PDF and create an interactive 3D visualization!
        Click on planets to select them.
      </p>
    `,
  },
  {
    type: 'code',
    content: `# Load planet data (extracted from PDF)
print(f"Planet data: {len(planets_df)} planets")
print(f"Columns: {list(planets_df.columns)}")
planets_df`,
    defaultCollapsed: true,
    label: 'Planet Data',
  },
  {
    type: 'code',
    content: `# Create solar system widget
solar_system = vw.create(
    "scatter plot of planets showing distance_from_sun vs diameter, with size by mass",
    data=planets_df,
    exports={
        "selected_planet": "name of the currently selected planet"
    }
)

solar_system`,
    label: 'Solar System',
  },
  {
    type: 'markdown',
    content: `
      <h3>Example 2: Web Data Visualization</h3>
      <p>
        Visualize data scraped from websites - here we show Hacker News style data!
      </p>
    `,
  },
  {
    type: 'code',
    content: `# Load HN-style data
print(f"Stories loaded: {len(hn_df)} items")
hn_df.head(5)`,
    defaultCollapsed: true,
    label: 'HN Data',
  },
  {
    type: 'code',
    content: `# Create bar chart of story scores
hn_chart = vw.create(
    "horizontal bar chart showing top stories by score, with interactive hover",
    data=hn_df
)

hn_chart`,
    label: 'HN Scores',
  },
  {
    type: 'markdown',
    content: `
      <h3>How It Works</h3>
      <div class="bg-slate/5 p-4 rounded-lg">
        <p class="font-semibold mb-2">Behind the scenes, Vibe Widget:</p>
        <ol class="list-decimal list-inside space-y-1 text-sm">
          <li>Detects the data source type (PDF, URL, DataFrame)</li>
          <li>Extracts tables/content using specialized parsers</li>
          <li>Generates custom React+D3 visualization code</li>
          <li>Validates and displays the interactive widget</li>
        </ol>
      </div>
    `,
    defaultCollapsed: true,
  },
];

/**
 * Widget Revision demo notebook
 * Shows how to iteratively refine widgets with vw.revise()
 */
export const REVISE_NOTEBOOK: NotebookCell[] = [
  {
    type: 'markdown',
    content: `
      <h2>Widget Revision with <code>vw.revise()</code></h2>
      <p class="text-lg text-slate/70">
        Iteratively refine widgets by building upon existing code.
        Watch how a simple chart transforms into an interactive dashboard!
      </p>
    `,
  },
  {
    type: 'code',
    content: `import vibe_widget as vw
import pandas as pd

vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Setup',
  },
  {
    type: 'code',
    content: `# Load COVID-19 day-wise data
print(f"COVID data loaded: {len(covid_df)} rows")
print(f"Columns: {list(covid_df.columns)}")
covid_df.head(3)`,
    defaultCollapsed: true,
    label: 'Load Data',
  },
  {
    type: 'markdown',
    content: `
      <h3>Step 1: Basic Line Chart</h3>
      <p>Start with a simple line chart showing COVID-19 trends over time.</p>
    `,
  },
  {
    type: 'code',
    content: `# Create basic line chart
timeline = vw.create(
    "line chart showing Confirmed, Deaths, and Recovered cases over time",
    covid_df
)

timeline`,
    label: 'Basic Chart',
  },
  {
    type: 'markdown',
    content: `
      <h3>Step 2: Enhanced Version</h3>
      <p>Use <code>vw.revise()</code> to add interactive hover crosshair.</p>
    `,
  },
  {
    type: 'code',
    content: `# Revise to add interactive hover
timeline_v2 = vw.revise(
    "add vertical dashed line when hovering, highlight crossed data points",
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
    `,
    defaultCollapsed: true,
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

export const ALL_DATA_FILES = [
  ...WEATHER_DATA_FILES,
  ...TICTACTOE_DATA_FILES,
  ...PDF_WEB_DATA_FILES,
  ...REVISE_DATA_FILES,
];
