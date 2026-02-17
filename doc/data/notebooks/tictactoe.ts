import type { NotebookCell, NotebookSpec } from "./types";

const cells: NotebookCell[] = [
  {
    type: "markdown",
    content: `
      <h2>Tic-Tac-Toe AI Demo</h2>
      <p class="text-lg text-slate/70">
        Play against a lightweight AI that uses observers and actions. The AI is intentionally
        imperfect so you can still win.
      </p>
    `,
  },
  {
    type: "code",
    content: `import time
import math
import random
import vibe_widget as vw`,
    defaultCollapsed: true,
    label: "Setup",
  },
  {
    type: "code",
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
    label: "AI Logic",
  },
  {
    type: "markdown",
    content: `
      <h3>The Game Board</h3>
      <p>Click cells to play as <strong style="color: #007bff">X (Blue)</strong>. The AI will respond as <strong style="color: #dc3545">O (Red)</strong>!</p>
    `,
  },
  {
    type: "code",
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
    label: "Game Board",
  },
  {
    type: "code",
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
    label: "AI Observer",
  },
];

export const tictactoe: NotebookSpec = {
  cells,
  dataFiles: [],
};
