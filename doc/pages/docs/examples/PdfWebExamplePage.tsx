import React from 'react';
import PyodideNotebook from '../../../components/PyodideNotebook';
import { PDF_WEB_NOTEBOOK, PDF_WEB_DATA_FILES } from '../../../data/pyodideNotebooks';

const PdfWebExamplePage = () => (
    <PyodideNotebook
        cells={PDF_WEB_NOTEBOOK}
        title="PDF & Web Data Extraction"
        dataFiles={PDF_WEB_DATA_FILES}
        notebookKey="pdf-web"
    />
);

export default PdfWebExamplePage;
