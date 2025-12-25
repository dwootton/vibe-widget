import React from 'react';
import PyodideNotebook from '../../../components/PyodideNotebook';
import { TICTACTOE_NOTEBOOK, TICTACTOE_DATA_FILES } from '../../../data/pyodideNotebooks';

const TicTacToeExamplePage = () => (
    <PyodideNotebook
        cells={TICTACTOE_NOTEBOOK}
        title="Tic-Tac-Toe AI"
        dataFiles={TICTACTOE_DATA_FILES}
        notebookKey="tictactoe"
    />
);

export default TicTacToeExamplePage;
