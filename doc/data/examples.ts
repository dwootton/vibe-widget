const TICTACTOE_URL = new URL('../widgets/interactive_tic_tac_toe_game_board_follo__ef3388891e__v1.js', import.meta.url).href;
const SCATTER_URL = new URL('../widgets/temperature_across_days_seattle_colored__1e5a77bc87__v1.js', import.meta.url).href;
const BARS_URL = new URL('../widgets/horizontal_bar_chart_weather_conditions__b7796577c1__v2.js', import.meta.url).href;
const SOLAR_SYSTEM_URL = new URL('../widgets/3d_solar_system_using_three_js_showing_p__0ef429f27d__v1.js', import.meta.url).href;
const HN_CLONE_URL = new URL('../widgets/create_interactive_hacker_news_clone_wid__d763f3d4a1__v2.js', import.meta.url).href;
const COVID_TRENDS_URL = new URL('../widgets/line_chart_showing_confirmed_deaths_reco__be99ed8976__v1.js', import.meta.url).href;
const COVID_TRENDS_2_URL = new URL('../widgets/add_vertical_dashed_line_user_hovering_d__9899268ecc__v1.js', import.meta.url).href;

export type Category = 'Featured' | 'Data Visualization' | 'Reactive' | '3D Simulation';

export const EXAMPLES = [
  {
    id: 'tic-tac-toe',
    label: 'Interactive Tic-Tac-Toe Game',
    prompt: "Interactive game board with AI opponent using ML model",
    moduleUrl: TICTACTOE_URL,
    description: 'Play tic-tac-toe against an AI trained on game patterns. The widget exports board state and imports AI moves, demonstrating bidirectional widget communication.',
    categories: ['Featured', 'Reactive'] as Category[],
    size: 'large' as const,
    gifUrl: '/gif/tic-tac-toe.gif',
  },
  {
    id: 'weather-scatter',
    label: 'Weather Scatter Plot',
    prompt: "Brush-select temperature points to filter by weather condition",
    moduleUrl: SCATTER_URL,
    description: 'Interactive scatter plot showing Seattle weather data. Brush-select points to see selected weather patterns exported to linked widgets.',
    categories: ['Data Visualization', 'Reactive', 'Featured'] as Category[],
    size: 'medium' as const,
    gifUrl: '',
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
    gifUrl: '',
    dataUrl: '/testdata/seattle-weather.csv',
    dataType: 'csv' as const,
  },
  {
    id: 'solar-system',
    label: '3D Solar System',
    prompt: "3D solar system using Three.js showing planets orbiting the sun",
    moduleUrl: SOLAR_SYSTEM_URL,
    description: 'Extract planet data from a PDF and visualize it as an interactive 3D solar system. Click on planets to select them!',
    categories: ['Featured', '3D Simulation'] as Category[],
    size: 'small' as const,
    gifUrl: '',
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
    gifUrl: '',
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
    gifUrl: '',
    dataUrl: '/testdata/day_wise.csv',
    dataType: 'csv' as const,
  },
];
