import React from 'react';
import PyodideNotebook from '../../../components/PyodideNotebook';
import { CROSS_WIDGET_NOTEBOOK, WEATHER_DATA_FILES } from '../../../data/pyodideNotebooks';

const CrossWidgetExamplePage = () => (
    <PyodideNotebook
        cells={CROSS_WIDGET_NOTEBOOK}
        title="Cross-Widget Interactions"
        dataFiles={WEATHER_DATA_FILES}
        notebookKey="cross-widget"
    />
);

export default CrossWidgetExamplePage;
