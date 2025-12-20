"""Theme resolution, persistence, and composition for Vibe Widgets."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable
import json
import textwrap

from vibe_widget.config import get_global_config
from vibe_widget.llm.providers.openrouter_provider import OpenRouterProvider


_THEMES_DIR = Path.home() / ".vibewidgets" / "themes"
_SESSION_CACHE: dict[str, "Theme"] = {}
_PROVIDER: OpenRouterProvider | None = None


def _t(text: str) -> str:
    return textwrap.dedent(text).strip()


THEME_GENERATION_PROMPT = _t(
    """
    You are generating a theme description for interactive data visualization widgets. These widgets appear in computational notebooks, dashboards, and documents.

    Given the user's request, write a detailed theme description that another AI can use to style widgets consistently. Your output should be a rich, specific prompt -- not code or JSON, but precise natural language that leaves no ambiguity about the visual intent.

    Cover each of these dimensions. High contrast is required for all themes; ensure text and data marks meet WCAG AA contrast against their backgrounds.

    ## Environment & Ground

    Describe the backdrop. Is this a dark interface or light? Warm or cool? What's the overall feeling -- technical, editorial, playful, corporate, minimal? Describe the background color in evocative but specific terms (not just "dark" but "deep charcoal with a subtle blue undertone" or "warm off-white like aged paper").

    Describe secondary surfaces -- cards, containers, nested elements. How do they differentiate from the ground?

    ## Typography

    Describe the typographic personality. Is it sharp and technical? Warm and humanist? Classic and editorial?

    Specify a Google Font (or web-safe fallback) for body text and one for monospace/data. Describe the weight, the size feeling (compact? airy?), the overall texture of text on the page.

    ## Color System

    ### Accent & Interactive
    Describe the primary accent color -- what draws the eye, what signals interactivity. Be specific: not "blue" but "a saturated cobalt" or "muted teal that recedes slightly."

    ### Semantic Colors
    Describe how success, warning, error, and info states should feel. Do they pop aggressively or integrate subtly? What hues?

    ### Data Encoding
    This is critical. Describe:
    - **Categorical palette**: For unordered categories. How many colors? What's the hue range? Are they saturated or muted? Do they feel playful or serious? Should they be colorblind-safe?
    - **Sequential palette**: For ordered continuous data. What hue? How does it progress from low to high -- light to dark? Muted to saturated?
    - **Diverging palette**: For data with a meaningful center. What two hues diverge from the neutral middle?

    ## Chart Elements

    Describe axes and grids. Are axes prominent or receding? What color, what weight? Are there gridlines? If so, are they subtle dotted lines or more structural? Should the chart frame assert itself or disappear?

    ## Interaction Feel

    Describe how interactions should feel. Snappy and immediate? Smooth and relaxed? What happens on hover -- opacity shift? Subtle scale? Color change? How visible should focus rings be for keyboard navigation?

    ## Component Styling

    Describe tooltips: their background, their contrast with content, their border treatment, whether they feel like floating cards or integrated callouts.

    Describe default mark opacity for data points -- should overlapping points build up to show density, or should each point be fully opaque?

    ---

    Write the theme as a cohesive description, not a bulleted checklist. It should read like a design specification that captures both the concrete details and the overall gestalt. Someone reading it should be able to visualize the theme and apply it consistently. High contrast is mandatory.

    Begin with a one-sentence summary that captures the theme's essence, then elaborate on each dimension.
    """
)

THEME_MODIFICATION_PROMPT = _t(
    """
    You are modifying an existing theme based on the user's request.

    ## Base Theme
    {base_theme_description}

    ## User's Request
    "{user_prompt}"

    Write a new theme description that:
    1. Preserves the base theme's overall character and coherence
    2. Applies the user's requested modifications
    3. Maintains internal consistency -- if you warm the background, warm the grays and adjust the palette to match
    4. Keeps the same level of detail and specificity as the base theme
    5. Maintains high contrast (WCAG AA) across text and data marks

    Output a complete theme description in the same format, not just the changes.
    """
)

THEME_COMPOSITION_PROMPT = _t(
    """
    You are combining multiple themes into a coherent whole.

    ## Base Themes (in order, later overrides earlier)
    {theme_descriptions}

    Write a new theme description that synthesizes these inputs. Later themes in the list should override earlier ones where they conflict, but the result should feel coherent -- not a mechanical merge but a thoughtful integration. Ensure high contrast (WCAG AA) throughout.

    If themes conflict in mood or intent, favor the later theme's character while preserving useful specifics from earlier themes where they do not clash.
    """
)


@dataclass(frozen=True)
class Theme:
    description: str
    name: str | None = None
    prompt: str | None = None

    def save(self, name: str) -> "Theme":
        """Persist this theme and return the saved theme."""
        if not name or not name.strip():
            raise ValueError("Theme name is required.")
        normalized = _normalize_name(name)
        payload = {"name": normalized, "description": self.description, "prompt": self.prompt or ""}
        _THEMES_DIR.mkdir(parents=True, exist_ok=True)
        path = _THEMES_DIR / f"{normalized}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        saved = Theme(description=self.description, name=normalized, prompt=self.prompt)
        ThemeRegistry().register(saved)
        return saved

    def ensure_accessible(self) -> "Theme":
        """Request WCAG-friendly contrast adjustments."""
        return ThemeRegistry().modify(self, "ensure WCAG AA contrast compliance")

    @property
    def summary(self) -> str:
        parts = [p.strip() for p in self.description.split(".") if p.strip()]
        return parts[0] + "." if parts else self.description.strip()


class ThemesCatalog(dict):
    """Dict-like return type with a concise notebook-friendly repr."""

    def __repr__(self) -> str:  # pragma: no cover
        if not self:
            return "ThemesCatalog({})"
        lines = [f"{name:<15} -- {desc}" for name, desc in sorted(self.items())]
        return "\n".join(lines)

    def __str__(self) -> str:  # pragma: no cover
        return self.__repr__()


class ThemeRegistry:
    """Registry for built-in, saved, and session themes."""

    _instance: "ThemeRegistry | None" = None

    def __new__(cls) -> "ThemeRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._themes = {}
            cls._instance._load_builtins()
            cls._instance._load_saved()
        return cls._instance

    def _load_builtins(self) -> None:
        for name, theme in _BUILTIN_THEMES.items():
            self._themes[_normalize_name(name)] = theme

    def _load_saved(self) -> None:
        if not _THEMES_DIR.exists():
            return
        for path in _THEMES_DIR.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                description = payload.get("description", "").strip()
                name = payload.get("name", path.stem)
                prompt = payload.get("prompt") or ""
                if description:
                    self._themes[_normalize_name(name)] = Theme(description=description, name=_normalize_name(name), prompt=prompt)
            except Exception:
                continue

    def register(self, theme: Theme) -> None:
        if theme.name:
            self._themes[_normalize_name(theme.name)] = theme

    def list(self) -> ThemesCatalog:
        return ThemesCatalog(
            {(theme.name or name): theme.summary for name, theme in self._themes.items()}
        )

    def get(self, name: str) -> Theme | None:
        return self._themes.get(_normalize_name(name))

    def resolve(self, value: str | Theme, provider: OpenRouterProvider | None = None) -> Theme:
        if isinstance(value, Theme):
            return value
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Theme prompt must be a non-empty string.")

        prompt = value.strip()
        prompt_key = _prompt_hash(prompt)
        if prompt_key in _SESSION_CACHE:
            return _SESSION_CACHE[prompt_key]

        direct = self._resolve_direct(prompt)
        if direct:
            _SESSION_CACHE[prompt_key] = direct
            return direct

        base_theme = self._find_base_theme(prompt)
        if base_theme:
            modified = self.modify(base_theme, prompt, provider=provider)
            _SESSION_CACHE[prompt_key] = modified
            return modified

        generated = self.generate(prompt, provider=provider)
        _SESSION_CACHE[prompt_key] = generated
        return generated

    def compose(self, themes: Iterable[Theme], provider: OpenRouterProvider | None = None) -> Theme:
        theme_list = list(themes)
        if not theme_list:
            raise ValueError("At least one theme is required to compose.")
        if len(theme_list) == 1:
            return theme_list[0]

        descriptions = "\n\n".join(
            f"{idx + 1}. {theme.description}" for idx, theme in enumerate(theme_list)
        )
        prompt = THEME_COMPOSITION_PROMPT.format(theme_descriptions=descriptions)
        description = _generate_text(prompt, provider=provider)
        return Theme(description=description, prompt="composition")

    def modify(self, base_theme: Theme, user_prompt: str, provider: OpenRouterProvider | None = None) -> Theme:
        prompt = THEME_MODIFICATION_PROMPT.format(
            base_theme_description=base_theme.description,
            user_prompt=user_prompt,
        )
        description = _generate_text(prompt, provider=provider)
        return Theme(description=description, prompt=user_prompt)

    def generate(self, user_prompt: str, provider: OpenRouterProvider | None = None) -> Theme:
        prompt = f"{THEME_GENERATION_PROMPT}\n\nUser request: {user_prompt}"
        description = _generate_text(prompt, provider=provider)
        return Theme(description=description, prompt=user_prompt)

    def _resolve_direct(self, prompt: str) -> Theme | None:
        normalized = _normalize_name(prompt)
        if normalized in self._themes:
            return self._themes[normalized]
        for name, theme in self._themes.items():
            if normalized == _normalize_name(name.replace("_", " ")):
                return theme
        return None

    def _find_base_theme(self, prompt: str) -> Theme | None:
        lowered = prompt.lower()
        for name, theme in self._themes.items():
            name_tokens = name.replace("_", " ")
            if name_tokens in lowered:
                return theme
        return None


def theme(*args: Any) -> Theme:
    """Resolve or compose themes."""
    if not args:
        raise ValueError("vw.theme requires at least one argument.")
    registry = ThemeRegistry()
    if len(args) == 1:
        return registry.resolve(args[0])
    resolved = [registry.resolve(arg) for arg in args]
    return registry.compose(resolved)


def themes() -> ThemesCatalog:
    return ThemeRegistry().list()


def resolve_theme_for_request(
    value: str | Theme | None,
    model: str | None = None,
    api_key: str | None = None,
) -> Theme | None:
    if value is None:
        config = get_global_config()
        value = getattr(config, "theme", None)
    if value is None:
        return None
    provider = _get_provider(model=model, api_key=api_key) if (model or api_key) else None
    return ThemeRegistry().resolve(value, provider=provider)


def _prompt_hash(prompt: str) -> str:
    return sha256(prompt.strip().encode()).hexdigest()


def _normalize_name(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def _get_provider(model: str | None = None, api_key: str | None = None) -> OpenRouterProvider:
    global _PROVIDER
    if model or api_key:
        config = get_global_config()
        resolved_model = model or config.model
        resolved_key = api_key or config.api_key
        return OpenRouterProvider(resolved_model, resolved_key)
    if _PROVIDER is None:
        config = get_global_config()
        _PROVIDER = OpenRouterProvider(config.model, config.api_key)
    return _PROVIDER


def _generate_text(
    prompt: str,
    provider: OpenRouterProvider | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> str:
    active_provider = provider or _get_provider(model=model, api_key=api_key)
    return active_provider.generate_text(prompt).strip()


_BUILTIN_THEMES = {
    "dark": Theme(
        name="dark",
        description=_t(
            """
            A low-contrast dark theme for extended viewing with deep charcoal surfaces, soft gray typography, and muted accents.
            The background is a near-black graphite, secondary surfaces lift slightly with cool gray panels, and gridlines are faint and restrained.
            Use a clean sans serif for labels and a sturdy monospace for data annotations. Interactions are subtle and minimal-glare.
            """
        ),
        prompt="dark",
    ),
    "light": Theme(
        name="light",
        description=_t(
            """
            A clean light theme with neutral grays, minimal chrome, and high clarity for embedded dashboards.
            The background is crisp white, secondary panels are light gray, and typography is modern and legible.
            Accents are restrained and data palettes are balanced for accessibility.
            """
        ),
        prompt="light",
    ),
    "high-contrast": Theme(
        name="high-contrast",
        description=_t(
            """
            A maximum-contrast accessibility-first theme with black text, stark axes, and bold categorical colors.
            The background is pure white, gridlines are minimal, and interactive states use thick outlines for clarity.
            """
        ),
        prompt="high-contrast",
    ),
    "minimal": Theme(
        name="minimal",
        description=_t(
            """
            A stripped-down minimal theme that recedes behind the data, using soft neutrals, thin rules, and sparse labeling.
            Gridlines are faint or removed, axes are subtle, and typography is quiet and compact.
            """
        ),
        prompt="minimal",
    ),
    "financial_times": Theme(
        name="financial_times",
        description=_t(
            """
            A sophisticated, financial editorial theme defined by its iconic 'Bisque' or salmon-pink background (#fff1e5).

            ## Environment & Ground
            The backdrop is the signature soft pink, creating a warm, paper-like reading environment.
            Secondary surfaces (tooltips, cards) use a deep slate or 'oxford blue' to create sharp, authoritative contrast.

            ## Typography
            The typographic personality is traditional yet urgent. Use a crisp, high-contrast Serif like 'Merriweather' or 'Playfair Display'
            for titles to evoke the 'Financier' typeface. For data labels and axes, switch to a clean, geometric Sans-Serif like 'Inter'
            to ensure legibility at small sizes.

            ## Color System
            - **Accent**: A sharp cyan or claret red used sparingly to highlight current values.
            - **Data Encoding**: Use a categorical palette that contrasts well with pink: slate blue, deep teal, and muted terracotta.
              Avoid yellows that get lost on the background.
            - **Semantic**: Positive/Negative values often use a specific 'financial' green and red, slightly desaturated to match the paper tone.

            ## Chart Elements
            Gridlines are horizontal only, thin, and styled in a dotted 'slate-400' tone. The chart frame is invisible;
            the data sits directly on the page. Axes are minimal.

            ## Interaction Feel
            Professional and crisp. Tooltips should snap into place with zero latency, styled as dark slate rectangles with white text.
            """
        ),
        prompt="financial_times",
    ),
    "nyt_upshot": Theme(
        name="nyt_upshot",
        description=_t(
            """
            The 'Upshot' data journalism style: minimalist, spacious, and obsessed with clarity.

            ## Environment & Ground
            Stark white background. No noise, no texture. The focus is entirely on the signal.

            ## Typography
            Type is classic and authoritative. Use 'Franklin Gothic' or 'Libre Franklin' for headers--strong, condensed, and assertive.
            Body and data text should be a highly readable serif like 'Georgia' or 'Noto Serif' for that 'newspaper of record' feel.

            ## Color System
            - **Data Encoding**: A distinctive, high-contrast categorical palette utilizing 'Upshot Red' (#aa1228), deep blues, and neutral grays.
            - **Sequential**: Monochromatic scales often use shades of purple or blue.
            - **Accent**: Black is used heavily for emphasis.

            ## Chart Elements
            Extremely thin, precise lines. Axis ticks are often removed in favor of direct labeling on the data points.
            Gridlines are extremely faint gray or removed entirely. The distinctive 'NYT pointer' style for annotations is essential.

            ## Component Styling
            Tooltips are minimalist white cards with a subtle drop shadow and a thin gray border.
            """
        ),
        prompt="nyt_upshot",
    ),
    "economist": Theme(
        name="economist",
        description=_t(
            """
            The 'Graphic Detail' style: compact, dense, and instantly recognizable by the 'red label'.

            ## Environment & Ground
            A clean white background for the chart area, often capped by a distinctive thick blue-gray header bar containing the title.

            ## Typography
            The personality is witty and concise. Use 'Officina Sans' or a close alternative like 'Fira Sans' or 'Roboto Slab'.
            Text is often slightly condensed to fit more data into small columns.

            ## Color System
            - **Accent**: The signature 'Economist Red' (#E3120B) is the primary interactive color.
            - **Data Encoding**: A recognizable palette of cyan, dark blue, and muted brown.
            - **Sequential**: Distinctive 'blue-to-red' diverging scales for political or economic sentiment.

            ## Chart Elements
            The defining feature is the 'Red Rectangle' signature often found in the top-left or accompanying the title.
            Charts often place the y-axis grid lines *on top* of the bars/area fills to aid precision reading.

            ## Interaction Feel
            Efficient. Hover states should highlight the data point with a thick red stroke.
            """
        ),
        prompt="economist",
    ),
    "the_guardian": Theme(
        name="the_guardian",
        description=_t(
            """
            A vibrant, modern editorial style that blends bold typography with a high-contrast palette.

            ## Environment & Ground
            A very light cool gray or pure white background. It feels airy and open.

            ## Typography
            Headline typography is the star. Use 'Garnett' or a similar distinct, slightly quirky sans-serif (like 'Work Sans' or 'Libre Franklin')
            in a bold weight. It should feel opinionated and contemporary.

            ## Color System
            - **Data Encoding**: A vibrant, almost primary palette: Guardian Red, Egyptian Blue, and a sunny Yellow.
              These colors are saturated and pop against the white ground.
            - **Semantic**: Success/Fail states use these same saturated brand colors rather than standard green/red.

            ## Chart Elements
            Circular elements (bubbles, dots) are common. Lines are thick and confident.
            Layouts often use asymmetric balance.

            ## Component Styling
            Tooltips are sharp-edged and use the signature deep blue background with white text.
            """
        ),
        prompt="the_guardian",
    ),
    "bloomberg": Theme(
        name="bloomberg",
        description=_t(
            """
            A 'Terminal' inspired, high-density aesthetic that screams financial intelligence.

            ## Environment & Ground
            Can be either stark white (print style) or deep charcoal (terminal style). Let's default to the modern 'Bloomberg Graphics'
            web style: White background with very high-contrast black elements.

            ## Typography
            Neo-grotesque and Swiss. Use 'Inter' or 'Helvetica Now'. Titles are bold, black, and tightly kerned.
            Data labels are small, uppercase, and monochromatic.

            ## Color System
            - **Data Encoding**: Often monochromatic or duotone (Black + Neon Blue or Black + Magenta).
              When multiple colors are needed, they are intense, digital-native hues.
            - **Accent**: Electric blue or hot pink.

            ## Chart Elements
            Thick, bold axis lines. Brutalist grid structures. The design feels engineered rather than drawn.

            ## Interaction Feel
            Snappy, technical, and precise. Crosshairs on hover are appropriate.
            """
        ),
        prompt="bloomberg",
    ),
    "fivethirtyeight": Theme(
        name="fivethirtyeight",
        description=_t(
            """
            The 'Fox' style: accessible statistics with a distinct personality.

            ## Environment & Ground
            A very light gray (#f0f0f0) background is the signature. It separates the graphics from the surrounding white page.

            ## Typography
            Use 'Decima Mono' or a similar geometric, slightly condensed typeface like 'Atlas Grotesk' or 'Roboto'.
            Titles are bold and uppercase.

            ## Color System
            - **Data Encoding**: The 'FiveThirtyEight' palette: bright orange, medium blue, and gray.
              These are distinctive and colorblind-safe.
            - **Accent**: A darker gray for text, never pure black.

            ## Chart Elements
            Gridlines are dark gray and clearly visible--charts look like they are sitting on graph paper.
            Use a thick black baseline (zero line).

            ## Component Styling
            Tooltips have a slight opacity and rounded corners, feeling friendly rather than technical.
            """
        ),
        prompt="fivethirtyeight",
    ),
    "the_pudding": Theme(
        name="the_pudding",
        description=_t(
            """
            Modern scrollytelling. Playful, bespoke, and narrative-driven.

            ## Environment & Ground
            Often off-white or cream (#fdfbf7) to evoke a high-quality magazine feel.
            The layout is fluid, treating the chart as a story element rather than a discrete box.

            ## Typography
            Highly eclectic. Often pairs a brutalist serif for titles (like 'Tiempos Headline' or 'Playfair')
            with a clean monospace for data (like 'Pitch' or 'Fira Code').

            ## Color System
            - **Data Encoding**: Uses sophisticated, atypical palettes--pastels mixed with deep inks.
              Gradients are used for aesthetic effect, not just encoding.

            ## Interaction Feel
            Smooth and cinematic. Transitions are slow and eased (duration ~800ms).
            Scrubbing interactions are preferred over simple clicks.
            """
        ),
        prompt="the_pudding",
    ),
    "reuters_graphics": Theme(
        name="reuters_graphics",
        description=_t(
            """
            Wire-service neutrality met with modern design principles.

            ## Environment & Ground
            Clean white. Unobtrusive. Designed to be embedded anywhere.

            ## Typography
            'Source Sans Pro' or similar open humanist sans-serifs. Highly legible, neutral, and global.

            ## Color System
            - **Data Encoding**: A palette of oranges, grays, and blues.
            - **Accent**: The Reuters Orange (#ff8000) is the primary interactive highlight.

            ## Chart Elements
            Clean, thin lines. Titles are descriptive and left-aligned.
            Source attribution is prominent but styled discreetly in gray.

            ## Component Styling
            No-nonsense tooltips. Just the data, fast.
            """
        ),
        prompt="reuters_graphics",
    ),
    "propublica": Theme(
        name="propublica",
        description=_t(
            """
            Investigative rigor. Serious, high-contrast, and accessible.

            ## Environment & Ground
            White background. Text is often very dark gray (#111) rather than pure black.

            ## Typography
            A pairing of a sturdy Serif (like 'Merriweather') for introductions and a clear Sans (like 'Franklin Gothic') for charts.

            ## Color System
            - **Data Encoding**: High-contrast, colorblind-safe palettes are mandatory.
            - **Semantic**: Dark, serious tones. Avoid frivolous brights.

            ## Chart Elements
            Annotations are heavily used--text explaining specific data points directly on the chart.
            Layouts prioritize the 'stepper' or small multiples format.
            """
        ),
        prompt="propublica",
    ),
    "our_world_in_data": Theme(
        name="our_world_in_data",
        description=_t(
            """
            The gold standard for accessibility and standardization.

            ## Environment & Ground
            White background. Charts are framed with a thin gray border, acting as self-contained cards.

            ## Typography
            'Playfair Display' for titles (giving a historic/academic feel) paired with 'Lato' for all data and labels.

            ## Color System
            - **Data Encoding**: A consistent, recognizable categorical palette: Blue, Red, Green, Yellow--but slightly desaturated to be easy on the eyes.
            - **Sequential**: Distinctive blue gradients.

            ## Chart Elements
            Discrete legends are avoided; direct labeling of lines/areas is preferred.
            A prominent footer always includes 'Source' and 'CC-BY' licensing.

            ## Interaction Feel
            Educational. Tooltips are comprehensive, often showing full sentences describing the data point.
            """
        ),
        prompt="our_world_in_data",
    ),
    "nature_journal": Theme(
        name="nature_journal",
        description=_t(
            """
            Scientific authority. Clean, dense, and print-ready.

            ## Environment & Ground
            Pure white background. Figures are designed to fit strictly within column widths.

            ## Typography
            'Harding' or a similar transitional serif for headers.
            Data is strictly sans-serif ('Arial' or 'Helvetica'), very neutral, allowing the science to speak.

            ## Color System
            - **Data Encoding**: The 'Nature' palette: rich, deep colors (teal, ochre, vermilion) that reproduce well in CMYK print.
            - **Sequential**: Viridis or Magma scales are preferred for heatmaps to ensure perceptual uniformity.

            ## Chart Elements
            Axes usually have ticks on the inside. Plot frames are often full boxes (borders on all 4 sides).
            Error bars are prominent and styled with 'cap' ends.
            """
        ),
        prompt="nature_journal",
    ),
    "cell_journal": Theme(
        name="cell_journal",
        description=_t(
            """
            The 'Graphical Abstract' style. Visual, schematic, and diagrammatic.

            ## Environment & Ground
            White background. Layouts often resemble flowcharts or distinct panels.

            ## Typography
            'Helvetica Neue' or 'Arial'. Bold weights are used for pathway nodes and emphasis.

            ## Color System
            - **Data Encoding**: Bright, distinct colors meant to distinguish biological components.
              Blues for nuclei, Reds for inhibition, Greens for activation.

            ## Chart Elements
            Thick, schematic lines. Arrows are a major design element.
            Charts are often integrated with iconic representations of cells or molecules.
            """
        ),
        prompt="cell_journal",
    ),
    "the_lancet": Theme(
        name="the_lancet",
        description=_t(
            """
            Medical precision. Minimalist and stark.

            ## Environment & Ground
            White.

            ## Typography
            A clean, humanist sans-serif like 'Frutiger' or 'Segoe UI'.
            Titles are understated.

            ## Color System
            - **Accent**: 'Lancet Orange' is the single dominant brand color used for key data lines.
            - **Secondary**: Grays and blacks.

            ## Chart Elements
            Kaplan-Meier survival curves are the archetype. Step-charts with confidence intervals shaded in light gray.
            """
        ),
        prompt="the_lancet",
    ),
    "arxiv_latex": Theme(
        name="arxiv_latex",
        description=_t(
            """
            The 'Computer Modern' aesthetic. Academic, raw, and mathematical.

            ## Environment & Ground
            White background, but the 'vibe' evokes the texture of a PDF viewer.

            ## Typography
            Strictly 'Latin Modern Roman' (Computer Modern).
            Italicized math variables ($x$, $y$) in axis labels are essential.

            ## Color System
            - **Data Encoding**: Often black and white (dashes vs solid lines) or the standard 'Matplotlib' default colors (Blue, Orange, Green).

            ## Chart Elements
            Boxed axes (ticks on all sides).
            Gridlines are usually absent unless it's a log-log plot.
            Legends are placed inside the plot area in a box with a white background.
            """
        ),
        prompt="arxiv_latex",
    ),
    "national_geographic": Theme(
        name="national_geographic",
        description=_t(
            """
            Cartographic excellence. Rich, textured, and photographic.

            ## Environment & Ground
            Can be white, but often uses subtle topographic textures or satellite imagery basemaps.
            The signature yellow border is a brand touchstone.

            ## Typography
            'Verlag' or 'Geograph'. Type is uppercase, tracked out (letter-spaced), and elegant.

            ## Color System
            - **Data Encoding**: Naturalistic palettes--earth tones for land, bathymetric blues for water.
              Data overlays use bright, contrasting hues like yellow or magenta to stand out against the map.

            ## Chart Elements
            Scale bars and north arrows are stylized.
            Line charts are smooth (spline interpolation) to mimic natural curves.
            """
        ),
        prompt="national_geographic",
    ),
    "usgs": Theme(
        name="usgs",
        description=_t(
            """
            Federal standard. Utilitarian, accessible, and rugged.

            ## Environment & Ground
            White or light tan.

            ## Typography
            'Univers' or 'Arial'. Highly legible, bureaucratic, and functional.

            ## Color System
            - **Data Encoding**: Standardized geologic map colors.
              Pastels for area fills, strong black lines for boundaries.

            ## Chart Elements
            Heavy use of pattern fills (hatches, dots) to distinguish categories without relying solely on color (accessibility).
            Strict adherence to federal plain language guidelines in tooltips.
            """
        ),
        prompt="usgs",
    ),
    "noaa_climate": Theme(
        name="noaa_climate",
        description=_t(
            """
            Climate communication. Blue-to-Red diverging scales are central.

            ## Environment & Ground
            Clean white or light blue tint.

            ## Typography
            'Merriweather' for context, 'Source Sans' for data.

            ## Color System
            - **Data Encoding**: The 'Warming Stripes' aesthetic.
              Deep blues transitioning to angry reds.
            - **Sequential**: Precipitation scales (White -> Green -> Blue).

            ## Interaction Feel
            Time-series focused. Scrubbing across years is a primary interaction.
            """
        ),
        prompt="noaa_climate",
    ),
    "mckinsey": Theme(
        name="mckinsey",
        description=_t(
            """
            Corporate insight. Clean, spacious, and executive-ready.

            ## Environment & Ground
            White background. Charts are often enclosed in a subtle light gray container.

            ## Typography
            'Bower' (Serif) for titles, 'McKinsey Sans' (or 'Arial') for data.
            Titles often take the form of an active sentence (e.g., "Profit grew by 10%...").

            ## Color System
            - **Data Encoding**: 'McKinsey Blue' (Deep Navy) is the primary color.
              Secondary colors are light blues and cool grays.
              Accent is often a teal or bright blue.

            ## Chart Elements
            Waterfall charts are the signature.
            Connectors between bars are thin and gray.
            Axis lines are removed; value labels sit directly on top of bars.
            """
        ),
        prompt="mckinsey",
    ),
    "us_census": Theme(
        name="us_census",
        description=_t(
            """
            Demographic authority. Neutral and population-focused.

            ## Environment & Ground
            White.

            ## Typography
            'Roboto' or 'Lato'. Modern, clean, and screen-optimized.

            ## Color System
            - **Data Encoding**: A palette of Blues and Oranges.
            - **Semantic**: Distinct reliance on choropleth map conventions (light-to-dark saturation).

            ## Chart Elements
            Population pyramids and age-distribution charts.
            Bar charts are often horizontal to accommodate long state/county names.
            """
        ),
        prompt="us_census",
    ),
    "who_health": Theme(
        name="who_health",
        description=_t(
            """
            Global health monitoring. Humanist, accessible, and blue-dominant.

            ## Environment & Ground
            White or very light gray.

            ## Typography
            'Arial' or 'Helvetica'. Neutrality is key.

            ## Color System
            - **Data Encoding**: 'WHO Blue' (UN Blue family).
              Orange is used for warnings/alerts.

            ## Chart Elements
            Donut charts for proportions.
            Simple line charts for epidemiological curves.
            Icons (people, hospitals) are often integrated into the visualization (ISOTYPE style).
            """
        ),
        prompt="who_health",
    ),
}
