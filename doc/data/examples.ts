// Note: In a real environment with Vite, you can import raw files like this:
// import TIC_TAC_TOE_CODE_RAW from './vibe-widgets/tictactoe.js?raw';

export const TIC_TAC_TOE_CODE = `
import * as React from "https://esm.sh/react@18";
import { html } from "https://esm.sh/htm@3/react";

export default function Widget({ model }) {
  const [board, setBoard] = React.useState(['b','b','b','b','b','b','b','b','b']);
  const [currentTurn, setCurrentTurn] = React.useState('x');
  const [gameOver, setGameOver] = React.useState(false);
  const [status, setStatus] = React.useState("X's turn");

  const checkWinner = (boardState) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    
    for (let line of lines) {
      const [a, b, c] = line;
      if (boardState[a] !== 'b' && 
          boardState[a] === boardState[b] && 
          boardState[a] === boardState[c]) {
        return boardState[a];
      }
    }
    
    if (boardState.every(cell => cell !== 'b')) {
      return 'draw';
    }
    
    return null;
  };

  const updateGameState = (newBoard, newTurn, isGameOver, statusText) => {
    setBoard(newBoard);
    setCurrentTurn(newTurn);
    setGameOver(isGameOver);
    setStatus(statusText);
  };

  const handleCellClick = (index) => {
    if (gameOver || board[index] !== 'b' || currentTurn !== 'x') return;
    
    const newBoard = [...board];
    newBoard[index] = 'x';
    
    const winner = checkWinner(newBoard);
    if (winner === 'x') {
      updateGameState(newBoard, 'x', true, 'X wins!');
    } else if (winner === 'draw') {
      updateGameState(newBoard, 'x', true, 'Draw!');
    } else {
      updateGameState(newBoard, 'o', false, "O's turn");
      // Simulate AI
      setTimeout(() => {
         const available = newBoard.map((c, i) => c === 'b' ? i : null).filter(i => i !== null);
         if (available.length > 0) {
            const move = available[Math.floor(Math.random() * available.length)];
            const aiBoard = [...newBoard];
            aiBoard[move] = 'o';
            const aiWinner = checkWinner(aiBoard);
            if (aiWinner === 'o') updateGameState(aiBoard, 'o', true, 'O wins!');
            else if (aiWinner === 'draw') updateGameState(aiBoard, 'o', true, 'Draw!');
            else updateGameState(aiBoard, 'x', false, "X's turn");
         }
      }, 500);
    }
  };

  const handleReset = () => {
    updateGameState(['b','b','b','b','b','b','b','b','b'], 'x', false, "X's turn");
  };

  const getCellDisplay = (value) => {
    if (value === 'x') return 'X';
    if (value === 'o') return 'O';
    return '';
  };

  return html\`
    <div style=\${{ padding: '24px', fontFamily: 'monospace', width: '100%' }}>
      <h2 style=\${{ textAlign: 'center', marginBottom: '16px', fontWeight: 'bold' }}>Tic-Tac-Toe</h2>
      <div style=\${{ textAlign: 'center', marginBottom: '16px' }}>\${status}</div>
      <div style=\${{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxWidth: '200px', margin: '0 auto 24px' }}>
        \${board.map((cell, index) => html\`
          <button
            key=\${index}
            onClick=\${() => handleCellClick(index)}
            style=\${{
              aspectRatio: '1',
              fontSize: '24px',
              fontWeight: 'bold',
              border: '2px solid #1A1A1A',
              borderRadius: '4px',
              backgroundColor: cell === 'b' ? '#f3f4f6' : '#fff',
              color: cell === 'x' ? '#f97316' : '#1A1A1A',
              cursor: 'pointer'
            }}
          >
            \${getCellDisplay(cell)}
          </button>
        \`)}
      </div>
      <div style=\${{ textAlign: 'center' }}>
        <button onClick=\${handleReset} style=\${{ padding: '8px 16px', backgroundColor: '#1A1A1A', color: 'white', border: 'none', borderRadius: '4px' }}>
          Reset
        </button>
      </div>
    </div>
  \`;
}
`;

export const D3_CHART_CODE = `
import * as d3 from "https://esm.sh/d3@7";

export default function Widget({ model, html, React }) {
  const containerRef = React.useRef(null);
  const [data] = React.useState(() => Array.from({length: 30}, () => ({
     x: Math.random() * 100,
     y: Math.random() * 100,
     val: Math.random()
  })));

  React.useEffect(() => {
    if (!containerRef.current) return;
    
    const width = 300;
    const height = 200;
    const margin = {top: 20, right: 20, bottom: 30, left: 40};

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", \`0 0 \${width} \${height}\`);

    const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

    svg.append("g")
        .attr("transform", \`translate(0,\${height - margin.bottom})\`)
        .call(d3.axisBottom(x).ticks(5));

    svg.append("g")
        .attr("transform", \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).ticks(5));

    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 5)
        .attr("fill", "#f97316")
        .attr("opacity", 0.6)
        .on("mouseover", function() { d3.select(this).attr("r", 8).attr("opacity", 1); })
        .on("mouseout", function() { d3.select(this).attr("r", 5).attr("opacity", 0.6); });

  }, []);

  return html\`<div ref=\${containerRef} style=\${{ width: '100%', height: '300px' }} />\`;
}
`;

export const EXAMPLES = [
    {
        id: 'tictactoe',
        label: "Tic-Tac-Toe Game (Interactive)",
        prompt: "Create a Tic-Tac-Toe game where I play against a basic AI",
        code: TIC_TAC_TOE_CODE
    },
    {
        id: 'd3scatter',
        label: "D3 Scatter Plot (Visualization)",
        prompt: "Scatter plot with D3.js showing random distribution with tooltips",
        code: D3_CHART_CODE
    },
    {
        id: 'heatmap',
        label: "Seismic Heatmap",
        prompt: "Generate a heatmap of seismic activity with color gradient",
        code: D3_CHART_CODE // Reusing D3 Code for demo purposes in this environment
    },
    {
        id: 'network',
        label: "Social Network Graph",
        prompt: "Force directed graph of social connections",
        code: D3_CHART_CODE // Reusing D3 Code for demo purposes
    }
];