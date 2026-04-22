# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands run from the `app/` directory:

```bash
cd app
npm install        # install dependencies
npm run dev        # start dev server at localhost:5173
npm run build      # tsc -b && vite build (type-check + production build)
npm run lint       # eslint
npm run preview    # preview production build
```

No test framework is configured. There are no tests to run.

## Architecture

This is a **client-side only** React app that analyzes Minecraft Bedrock Edition add-on files (.mcaddon, .mcpack, .mcworld, .zip) entirely in the browser. No server uploads.

### Analysis Pipeline (`app/src/analyzer/index.ts`)

The `analyzeAddon()` function orchestrates a 10-step pipeline:

1. **ZIP extraction** → virtual filesystem (handles nested .mcaddon archives)
2. **Pack detection** → finds behavior/resource pack roots via manifest.json
3. **Manifest parsing** → metadata, dependencies, pack type
4. **File indexing** → categorizes files by directory patterns
5. **Category analysis** → dedicated analyzers for items, blocks, entities, recipes, loot tables
6. **Lang file processing** → resolves display names from .lang files
7. **Client entity merging** → combines resource pack visuals with behavior pack data
8. **Tagging** → applies semantic tags (e.g. `edible`, `hostile`, `custom_geo`)
9. **Reference resolution** → validates texture/geometry/animation cross-references
10. **Summary generation** → statistics, gameplay impact assessment, diagnostics

### Key Module Boundaries

- **`analyzer/`** — Pure analysis engine. No React dependencies. Reads a ZIP File, returns `AnalysisResult`.
  - `analyzers/` — Category-specific parsers (item, block, entity, recipe, loot-table)
  - `tagging/` — Rule-based tag assignment per category
- **`types/analysis.ts`** — All TypeScript interfaces (`AnalysisResult`, `ItemSpec`, `BlockSpec`, `EntitySpec`, etc.)
- **`context/`** — React state management: `AnalysisContext` (reducer-based) and `LanguageContext` (i18n)
- **`pages/`** — Three routes: upload (`/`), results (`/results`), detail (`/results/:category/:id`)
- **`components/ui/`** — shadcn/ui base components
- **`export/`** — JSON and Markdown report exporters
- **`lib/`** — Utilities, constants, vanilla texture data

### Data Flow

```
File upload → analyzeAddon() → AnalysisContext (SET_RESULT) → navigate to /results → detail drill-in
```

## Conventions

- **TypeScript strict mode** — no implicit any, no unused variables/parameters
- **Code language** — all code, comments, and commit messages in English
- **UI language** — bilingual (English + Japanese) via LanguageContext
- **Commit prefixes** — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Path alias** — `@/*` maps to `app/src/*` in imports
- **Styling** — Tailwind CSS 4 with CVA (class-variance-authority) for component variants
- **Deployment** — GitHub Pages via `.github/workflows/deploy.yml`, base path `/minecraft_addon_analyzer/`
