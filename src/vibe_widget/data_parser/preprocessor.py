"""
Main preprocessor that orchestrates data profiling and LLM augmentation

Design philosophy:
- Extractors handle STRUCTURAL analysis only
- LLM handles ALL SEMANTIC interpretation
- Clean separation of concerns
"""
import hashlib
import json
from pathlib import Path
from typing import Any

from anthropic import Anthropic

from vibe_widget.data_parser.data_profile import DataProfile
from vibe_widget.data_parser.extractors import get_extractor


class DataPreprocessor:
    """
    Preprocesses data from various formats into unified profiles
    Uses LLM for ALL semantic understanding and augmentation
    Caches profiles to avoid regenerating them for the same files
    """
    
    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-5-20250929", cache_dir: str | Path | None = None):
        self.api_key = api_key
        self.model = model
        self.client = Anthropic(api_key=api_key) if api_key else None
        
        # Set up cache directory
        if cache_dir is None:
            # Default to .vibe_cache in the current working directory
            cache_dir = Path.cwd() / ".vibe_cache" / "profiles"
        else:
            cache_dir = Path(cache_dir)
        
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def process(
        self, 
        source: Any,
        augment_with_llm: bool = True,
        context: dict | None = None,
        use_cache: bool = True
    ) -> DataProfile:
        """
        Process data source into a unified profile
        
        Args:
            source: Data source (DataFrame, file path, API response, URL, etc.)
            augment_with_llm: Whether to use LLM to add semantic understanding
            context: Additional context about the data (user description, domain, etc.)
            use_cache: Whether to use cached profiles if available
        
        Returns:
            DataProfile with complete metadata and insights
        """
        # Check cache first (only for file paths and if augment_with_llm is True)
        if use_cache and augment_with_llm and isinstance(source, (str, Path)):
            source_path = Path(source)
            if source_path.exists() and source_path.is_file():
                cached_profile = self._load_from_cache(source_path, context)
                if cached_profile is not None:
                    return cached_profile
        
        # Step 1: Extract structural profile (NO semantic interpretation)
        extractor = get_extractor(source)
        profile = extractor.extract(source)
        
        # Step 2: ALL semantic interpretation happens via LLM
        if augment_with_llm and self.client:
            profile = self._augment_with_llm(profile, context)
            
            # Save to cache after LLM augmentation (only for file paths)
            if use_cache and isinstance(source, (str, Path)):
                source_path = Path(source)
                if source_path.exists() and source_path.is_file():
                    self._save_to_cache(source_path, profile, context)
        else:
            # Without LLM, profile only contains structural information
            # User should enable LLM for semantic understanding
            pass
        
        return profile
    
    def _augment_with_llm(self, profile: DataProfile, context: dict | None = None) -> DataProfile:
        """Use LLM to add comprehensive semantic understanding to the profile"""
        
        # Build comprehensive prompt
        prompt = self._build_augmentation_prompt(profile, context)
        
        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,  # Increased for comprehensive analysis
            messages=[{"role": "user", "content": prompt}],
        )
        
        # Parse LLM response
        response_text = message.content[0].text
        augmentations = self._parse_augmentation_response(response_text)
        
        # Apply ALL semantic interpretations from LLM
        
        # Domain and purpose
        profile.inferred_domain = augmentations.get("domain")
        profile.dataset_purpose = augmentations.get("purpose")
        
        # Temporal characteristics (LLM-inferred)
        profile.is_timeseries = augmentations.get("is_timeseries", False)
        profile.temporal_column = augmentations.get("temporal_column")
        profile.temporal_frequency = augmentations.get("temporal_frequency")
        
        # Geospatial characteristics (LLM-inferred)
        profile.is_geospatial = augmentations.get("is_geospatial", False)
        profile.coordinate_columns = augmentations.get("coordinate_columns")
        profile.crs = augmentations.get("crs")
        
        # Column semantic meanings
        column_meanings = augmentations.get("column_meanings", {})
        for col in profile.columns:
            if col.name in column_meanings:
                meaning_data = column_meanings[col.name]
                # Update or set inferred meaning
                col.inferred_meaning = meaning_data.get("meaning")
                col.potential_uses = meaning_data.get("uses", [])
        
        # Insights and visualizations
        profile.key_insights = augmentations.get("insights", [])
        profile.suggested_visualizations = augmentations.get("visualizations", [])
        
        # Quality issues
        if "quality_issues" in augmentations:
            profile.consistency_issues.extend(augmentations["quality_issues"])
        
        return profile
    
    def _build_augmentation_prompt(self, profile: DataProfile, context: dict | None = None) -> str:
        """Build comprehensive prompt for LLM semantic analysis"""
        
        # Start with basic profile info
        prompt_parts = [
            "You are a data science expert analyzing a dataset. Your job is to provide comprehensive semantic understanding.",
            "",
            f"## Dataset Profile",
            f"**Source Type:** {profile.source_type}",
            f"**Shape:** {' × '.join(map(str, profile.shape))}",
            f"**Completeness:** {profile.completeness:.1%}",
        ]
        
        # Add hierarchical/dimensional info if applicable
        if profile.hierarchical and profile.dimensions:
            prompt_parts.append(f"**Dimensions:** {', '.join(f'{k}={v}' for k, v in profile.dimensions.items())}")
        
        # Add user-provided context
        if context and isinstance(context, dict):
            prompt_parts.append("")
            prompt_parts.append("## User-Provided Context")
            for key, value in context.items():
                prompt_parts.append(f"**{key}:** {value}")
        
        # Add column information with all available structural details
        prompt_parts.append("")
        prompt_parts.append("## Fields/Columns")
        for col in profile.columns:
            col_info = [f"\n### `{col.name}` ({col.dtype})"]
            
            # Add existing metadata if available
            if col.inferred_meaning:
                col_info.append(f"*Metadata:* {col.inferred_meaning}")
            
            # Numeric details
            if col.dtype == "numeric" and col.min is not None:
                col_info.append(f"- Range: [{col.min:.2f}, {col.max:.2f}]")
                if col.mean is not None:
                    col_info.append(f"- Mean: {col.mean:.2f}")
                if col.std is not None:
                    col_info.append(f"- Std Dev: {col.std:.2f}")
            
            # Categorical details
            elif col.dtype == "categorical" and col.top_values:
                top_5 = col.top_values[:5]
                values_str = ", ".join([f"{v} ({cnt})" for v, cnt in top_5])
                col_info.append(f"- Top values: {values_str}")
                col_info.append(f"- Unique count: {col.unique_count}")
            
            # Temporal details
            elif col.dtype == "temporal" and col.temporal_range:
                col_info.append(f"- Time range: {col.temporal_range[0]} to {col.temporal_range[1]}")
            
            # Text details
            elif col.dtype == "text":
                if col.avg_length:
                    col_info.append(f"- Average length: {col.avg_length:.1f} characters")
                if col.sample_values:
                    samples = ", ".join([f'"{s}"' for s in col.sample_values[:3]])
                    col_info.append(f"- Samples: {samples}")
            
            # Missing data
            if col.missing_count and col.missing_count > 0:
                col_info.append(f"- Missing: {col.missing_count} ({col.missing_count/col.count*100:.1f}%)")
            
            # Dimensional info (for NetCDF, etc.)
            if col.potential_uses and any('Dimensions' in use for use in col.potential_uses):
                col_info.extend(f"- {use}" for use in col.potential_uses)
            
            prompt_parts.extend(col_info)
        
        # Add sample data for context
        if profile.sample_records:
            prompt_parts.append("")
            prompt_parts.append("## Sample Data")
            prompt_parts.append("```json")
            prompt_parts.append(json.dumps(profile.sample_records[:3], indent=2, default=str))
            prompt_parts.append("```")
        
        # Request comprehensive semantic analysis
        prompt_parts.append("")
        prompt_parts.append("## Your Task: Comprehensive Semantic Analysis")
        prompt_parts.append("")
        prompt_parts.append("Analyze this dataset and provide:")
        prompt_parts.append("")
        prompt_parts.append("1. **Domain**: Identify the scientific/business domain (e.g., seismology, oceanography, epidemiology)")
        prompt_parts.append("2. **Purpose**: What is this dataset used for?")
        prompt_parts.append("3. **Temporal Analysis**: ")
        prompt_parts.append("   - Is this time-series data? If so, which column is the temporal dimension?")
        prompt_parts.append("   - What is the temporal frequency/resolution? (daily, hourly, monthly, etc.)")
        prompt_parts.append("4. **Geospatial Analysis**:")
        prompt_parts.append("   - Does this contain geospatial data? If so, which columns are coordinates?")
        prompt_parts.append("   - What coordinate reference system (CRS) is likely used? (e.g., EPSG:4326 for WGS84 lat/lon)")
        prompt_parts.append("5. **Column Semantic Meanings**: For each column, describe:")
        prompt_parts.append("   - What it represents in domain terms")
        prompt_parts.append("   - Potential analytical uses")
        prompt_parts.append("6. **Key Insights**: Patterns, relationships, notable features, or anomalies")
        prompt_parts.append("7. **Visualization Suggestions**: Specific visualizations with column names (e.g., 'scatter plot of latitude vs longitude, colored by magnitude')")
        prompt_parts.append("8. **Data Quality Issues**: Completeness, consistency, or accuracy concerns")
        prompt_parts.append("")
        prompt_parts.append("Return your analysis as JSON with this structure:")
        prompt_parts.append("```json")
        prompt_parts.append("""{
  "domain": "domain name",
  "purpose": "dataset purpose description",
  "is_timeseries": true/false,
  "temporal_column": "column_name or null",
  "temporal_frequency": "daily/hourly/monthly/etc or null",
  "is_geospatial": true/false,
  "coordinate_columns": ["lat_column", "lon_column"] or null,
  "crs": "EPSG:4326" or other CRS or null,
  "column_meanings": {
    "column_name": {
      "meaning": "semantic description",
      "uses": ["use 1", "use 2"]
    }
  },
  "insights": ["insight 1", "insight 2"],
  "visualizations": ["specific viz 1", "specific viz 2"],
  "quality_issues": ["issue 1", "issue 2"]
}""")
        prompt_parts.append("```")
        
        return "\n".join(prompt_parts)
    
    def _parse_augmentation_response(self, response: str) -> dict:
        """Parse LLM response into structured augmentations"""
        try:
            # Try to extract JSON from response
            # Handle markdown code fences
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                json_str = response[start:end].strip()
            elif "```" in response:
                start = response.find("```") + 3
                end = response.find("```", start)
                json_str = response[start:end].strip()
            else:
                json_str = response.strip()
            
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # Log error for debugging
            print(f"Warning: Failed to parse LLM response as JSON: {e}")
            print(f"Response preview: {response[:200]}...")
            # Fallback: return empty dict
            return {}
    
    def _get_cache_key(self, file_path: Path, context: dict | None = None) -> str:
        """Generate a cache key for a file based on path, modification time, and context"""
        # Use absolute path for consistency
        try:
            abs_path = file_path.resolve()
        except (OSError, RuntimeError):
            # If resolve fails, use the path as-is
            abs_path = str(file_path)
        
        # Include file modification time to detect changes
        try:
            mtime = file_path.stat().st_mtime
        except (OSError, FileNotFoundError):
            # If file doesn't exist or can't be stat'd, use 0 as mtime
            mtime = 0
        
        # Include context in hash if provided (so different contexts get different profiles)
        context_str = ""
        if context:
            # Sort context items for consistent hashing
            try:
                context_str = json.dumps(context, sort_keys=True)
            except (TypeError, ValueError):
                # If context can't be serialized, use string representation
                context_str = str(context)
        
        # Create hash from path, mtime, and context
        key_string = f"{abs_path}:{mtime}:{context_str}"
        cache_key = hashlib.md5(key_string.encode()).hexdigest()
        
        return cache_key
    
    def _get_cache_path(self, cache_key: str) -> Path:
        """Get the cache file path for a given cache key"""
        return self.cache_dir / f"{cache_key}.json"
    
    def _load_from_cache(self, file_path: Path, context: dict | None = None) -> DataProfile | None:
        """Load profile from cache if it exists"""
        try:
            cache_key = self._get_cache_key(file_path, context)
            cache_file = self._get_cache_path(cache_key)
            
            if cache_file.exists():
                # Load JSON and reconstruct profile
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                profile = DataProfile.from_dict(data)
                return profile
        except Exception as e:
            # If cache loading fails, just continue without cache
            # Don't raise - cache is optional
            pass
        
        return None
    
    def _save_to_cache(self, file_path: Path, profile: DataProfile, context: dict | None = None):
        """Save profile to cache"""
        try:
            cache_key = self._get_cache_key(file_path, context)
            cache_file = self._get_cache_path(cache_key)
            
            # Save as JSON
            with open(cache_file, 'w') as f:
                json.dump(profile.to_dict(), f, indent=2, default=str)
        except Exception as e:
            # If cache saving fails, just continue without cache
            # Don't raise - cache is optional
            pass
    
    def save_profile(self, profile: DataProfile, output_path: str | Path):
        """Save profile as markdown and JSON"""
        output_path = Path(output_path)
        
        # Save markdown
        md_path = output_path.with_suffix('.md')
        md_path.write_text(profile.to_markdown())
        
        # Save JSON
        json_path = output_path.with_suffix('.json')
        json_path.write_text(json.dumps(profile.to_dict(), indent=2, default=str))
        
        return md_path, json_path


# Convenience function
def preprocess_data(
    source: Any,
    api_key: str | None = None,
    augment: bool = True,
    context: dict | None = None,
    save_to: str | Path | None = None,
    use_cache: bool = True
) -> DataProfile:
    """
    Preprocess data and optionally save the profile
    
    Args:
        source: Data source (DataFrame, file path, etc.)
        api_key: Anthropic API key for LLM augmentation
        augment: Whether to augment with LLM
        context: Additional context for the data
        save_to: Optional path to save profile
        use_cache: Whether to use cached profiles if available (default: True)
    
    Returns:
        Complete DataProfile
    """
    preprocessor = DataPreprocessor(api_key=api_key)
    profile = preprocessor.process(
        source, 
        augment_with_llm=augment, 
        context=context,
        use_cache=use_cache
    )
    
    if save_to:
        preprocessor.save_profile(profile, save_to)
    
    return profile