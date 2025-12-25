import React from 'react';
import PyodideNotebook from '../../../components/PyodideNotebook';
import { REVISE_NOTEBOOK, REVISE_DATA_FILES } from '../../../data/pyodideNotebooks';

const EditExamplePage = () => (
    <PyodideNotebook
        cells={REVISE_NOTEBOOK}
        title="Widget Editing"
        dataFiles={REVISE_DATA_FILES}
        notebookKey="edit"
    />
);

export default EditExamplePage;
