import React from "https://esm.sh/react@18";

export const Square = ({ value, onClick, disabled, html }) => {
  const color = value === 'x' ? '#3b82f6' : value === 'o' ? '#ef4444' : 'transparent';
  return html`
    <button 
      onClick=${onClick}
      disabled=${disabled || value !== 'b'}
      style=${{
        width: '100px',
        height: '100px',
        fontSize: '3rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        cursor: value === 'b' && !disabled ? 'pointer' : 'default',
        color: color,
        transition: 'all 0.2s ease',
        boxShadow: value === 'b' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
      }}
    >
      ${value === 'x' ? 'X' : value === 'o' ? 'O' : ''}
    </button>
  `;
};

export const GameStatus = ({ winner, currentTurn, onReset, html }) => {
  let message = winner === 'tie' ? "It's a Tie!" : winner ? `Winner: ${winner.toUpperCase()}` : `Turn: ${currentTurn.toUpperCase()}`;
  
  return html`
    <div style=${{ marginBottom: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div style=${{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
        ${message}
      </div>
      <button 
        onClick=${onReset}
        style=${{
          padding: '8px 16px',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500'
        }}
      >
        Reset Game
      </button>
    </div>
  `;
};

export default function TicTacToeWidget({ model, html, React }) {
  const [board, setBoard] = React.useState(Array(9).fill('b'));
  const [turn, setTurn] = React.useState('x');
  const [gameOver, setGameOver] = React.useState(false);
  const [winner, setWinner] = React.useState(null);

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set({
      board_state: Array(9).fill('b'),
      game_over: false,
      current_turn: 'x'
    });
    model.save_changes();
  }, []);

  // Sync state to model
  React.useEffect(() => {
    model.set('board_state', board);
    model.set('game_over', gameOver);
    model.set('current_turn', turn);
    model.save_changes();
  }, [board, turn, gameOver]);

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] !== 'b' && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (!squares.includes('b')) return 'tie';
    return null;
  };

  const makeMove = (index, player) => {
    if (board[index] !== 'b' || gameOver) return;

    const newBoard = [...board];
    newBoard[index] = player;
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result) {
      setWinner(result);
      setGameOver(true);
    } else {
      setTurn(player === 'x' ? 'o' : 'x');
    }
  };

  const handleReset = () => {
    setBoard(Array(9).fill('b'));
    setTurn('x');
    setGameOver(false);
    setWinner(null);
  };

  // Handle AI move action from Python
  React.useEffect(() => {
    const handleAction = (event) => {
      const { action, params } = event.changed.action_event || {};
      if (action === "ai_move") {
        const p = event.changed.action_event.params || {};
        const index = parseInt(p.index);
        if (!isNaN(index) && turn === 'o') {
          makeMove(index, 'o');
        }
      }
    };
    model.on("change:action_event", handleAction);
    return () => model.off("change:action_event", handleAction);
  }, [turn, board, gameOver]);

  return html`
    <div style=${{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '400px',
      borderRadius: '12px'
    }}>
      <${GameStatus} 
        winner=${winner} 
        currentTurn=${turn} 
        onReset=${handleReset} 
        html=${html} 
      />
      
      <div style=${{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 100px)', 
        gap: '12px',
        backgroundColor: '#cbd5e1',
        padding: '12px',
        borderRadius: '12px'
      }}>
        ${board.map((cell, i) => html`
          <${Square} 
            key=${i}
            value=${cell} 
            onClick=${() => turn === 'x' && makeMove(i, 'x')}
            disabled=${gameOver || turn === 'o'}
            html=${html}
          />
        `)}
      </div>
      
      <div style=${{ marginTop: '20px', color: '#6b7280', fontSize: '0.875rem' }}>
        Human (X) vs AI (O)
      </div>
    </div>
  `;
}
