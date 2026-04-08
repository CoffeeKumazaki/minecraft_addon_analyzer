# Minecraft Bedrock Add-on Analyzer

A client-side web tool that analyzes Minecraft Bedrock Edition add-on packages and generates detailed reports.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://coffeekumazaki.github.io/minecraft_addon_analyzer/)

<!-- ![Screenshot](docs/screenshot.png) -->

## Live Demo

**[https://coffeekumazaki.github.io/minecraft_addon_analyzer/](https://coffeekumazaki.github.io/minecraft_addon_analyzer/)**

## Features

- **Drag & drop analysis** - Upload `.mcaddon`, `.mcpack`, `.mcworld`, or `.zip` files
- **Fully client-side** - No files are uploaded to any server; everything runs in your browser
- **Items** - Icons, components, stats, and dependencies
- **Blocks** - Textures, geometry, components, properties, and permutations
- **Entities** - Models, animations, textures, and behavior data
- **Recipes** - Crafting and smelting definitions
- **Loot Tables** - Drop pools and conditions
- **Smart tagging** - Automatic categorization of content (e.g. `custom_geo`, `animated`)
- **Export** - Download reports as JSON or Markdown

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- npm v10+

### Install & Run

```bash
git clone https://github.com/CoffeeKumazaki/minecraft_addon_analyzer.git
cd minecraft_addon_analyzer/app
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build

```bash
npm run build
npm run preview   # preview the production build
```

## Tech Stack

- **React 19** + **TypeScript 5.9**
- **Vite 8** (build tool)
- **Tailwind CSS 4** (styling)
- **React Router 7** (routing)
- **JSZip** (archive extraction)
- **shadcn/ui** (UI components)

## Project Structure

```
app/
├── src/
│   ├── analyzer/         # Core analysis engine
│   │   ├── analyzers/    #   Category-specific analyzers (item, block, entity, ...)
│   │   ├── tagging/      #   Automatic tag assignment rules
│   │   ├── zip-extractor.ts
│   │   ├── pack-detector.ts
│   │   ├── manifest-parser.ts
│   │   └── ...
│   ├── pages/            # Route pages (upload, results, detail)
│   ├── components/       # Reusable UI components
│   ├── types/            # TypeScript type definitions
│   ├── export/           # JSON & Markdown exporters
│   ├── hooks/            # Custom React hooks
│   ├── context/          # React context (state management)
│   └── lib/              # Utilities
```

## How It Works

1. **Extract** - Decompress the uploaded archive into a virtual file system
2. **Detect packs** - Identify behavior & resource pack roots
3. **Parse manifests** - Read `manifest.json` for metadata and dependencies
4. **Index files** - Categorize all files by type (items, blocks, entities, etc.)
5. **Analyze** - Run category-specific analyzers to extract structured data
6. **Localize** - Parse `.lang` files for display names
7. **Merge** - Combine resource pack data (textures, geometry, animations) with behavior data
8. **Tag** - Apply semantic tags based on content analysis
9. **Resolve references** - Link textures, geometries, and cross-references
10. **Summarize** - Generate an overview with statistics and diagnostics

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 日本語

### 概要

Minecraft 統合版のアドオンパッケージ（`.mcaddon` / `.mcpack` / `.mcworld`）をブラウザ上で解析し、詳細なレポートを生成するツールです。ファイルはサーバーにアップロードされず、すべてクライアントサイドで処理されます。

### 主な機能

- アイテム・ブロック・エンティティ・レシピ・ルートテーブルの解析
- テクスチャ・ジオメトリ・アニメーションの抽出と表示
- 自動タグ付けによるコンテンツ分類
- JSON / Markdown 形式でのエクスポート

### 使い方

```bash
git clone https://github.com/CoffeeKumazaki/minecraft_addon_analyzer.git
cd minecraft_addon_analyzer/app
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、アドオンファイルをドラッグ＆ドロップしてください。
