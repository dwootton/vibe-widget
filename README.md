# Vibe Widget

![Python Version](https://img.shields.io/badge/python-3.9%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Provider](https://img.shields.io/badge/LLM-OpenRouter-blueviolet)
![PyPI - Version](https://img.shields.io/pypi/v/vibe-widget)
![PyPI - Downloads](https://img.shields.io/pypi/dm/vibe-widget)



## What is Vibe Widget?
```python
                                                                                               
                                                                                               
                                ...::-==+**######*++=-::...                                    
                            ..:-+*###*###################*+=:..                                
                         ..-******#########*****###############=..                             
                      ..-*********                       #########=:.                          
                   ..-+******#                               #######*-..                       
                 ..-****                                           ####=.                      
                .:*#**  ##**                                 ####    %###-.                    
               .+***   ##****#                             #######     ###*:.                  
             .-***    ##*****###                         ##########      ##%+.                 
            .=*#*     ##*#########                     ############%      %%%*:.               
           .+**#     ###############                 *##############       %%#*:.              
         ..+***     ################################################%       %#%#:.             
         .+#**      ###############################################%%        %%%#:.            
        .-*##      ##########################################%##%%%%%%        %%%+.            
       .:*#*       ########################################%%%%%%%%%%%         %%#-.           
       .=#*    #### ######################################%%%%%%%%%%%# %%%%%    %%*.           
    ..:=**##*##########################################%%%%%%%%%%%%%%# %%%%%%%%%%%%+-.         
  ..=******##*########################################%%%%%%%%%%%%%%%% %%%%%%%%%%%%%%%=.       
 .:**##****###=:+#################################%%%%%%%%%%%%%%%%%%%% %%%%% %%%%%%%%%%%:.     
.:+*:*######*==+*###############################%#%%%%%%%%%%%%%%%%%%%% %%%%%%%%%   %% %%#-.    
.=**:*#*--*+-*=:################*--*###########%%%%%%%#=-*%%%%%%%%%%%% %%%% %%%%%%%%%%%%%*.    
.+#*:+-=*****+:.*##############=....-########%%%%%%%%#....-#%%%%%%%%%% %%%%% %%%  %%%%%%%#:    
.+#*:*++=.+-.+++*##############=....=######%%%%%%%%%%#....-#%%%%%%%%%% %%%%%%%%%%%%%%%%%%#:.   
.=#*:=.==.+-+=+**-*##############++*##%%%%*...-#%%%%%%#*+*%%%%%%%%%%%% %%%%%%%%%%%% %%#%%*.    
 :**:++++++++=###+=######################%#-..=%%#%%%%%%%%%%%%%%%%%%%% %%%%% #%%%%%%  #%#-.    
 .:*#########=-=-:+####################--#%+.:#%+.*%%%%%%%%%%%%%%%%%%% %%%%%#%%%%%%%%%%%-.     
   .=#########*###=.+################%%#+..-**..=#%%%%%%%%%%%%%%%%%%%% %%%%%%%%%%%%%%%+.       
     .-*############%############%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%%%% %%%%%##=..        
       ..-##   #### ###########%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%%%%   #%+..           
        .:*## %   ##########%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%   %% %%%-.            
         .-###%###########%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%*.             
          .+## ##########%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%#.              
          ..+## %######%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%#:.              
            .+## %%#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%#-.               
             .+### %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#:.                
              .-### %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% #%%*..                 
                :*%%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%  %%#-.                   
                 .-#%%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% #%%+.                     
                   .-#%%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% #%%%+:                       
                     .:#%%%   %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%  %%%%=..                        
                       .:=#%%%%  %%%%%%%%%%%%%%%%%%%%%%%%%  %%%%%*-..                          
                          ..-*%%%%%%   %%%%%%%%%%%%%   %%%%%%%=:..                             
                              ..:*#%%%%%%%%%%%%%%%%%%%%%%#=...                                 
                                  ....:=+++******++=-:....                                     
                                         ..  .                                                 
           %%%                                    %%                                           
           %%%%%%%%                              %%%%      %%%%                     %%%        
  %%    %%  %% %%%%%%%      %%%    %%    %    %%  %%    %%%%%%%   %%%  %%    %%%   %%%%%%      
 %%%%  %%%%%%% %%%%%%%%%  %%%%%%%%%%%% %%%%  %%%%%%%% %%%%%%%%% %%%%%%%%%  %%%%%%%%%%%%%%%     
  %%%%%%%% %%% %%%%  %%%%%%%%%%%%% %%% %%%%% %%% %%%% %%%  %%%% %%%   %%% %%%%%%%%% %%%%       
   %%%%%%  %%% %%%%  %%%%%%%%%%%%% %%%%%%%%%%%%  %%%% %%%  %%%% %%%% %%%% %%%%%%%%% %%%%       
    %%%%   %%% %%%%%%%%%  %%%%%%%%  %%%%% %%%%   %%%% %%%%%%%%%  %%%%%%%%  %%%%%%%% %%%%%%%    
     %%     %   %% %%%      %%%%      %%   %%     %%    %%% %%   %%  %%%%    %%%%     %%%%     
                                                                %%%%%%%%                       
                                                                                               
                                                                                               
```
yep

---

## Why Vibe Widget?

**→ Speak Human, Get Code**
Describe your viz in plain English. The AI writes production-ready React. You get interactive widgets. Everyone's happy.

**→ Widgets That Talk to Each Other**  
Select points in one chart → instantly updates another. Paint terrain → watch it render in 3D. It's like your visualizations are texting each other.

**Universal Data Support**  
Works with DataFrames, CSV, JSON, NetCDF, XML, PDF tables, ISF seismic data, web pages, and more. Intelligent data loading handles format detection and preprocessing automatically.

**Widget Composition**  
Create interactive dashboards where widgets communicate through a simple output/input system. Select data in one chart and watch others update instantly.

**Highly Customizable**  
Not limited to standard charts. Generate 3D visualizations, interactive games, custom UI components, or anything React can render.

**Smart Caching**  
Generated widgets are automatically cached. Same description and data structure loads instantly from disk without regenerating.

**Model Defaults That Make Sense**  
Uses OpenRouter with the fast default `google/gemini-3-flash-preview`; override via `vw.config(model=\"...\")`.

---

## Installation

```bash
pip install vibe-widget
```

Set your OpenRouter API key:

```bash
export OPENROUTER_API_KEY='your-key'
```

---

## Quick Start

```python
import pandas as pd
import vibe_widget as vw

# Load your data
df = pd.read_csv('sales_data.csv')

# Create a visualization with natural language
widget = vw.create(
    "bar chart of sales by region, sorted high to low, with tooltips",
    df
)
```

That's it. The AI analyzes your data, generates React code, validates it, and renders an interactive widget.

### Configuration

```python
vw.config(mode="premium", model="openrouter")
# or
vw.config(model="openai/gpt-5.1-codex")
vw.config(model="anthropic/claude-opus-4.5")

# View available models
vw.models()
```

---

## Theming

See the theming API and the built-in theme library in `THEMING.md`.

---

## Examples

### Basic Visualizations

```python
df = pd.DataFrame({
    'planet': ['Mercury', 'Venus', 'Earth', 'Mars'],
    'distance': [0.39, 0.72, 1.0, 1.52],
    'mass': [0.055, 0.815, 1.0, 0.107]
})

widget = vw.create(
    "3D scatter plot: distance vs mass, size by mass, with rotation controls",
    df
)
```

### Web Scraping

```python
widget = vw.create(
    "show Hacker News stories as cards with sorting by score",
    "https://news.ycombinator.com"
)
```

### PDF Extraction

```python
widget = vw.create(
    "extract tables from PDF and display as interactive sortable table",
    "report.pdf"
)
```

### Climate Data (NetCDF)

```python
widget = vw.create(
    "heatmap of sea surface temperatures with zoom controls",
    "ocean_data.nc"
)
```

### Linked Widgets

Create dashboards where widgets communicate:

```python
# Widget 1: Scatter with brush selection
scatter = vw.create(
    "scatter plot with brush selection tool",
    df,
    vw.outputs(selected_indices="indices of selected points")
)

# Widget 2: Histogram that reacts to selection
histogram = vw.create(
    "histogram with highlighted bars for selected data",
    vw.inputs(df, selected_indices=scatter.outputs.selected_indices),
)
```

Each output is exposed as a callable handle (e.g., `scatter.outputs.selected_indices()`) that can be passed into `vw.inputs` for other widgets. When you select points in the scatter plot, the histogram automatically highlights corresponding data.

### Iterative Refinement

```python
# Create initial widget
v1 = vw.create("basic scatter plot", df)

# Refine it
v2 = v1.revise("add color by category")

# Refine further
v3 = v2.revise("make points larger and add tooltips")
```

More examples available in [`examples/`](examples/) directory.

---

## API Reference

### `create()`

Create a new widget from scratch.

```python
widget = vw.create(
    description: str,           # Natural language description
    data=None,                  # DataFrame, file path, URL, or None
    outputs=None,               # Dict of {trait_name: description}
    inputs=None,                # Dict of {trait_name: source_widget}
    config=None                 # Config object (optional)
)
```

**Parameters:**

- `description`: Natural language description of your visualization
  - Be specific: "3D scatter with rotation" beats "show the data"
  - Mention interactions: "with hover tooltips", "clickable legend"
  - Include styling: "dark theme", "sorted by value", "highlight outliers"

- `data`: Your data source
  - `pd.DataFrame`: Direct DataFrame
  - `str` or `Path`: File path (CSV, JSON, NetCDF, XML, PDF, etc.)
  - `str` (URL): Web page to scrape
  - `None`: For widgets driven purely by inputs

- `outputs`: State this widget shares with others
  - Use `vw.outputs(selected_indices="indices of selected data points")`
  - Positional shorthand works too: `vw.create("...", df, vw.outputs(...))`
  - Output definitions require named parameters

- `inputs`: State this widget receives from others
  - Use `vw.inputs(df, selected_indices=scatter.outputs.selected_indices)` to bundle data with inputs
  - Positional arguments are allowed in `vw.inputs(...)` and will infer names when possible

### `widget.revise()`

Build upon an existing widget instance.

```python
widget = existing_widget.revise(
    description: str,           # Description of changes
    data=None,                  # Optional new data
    outputs=None,
    inputs=None,
    config=None
)
```

### `config()`

Configure global settings.

```python
vw.config(
    model="anthropic",          # Default model
    mode="standard",            # "standard" or "premium"
    api_key=None               # Optional API key override
)
```

### `models()`

View available models.

```python
vw.models()                    # Show defaults and pinned models
vw.models(show="all")          # Show all available models
vw.models(verbose=False)       # Quiet mode
```

---

## How It Works

```
Natural Language → Data Processing → AI Code Generation → Validation → Caching → Interactive Widget
```

**Architecture:**

- **Core Module** (`core.py`): Main VibeWidget class and `create()` function
- **Data Loading** (`data_tools.py`): Universal data loader supporting 15+ formats
- **Agentic Orchestration** (`agentic.py`): Coordinates LLM code generation and validation
- **LLM Provider** (`providers/openrouter_provider.py`): OpenRouter-only gateway with pinned defaults
- **Validation Tools** (`code_tools.py`): Syntax checking and code validation
- **Widget Store** (`widget_store.py`): Smart caching and version management
- **Code Parser** (`code_parser.py`): Stream parsing for real-time generation feedback

**Key Features:**

- **Smart Data Handling**: Auto-detects formats, handles large datasets via sampling
- **Code Generation**: LLM generates React components with validation and auto-repair
- **Widget Communication**: Output/input system for reactive dashboards
- **Caching**: Hash-based caching prevents redundant generation
- **Error Recovery**: Automatic error detection and fixing for runtime issues

---

## Example Notebooks

- [`examples/cross_widget_interactions.ipynb`](examples/cross_widget_interactions.ipynb) - Interactive dashboards with linked widgets
- [`examples/pdf_and_web_extraction.ipynb`](examples/pdf_and_web_extraction.ipynb) - PDF tables and web scraping
- [`examples/revise_example.ipynb`](examples/revise_example.ipynb) - Iterative widget refinement
- [`tests/test_agentic_demo.ipynb`](tests/test_agentic_demo.ipynb) - Comprehensive test suite

---

## Contributing

Contributions welcome! To get started:

```bash
git clone https://github.com/dwootton/vibe-widget.git
cd vibe-widget
pip install -e ".[dev]"
pytest
```

---

## License

MIT License - see [LICENSE](LICENSE) for details

---

## Acknowledgments

Built with:
- [OpenRouter](https://openrouter.ai/) models (defaults to Google Gemini Flash Preview)
- [anywidget](https://anywidget.dev/) & [ipywidgets](https://ipywidgets.readthedocs.io/)
- [Traitlets](https://traitlets.readthedocs.io/) for state management
- [Crawl4AI](https://github.com/unclecode/crawl4ai) for web scraping
- [Camelot](https://camelot-py.readthedocs.io/) for PDF extraction

---

**[Documentation](https://vibewidget.dev) | [GitHub](https://github.com/dwootton/vibe-widget) | [Report Issues](https://github.com/dwootton/vibe-widget/issues)**
