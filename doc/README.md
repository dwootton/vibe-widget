# Doc site

Documentation and marketing site for vibe-widget (React + Vite). Includes the gallery, playground, and MDX docs.

## Adding a new example

To add a new example to the **gallery** (and optionally an **example notebook**), you only need to edit one or two places.

### 1. Register the example

**File:** `doc/data/examples.ts`

Add a new entry to the `EXAMPLES` array. Each example is the single source of truth for metadata and data.

```ts
{
  id: "my-example",                    // unique slug (used in URLs and notebookId)
  label: "My Example",                 // display name
  prompt: "Short prompt used to create the widget",
  description: "Longer description for the card.",
  moduleUrl: "/widgets/my_widget.js",  // path under doc/public/widgets/
  categories: ["Data Visualization"],   // Category[]
  size: "medium",                      // "small" | "medium" | "large"
  gifUrl: "",                          // optional: "/gif/my.gif" for card thumbnail
  dataFiles: [                         // data loaded for preview and notebook
    { url: "/testdata/my_data.csv", varName: "data", type: "csv" },
  ],
  requiresDataForPreview: true,        // true if widget needs data to render
  notebookId: "my-example",            // optional: key for getNotebook() when there is a notebook
}
```

- **Widget script:** Put the built widget `.js` (or `.vw` bundle) under `doc/public/widgets/` and set `moduleUrl` to that path (e.g. `/widgets/my_widget.js`).
- **Test data:** Put CSV/JSON under `doc/public/testdata/` and reference in `dataFiles` with `url: "/testdata/..."`, plus `varName` (name used in Python) and `type: "csv"` or `"json"`.
- **No notebook:** Omit `notebookId`. The example will still appear in the gallery; opening it will show “Notebook environment not found” unless you add a notebook (step 2).

### 2. (Optional) Add an example notebook

If the example should open a runnable notebook (same UI as the gallery’s “open in notebook” view):

1. **Create a notebook file**  
   **Path:** `doc/data/notebooks/<notebook-id>.ts`  
   Use the same id you set as `notebookId` in step 1 (e.g. `my-example` → `my-example.ts`).

   Export a `NotebookSpec` with `cells` and `dataFiles`:

   ```ts
   import type { NotebookCell, NotebookSpec } from "./types";

   const cells: NotebookCell[] = [
     { type: "markdown", content: "<h2>Title</h2><p>Intro...</p>" },
     {
       type: "code",
       content: `import vibe_widget as vw\nimport pandas as pd\n\n# ...`,
       defaultCollapsed: true,
       label: "Setup",
     },
     // ... more cells
   ];

   export const myExample: NotebookSpec = {
     cells,
     dataFiles: [
       { url: "/testdata/my_data.csv", varName: "data", type: "csv" },
     ],
   };
   ```

   - **NotebookCell:** `type: "markdown" | "code"`, `content: string`, and optionally `defaultCollapsed`, `label`, `readOnly`.
   - **dataFiles:** Same shape as in `examples.ts`; usually match the example’s `dataFiles`.

2. **Register the notebook**  
   **File:** `doc/data/notebooks/index.ts`

   - Import your spec:  
     `import { myExample } from "./my-example";`
   - Add it to `REGISTRY`:  
     `"my-example": myExample,`  
     (key must match `notebookId` in `examples.ts`.)

After that, the gallery card for that example will open the new notebook when clicked.

### Summary

| Goal                         | Where to edit |
|-----------------------------|---------------|
| Add/change gallery example  | `doc/data/examples.ts` only |
| Add widget asset            | `doc/public/widgets/<name>.js` (or `.vw`) + `moduleUrl` in `examples.ts` |
| Add test data               | `doc/public/testdata/<name>.csv` (or `.json`) + `dataFiles` in `examples.ts` |
| Add notebook for an example | `doc/data/notebooks/<id>.ts` (cells + dataFiles) + `doc/data/notebooks/index.ts` (registry) |

Adding a new example = one entry in `examples.ts`. If it has a notebook, add one file in `notebooks/` and one line in `notebooks/index.ts`.
