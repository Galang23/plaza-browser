# Plaza Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Plaza Browser is a high-performance, Electron-based web browser designed for power users who need advanced workspace and tab management. It serves as the base "codex" for the upcoming **ChatPlaza** project — a unified hub for multiple AI chat providers.

![Plaza Browser Screenshot](/media/plaza-browser.png)

## Key Features

- **Hierarchical Workspaces**: Organize your browsing into distinct workspaces, each with its own isolated session partition (separate cookies/storage).
- **Advanced Tab Engine**: Built using `WebContentsView` for true Chromium tab isolation, with lazy loading for background tabs to save memory.
- **Session Persistence**: Automatically saves and restores all workspaces, tabs, and window state across restarts.
- **Custom Context Menus**: Centralized context menu system for both UI elements and web content.
- **Find-in-Page**: Integrated search overlay for efficient content discovery.
- **Download Management**: Built-in tracking and management of active downloads.
- **Tab Health Monitoring**: Automatic detection and reporting of crashed or unresponsive tabs.

## Upcoming Project: ChatPlaza

Plaza Browser is the foundation for **ChatPlaza**, a planned project that will serve as a central hub for all your AI chat providers (Gemini, ChatGPT, Claude, DeepSeek, Kimi, etc.) in a single, organized workspace.

## Development

### Prerequisites

- [Bun](https://bun.sh/) (Recommended package manager)
- Node.js & NPM

### Setup

```bash
# Install dependencies
bun install

# Run in development mode (with HMR)
bun run dev
```

### Build & Package

```bash
# Build the project
bun run build

# Preview the built application
bun run preview

# Package for distribution (Windows, Mac, Linux)
bun run package
```

## Architecture

Plaza Browser follows a multi-process architecture:

1. **Main Process**: Handles window management, tab lifecycle, session persistence, and IPC orchestration.
2. **Preload Script**: Provides a secure bridge between the main process and the renderer using `contextBridge`.
3. **Renderer Process**: A React-based UI that manages the sidebar, workspaces, address bar, and overlays.

The tab engine (`TabManager`) manages `WebContentsView` instances entirely in the main process, ensuring the renderer remains stateless and responsive.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Galang23**
