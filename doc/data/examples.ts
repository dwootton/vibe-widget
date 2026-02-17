import type { DataFileConfig } from "../utils/exampleDataLoader";

const TICTACTOE_URL = "/widgets/interactive_tic_tac_toe_game_board_follo__ef3388891e__v1.js";
const SCATTER_URL = "/widgets/temperature_across_days_seattle_colored__1e5a77bc87__v1.js";
const BARS_URL = "/widgets/horizontal_bar_chart_weather_conditions__b7796577c1__v2.js";
const SOLAR_SYSTEM_URL = "/widgets/3d_solar_system_using_three_js_showing_p__0ef429f27d__v1.js";
const HN_CLONE_URL = "/widgets/create_interactive_hacker_news_clone_wid__d763f3d4a1__v2.js";
const COVID_TRENDS_2_URL = "/widgets/add_vertical_dashed_line_user_hovering_d__9899268ecc__v1.js";
const CHI25_EMBEDDING_URL = "/widgets/interactive_visualization_showing_paper__8646b068fa__v8.js";
const MNIST_RECOG_URL = "/widgets/combined_mnist_digit_recognition_widget__b42bb3c898__v2.js";

export type Category = "Featured" | "Data Visualization" | "Reactive" | "3D";

export interface Example {
  id: string;
  label: string;
  prompt: string;
  description: string;
  moduleUrl: string;
  categories: Category[];
  size: "small" | "medium" | "large";
  gifUrl: string;
  /** Data files for preview and notebook (single source of truth) */
  dataFiles: DataFileConfig[];
  /** Whether the widget preview needs data before rendering */
  requiresDataForPreview: boolean;
  /** Key for getNotebook() when this example has an associated notebook */
  notebookId?: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "tic-tac-toe",
    label: "Interactive Tic-Tac-Toe Game",
    prompt: "Interactive game board with AI opponent using ML model",
    moduleUrl: TICTACTOE_URL,
    description:
      "Play tic-tac-toe against an AI trained on game patterns. The widget outputs board state and takes AI moves as inputs, demonstrating bidirectional widget communication.",
    categories: ["Featured", "Reactive"],
    size: "large",
    gifUrl: "/gif/tic-tac-toe.gif",
    dataFiles: [
      { url: "/testdata/X_moves.csv", varName: "x_moves_df", type: "csv" },
      { url: "/testdata/O_moves.csv", varName: "o_moves_df", type: "csv" },
    ],
    requiresDataForPreview: false,
    notebookId: "tictactoe",
  },
  {
    id: "weather-scatter",
    label: "Weather Scatter Plot",
    prompt: "Brush-select temperature points to filter by weather condition",
    moduleUrl: SCATTER_URL,
    description:
      "Interactive scatter plot showing Seattle weather data. Brush-select points to see selected weather patterns exported to linked widgets.",
    categories: ["Data Visualization", "Reactive", "Featured"],
    size: "medium",
    gifUrl: "",
    dataFiles: [{ url: "/testdata/seattle-weather.csv", varName: "data", type: "csv" }],
    requiresDataForPreview: true,
    notebookId: "cross-widget",
  },
  {
    id: "weather-bars",
    label: "Weather Bar Chart (Linked)",
    prompt: "Bar chart filtered by scatter plot selection",
    moduleUrl: BARS_URL,
    description:
      "Bar chart showing weather condition counts. Automatically updates based on scatter plot selections, demonstrating reactive data flow.",
    categories: ["Data Visualization", "Reactive", "Featured"],
    size: "large",
    gifUrl: "",
    dataFiles: [{ url: "/testdata/seattle-weather.csv", varName: "data", type: "csv" }],
    requiresDataForPreview: true,
    notebookId: "cross-widget",
  },
  {
    id: "solar-system",
    label: "3D Solar System",
    prompt: "3D solar system using Three.js showing planets orbiting the sun",
    moduleUrl: SOLAR_SYSTEM_URL,
    description:
      "Extract planet data from a PDF and visualize it as an interactive 3D solar system. Click on planets to select them!",
    categories: ["Featured", "3D"],
    size: "small",
    gifUrl: "",
    dataFiles: [{ url: "/testdata/planets.csv", varName: "planets_df", type: "csv" }],
    requiresDataForPreview: true,
    notebookId: "pdf-web",
  },
  {
    id: "hn-clone",
    label: "Hacker News Clone",
    prompt: "Create an interactive Hacker News clone widget",
    moduleUrl: HN_CLONE_URL,
    description:
      "Scrape Hacker News stories and display them in an interactive interface. Filter by score, search by keywords, and sort by different criteria!",
    categories: ["Data Visualization"],
    size: "medium",
    gifUrl: "",
    dataFiles: [{ url: "/testdata/hn_stories.json", varName: "hn_df", type: "json" }],
    requiresDataForPreview: true,
    notebookId: "pdf-web",
  },
  {
    id: "covid-trends",
    label: "COVID-19 Trends",
    prompt: "Line chart showing Confirmed, Deaths, and Recovered cases over time",
    moduleUrl: COVID_TRENDS_2_URL,
    description:
      "Visualize COVID-19 pandemic trends with an interactive line chart showing confirmed cases, deaths, and recoveries over time.",
    categories: ["Data Visualization"],
    size: "medium",
    gifUrl: "",
    dataFiles: [{ url: "/testdata/day_wise.csv", varName: "covid_df", type: "csv" }],
    requiresDataForPreview: true,
    notebookId: "edit",
  },
  {
    id: "mnist-recognition",
    label: "MNIST Digit Recognition",
    prompt: "Draw digits on canvas with real-time ML predictions",
    moduleUrl: MNIST_RECOG_URL,
    description:
      "Interactive canvas for drawing digits with live predictions from a pre-trained TensorFlow model. See real-time accuracy scores for each digit class with cross-widget communication.",
    categories: ["Featured", "Reactive"],
    size: "large",
    gifUrl: "/gif/mnist_recog.gif",
    dataFiles: [],
    requiresDataForPreview: false,
  },
  {
    id: "chi25-papers",
    label: "CHI Papers Explorer",
    prompt: "Query-driven semantic search through CHI 2025 papers with interactive visualization",
    moduleUrl: CHI25_EMBEDDING_URL,
    description:
      "Explore CHI 2025 papers using semantic search with animated wave visualization. Type queries to find similar papers with real-time similarity-based highlighting and interactive node exploration.",
    categories: ["Featured", "Data Visualization", "Reactive"],
    size: "large",
    gifUrl: "/gif/chi25embedding.gif",
    dataFiles: [{ url: "/testdata/chi25_papers.csv", varName: "chi25_df", type: "csv" }],
    requiresDataForPreview: true,
  },
];
