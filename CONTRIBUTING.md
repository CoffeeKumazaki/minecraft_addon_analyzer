# Contributing to Minecraft Add-on Analyzer

Thank you for your interest in contributing! This document provides guidelines to make the process smooth for everyone.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- npm v10 or later

### Getting Started

```bash
git clone https://github.com/CoffeeKumazaki/minecraft_addon_analyzer.git
cd minecraft_addon_analyzer/app
npm install
npm run dev
```

The dev server will start at `http://localhost:5173`.

## Code Style

- TypeScript strict mode is enabled
- Run `npm run lint` before committing
- Follow existing patterns and conventions in the codebase
- Use meaningful variable and function names

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes
3. Ensure `npm run build` and `npm run lint` pass
4. Open a pull request using the PR template
5. Describe your changes clearly in the PR description

### Commit Messages

Use clear, descriptive commit messages. Prefix with a type:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change that neither fixes a bug nor adds a feature
- `docs:` documentation changes
- `chore:` maintenance tasks

## Bug Reports

When filing a bug report, please include:

- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and OS information
- The add-on file that triggered the issue (if applicable and shareable)

## Language Policy

- Code: English (variable names, comments, commit messages)
- Issues & PRs: English or Japanese

## Questions?

Feel free to open an issue for any questions about contributing.
