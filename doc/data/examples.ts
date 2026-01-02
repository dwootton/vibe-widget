// Import notebook data to get widget URLs (single source of truth)
import tictactoeNotebook from './notebooks/tictactoe_notebook.json';
import crossWidgetNotebook from './notebooks/cross_widget_notebook.json';
import pdfWebNotebook from './notebooks/pdf_web_notebook.json';
import reviseNotebook from './notebooks/revise_notebook.json';
import mnistNotebook from './notebooks/mnist_notebook.json';
import chiPapersNotebook from './notebooks/chi_papers_notebook.json';

// Extract widget URLs from notebook definitions
const TICTACTOE_URL = tictactoeNotebook.widgets.tictactoe.url;
const SCATTER_URL = crossWidgetNotebook.widgets.scatter.url;
const BARS_URL = crossWidgetNotebook.widgets.bars.url;
const SOLAR_SYSTEM_URL = pdfWebNotebook.widgets.solar_system.url;
const HN_CLONE_URL = pdfWebNotebook.widgets.hacker_news.url;
const COVID_TRENDS_URL = reviseNotebook.widgets.line_chart.url;
const COVID_TRENDS_2_URL = reviseNotebook.widgets.line_chart_hover.url;
const CHI25_EMBEDDING_URL = chiPapersNotebook.widgets.chi_papers_explorer.url;
const MNIST_RECOG_URL = mnistNotebook.widgets.mnist.url;


export type Category = 'Featured' | 'Data Visualization' | 'Reactive' | '3D';

export const EXAMPLES = [
  {
    id: 'tic-tac-toe',
    label: 'Interactive Tic-Tac-Toe Game',
    prompt: "Interactive game board with AI opponent using ML model",
    moduleUrl: TICTACTOE_URL,
    description: 'Play tic-tac-toe against an AI trained on game patterns. The widget outputs board state and takes AI moves as inputs, demonstrating bidirectional widget communication.',
    categories: ['Featured', 'Reactive'] as Category[],
    size: 'large' as const,
    dataUrl: '/testdata/tic-tac-toe.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'weather-scatter',
    label: 'Weather Scatter Plot',
    prompt: "Brush-select temperature points to filter by weather condition",
    moduleUrl: SCATTER_URL,
    description: 'Interactive scatter plot showing Seattle weather data. Brush-select points to see selected weather patterns exported to linked widgets.',
    categories: ['Data Visualization', 'Reactive', 'Featured'] as Category[],
    size: 'medium' as const,
    dataUrl: '/testdata/seattle-weather.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'weather-bars',
    label: 'Weather Bar Chart (Linked)',
    prompt: "Bar chart filtered by scatter plot selection",
    moduleUrl: BARS_URL,
    description: 'Bar chart showing weather condition counts. Automatically updates based on scatter plot selections, demonstrating reactive data flow.',
    categories: ['Data Visualization', 'Reactive', 'Featured'] as Category[],
    size: 'large' as const,
    dataUrl: '/testdata/seattle-weather.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'solar-system',
    label: '3D Solar System',
    prompt: "3D solar system using Three.js showing planets orbiting the sun",
    moduleUrl: SOLAR_SYSTEM_URL,
    description: 'Extract planet data from a PDF and visualize it as an interactive 3D solar system. Click on planets to select them!',
    categories: ['Featured', '3D'] as Category[],
    size: 'small' as const,
    dataUrl: '/testdata/planets.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'hn-clone',
    label: 'Hacker News Clone',
    prompt: "Create an interactive Hacker News clone widget",
    moduleUrl: HN_CLONE_URL,
    description: 'Scrape Hacker News stories and display them in an interactive interface. Filter by score, search by keywords, and sort by different criteria!',
    categories: ['Data Visualization'] as Category[],
    size: 'medium' as const,
    dataUrl: '/testdata/hn_stories.json',
    dataType: 'json' as const,
  },
  {
    id: 'covid-trends',
    label: 'COVID-19 Trends',
    prompt: "Line chart showing Confirmed, Deaths, and Recovered cases over time",
    moduleUrl: COVID_TRENDS_2_URL,
    description: 'Visualize COVID-19 pandemic trends with an interactive line chart showing confirmed cases, deaths, and recoveries over time.',
    categories: ['Data Visualization'] as Category[],
    size: 'medium' as const,
    dataUrl: '/testdata/day_wise.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'mnist-recognition',
    label: 'MNIST Digit Recognition',
    prompt: "Draw digits on canvas with real-time ML predictions",
    moduleUrl: MNIST_RECOG_URL,
    description: 'Interactive canvas for drawing digits with live predictions from a pre-trained TensorFlow model. See real-time accuracy scores for each digit class with cross-widget communication.',
    categories: ['Featured', 'Reactive'] as Category[],
    size: 'large' as const,
  },
  {
    id: 'chi25-papers',
    label: 'CHI Papers Explorer',
    prompt: "Query-driven semantic search through CHI 2025 papers with interactive visualization",
    moduleUrl: CHI25_EMBEDDING_URL,
    description: 'Explore CHI 2025 papers using semantic search with animated wave visualization. Type queries to find similar papers with real-time similarity-based highlighting and interactive node exploration.',
    categories: ['Featured', 'Data Visualization', 'Reactive'] as Category[],
    size: 'large' as const,
    dataUrl: '/testdata/CHI_2025_papers_2D.csv',
    dataType: 'csv' as const,
  },
];
