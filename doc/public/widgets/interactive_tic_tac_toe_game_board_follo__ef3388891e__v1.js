/**
 * Tic-Tac-Toe Game Widget
 * Features: 3x3 Grid, AI Integration via ai_move trait, Win/Draw detection.
 */

const WIN_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function TicTacToeWidget({ model, React }) {
  // Internal State
  const [board, setBoard] = React.useState(Array(9).fill('b'));
  const [turn, setTurn] = React.useState('x');
  const [winner, setWinner] = React.useState(null); // 'x', 'o', or 'draw'

  // Initialize and sync exports
  React.useEffect(() => {
    model.set("board_state", board);
    model.set("current_turn", turn);
    model.set("game_over", !!winner);
    model.save_changes();
  }, [board, turn, winner]);

  // Check for winner or draw
  const checkGameState = (currentBoard) => {
    for (let combo of WIN_COMBINATIONS) {
      const [a, b, c] = combo;
      if (currentBoard[a] !== 'b' && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return currentBoard[a];
      }
    }
    if (!currentBoard.includes('b')) return 'draw';
    return null;
  };

  // Move Logic
  const makeMove = (index, player) => {
    if (board[index] !== 'b' || winner) return;

    const newBoard = [...board];
    newBoard[index] = player;
    
    const gameResult = checkGameState(newBoard);
    setBoard(newBoard);
    
    if (gameResult) {
      setWinner(gameResult);
    } else {
      setTurn(player === 'x' ? 'o' : 'x');
    }
  };

  // Handle AI Move from Trait
  React.useEffect(() => {
    const handleAiMove = () => {
      const move = model.get("ai_move");
      if (move && typeof move.row === 'number' && typeof move.col === 'number') {
        const index = move.row * 3 + move.col;
        if (turn === 'o' && !winner) {
          makeMove(index, 'o');
        }
      }
    };

    model.on("change:ai_move", handleAiMove);
    return () => model.off("change:ai_move", handleAiMove);
  }, [turn, winner, board]);

  const resetGame = () => {
    setBoard(Array(9).fill('b'));
    setTurn('x');
    setWinner(null);
  };

  // Styles
  const styles = {
    container: {
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      background: '#f8f9fa',
      borderRadius: '12px',
      height: '460px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 80px)',
      gridTemplateRows: 'repeat(3, 80px)',
      gap: '10px',
      margin: '20px 0'
    },
    cell: (value) => ({
      width: '80px',
      height: '80px',
      backgroundColor: '#fff',
      border: '2px solid #dee2e6',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2rem',
      fontWeight: 'bold',
      cursor: value === 'b' && !winner ? 'pointer' : 'default',
      color: value === 'x' ? '#007bff' : '#dc3545',
      transition: 'background 0.2s'
    }),
    status: {
      fontSize: '1.2rem',
      fontWeight: '600',
      marginBottom: '10px',
      color: '#343a40'
    },
    button: {
      padding: '8px 16px',
      fontSize: '1rem',
      cursor: 'pointer',
      backgroundColor: '#212529',
      color: 'white',
      border: 'none',
      borderRadius: '4px'
    }
  };

  const getStatusMessage = () => {
    if (winner === 'draw') return "It's a Draw!";
    if (winner) return `Winner: ${winner.toUpperCase()}`;
    return `Current Turn: ${turn.toUpperCase()}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.status}>{getStatusMessage()}</div>

      <div style={styles.grid}>
        {board.map((cell, i) => (
          <div
            key={i}
            style={styles.cell(cell)}
            onClick={() => turn === "x" && makeMove(i, "x")}
          >
            {cell !== "b" ? cell.toUpperCase() : ""}
          </div>
        ))}
      </div>

      <button style={styles.button} onClick={resetGame}>
        Reset Game
      </button>

      <div style={{ marginTop: "15px", fontSize: "0.8rem", color: "#6c757d" }}>
        X = Human (Blue) | O = AI (Red)
      </div>
    </div>
  );
}
