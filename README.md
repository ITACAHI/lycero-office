<p align="center">
  <a href="https://lycero.com/">
    <picture>
      <source srcset="docs/assets/readme/hero-dark.png" media="(prefers-color-scheme: dark)">
      <img src="docs/assets/readme/hero.png" alt="Lycero Office Desktop — Local-First AI-Native Office Suite (Docs, Sheets, Slides, PDF, Markdown & HTML) with Astryx UI and Lycero Mate Copilot" width="100%">
    </picture>
  </a>
</p>

<h1 align="center">Lycero Office Desktop</h1>

<p align="center">
  <b>Local-First, Open-Source AI-Native Office Suite for Windows, macOS & Linux</b><br>
  Native <code>.docx</code>, <code>.xlsx</code>, <code>.pptx</code>, <code>.pdf</code>, <code>.md</code>, and <code>.html</code> editors built on the Astryx design language with an integrated AI Copilot (<b>Lycero Mate</b>), headless CLI, and Model Context Protocol (MCP) server.
</p>

<p align="center">
  <b>License:</b> <a href="LICENSE">Apache-2.0</a> ·
  <b>English</b> ·
  <a href="docs/i18n/README.vi.md"><b>Tiếng Việt</b></a>
</p><!-- public-hygiene: allow -->

<p align="center">
  <a href="https://github.com/ITACAHI/lycero-office/releases"><b>Download Installers</b></a> ·
  <a href="#demo--workspace-tour"><b>Demo</b></a> ·
  <a href="#command-line--agent-skill"><b>CLI & Skill</b></a> ·
  <a href="#mcp-server"><b>MCP Server</b></a> ·
  <a href="https://lycero.com/"><b>Website</b></a> ·
  <a href="PRIVACY.md"><b>Privacy</b></a>
</p>

---

**Lycero Office** is a free, open-source desktop office suite developed by **ITAC AI Heavy Industries** for Windows (`x64`), macOS (Apple Silicon `arm64` & Intel `x64`), and Linux (`AppImage`, `.deb`, `.rpm`). It opens, edits, and saves native Microsoft Office formats (`.docx`, `.xlsx`, `.pptx`) alongside PDF, Markdown, and HTML documents directly on your local disk — pairing a byte-preserving document engine with **Lycero Mate**, an AI agent that edits your document in place with live cursor indicators and one-click rollback.

### Core Highlights

- **Byte-Preserving Native Formats (`.docx`, `.xlsx`, `.pptx`):** Only the XML blocks you or the AI modify are rewritten. Untouched paragraphs, styles, equations, macros, pivot tables, and slide masters survive byte-for-byte so files round-trip cleanly with Microsoft Word, Excel, and PowerPoint.
- **Astryx Ergonomic Design System:** Crafted for long-hour office and educational workflows — **Matte Warm Ivory (`#F4F2EB`) & Warm Terracotta (`#8B3A1A`)** by day, and **Claude-Warm Charcoal (`#262624`) & Radiant Terracotta (`#D97757`)** by night, paired with `Be Vietnam Pro` typography and tabular figures for spreadsheets.
- **100% Local-First & Offline Core:** Every document opens, edits, paginates, calculates formulas, and converts between formats (`PDF ↔ Word/Excel/PowerPoint`, `Markdown/HTML → Word`) locally on your machine without internet connectivity.
- **Lycero Mate AI Copilot & Flexible Providers:** Sign in with your **Lycero** account for zero-config cloud AI, or bring your own API key (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, GLM, Mistral, OpenRouter, Ollama, or any OpenAI-compatible local/custom endpoint).
- **Headless CLI (`lycero-office`) & 29-Tool MCP Server:** Drive the exact same document engines from your terminal or connect Claude Code, Cursor, Codex, Antigravity, Gemini CLI, or Windsurf to generate and edit real Office files automatically.

---

## Demo & Workspace Tour

<p align="center">
  <picture>
    <source srcset="docs/assets/readme/ai-hero-dark.jpg" media="(prefers-color-scheme: dark)">
    <img src="docs/assets/readme/ai-hero-light.jpg" alt="Lycero Office AI-Native Dual-Axis Workspace Showcase" width="100%">
  </picture>
</p>

### 1 · Lycero Docs — Byte-Preserving `.docx` Editor with Live AI Cursor

<p align="center">
  <img src="docs/assets/readme/docs-ai.png" alt="Lycero Docs editing an A4 Word document with real-time AI collaboration cursor and Lycero Mate ActionCard" width="100%">
</p>

- **True A4 Pagination & ISO/IEC 29500 Fidelity:** Multi-column sections, headers, footers, shaded KPI tables, OMML math equations, comments, and tracked changes.
- **Remote-Style AI Editing Indicator:** Watch **Lycero Mate** navigate to the exact section it is editing with a live colored cursor flag, transparent reasoning (`ThinkingBlock`), and instant snapshot rollback.

### 2 · Lycero Sheets — High-Speed `.xlsx` Workbook with Rust Calculation Sidecar

<p align="center">
  <img src="docs/assets/readme/sheets-ai.png" alt="Lycero Sheets calculating regional revenue with live SUMIFS formulas and column charts" width="100%">
</p>

- **Live Formulas, Never Pasted Numbers:** Powered by a native Rust `xlsx-sidecar` (`calamine` + `IronCalc`), Lycero Mate writes real `SUM`, `SUMIFS`, `XLOOKUP`, and dynamic formulas with cached values and charts in a single undoable batch.

### 3 · Lycero Slides — 16:9 `.pptx` Presentation Studio & Layout Auditor

<p align="center">
  <img src="docs/assets/readme/slides-ai.png" alt="Lycero Slides building an 8-slide executive presentation deck in native PPTX format" width="100%">
</p>

- **From Brief to Native `.pptx`:** Plans the storyline, drafts slides with editable shapes, tables, and charts, and runs automated geometry checks (`slides audit`) to eliminate text overflow or overlapping elements.

### 4 · CLI & Model Context Protocol (MCP) Server

<p align="center">
  <img src="docs/assets/readme/cli-mcp.png" alt="Lycero Office headless CLI and 29-tool MCP server in terminal" width="100%">
</p>

---

## Command Line & Agent Skill

Every Lycero Office installation bundles the `lycero-office` command-line interface and an installable Agent Skill (**Settings → Integrations**):

```bash
lycero-office --version
lycero-office info report.docx --json
lycero-office convert report.md --to pdf
lycero-office create --type docx --from notes.md --out notes.docx --json
lycero-office create --type xlsx --from table.json --out sales.xlsx --json
lycero-office docs read report.docx --range 0-9 --json
lycero-office render report.docx --out shots/
```

See [packages/cli/README.md](packages/cli/README.md) for the complete CLI reference.

## MCP Server

Expose all 29 document tools to any MCP-compatible AI assistant over `stdio` or Streamable HTTP:

```bash
# Claude Code
claude mcp add --transport stdio lycero-office -- lycero-office mcp
```

```json
{
  "mcpServers": {
    "lycero-office": {
      "command": "lycero-office",
      "args": ["mcp"]
    }
  }
}
```

---

## Download

All official multi-platform installers are published on [GitHub Releases](https://github.com/ITACAHI/lycero-office/releases):

| Platform | Architecture & Package | Download |
| :--- | :--- | :--- |
| **Windows** | Windows 10/11 (`x64` NSIS Installer `.exe`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |
| **macOS (Apple Silicon)** | M1 / M2 / M3 / M4 (`arm64` `.dmg` & `.zip`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |
| **macOS (Intel)** | Intel Mac (`x64` `.dmg` & `.zip`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |
| **Linux (Debian / Ubuntu)** | `x86_64` `.deb` (GPG-signed `.asc`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |
| **Linux (Fedora / RHEL / openSUSE)** | `x86_64` `.rpm` (GPG-signed `.asc`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |
| **Linux (Universal)** | `x86_64` `.AppImage` (GPG-signed `.asc`) | [GitHub Releases (`v2.0.0`)](https://github.com/ITACAHI/lycero-office/releases/latest) |

---

## Development

```bash
npm install
npm test             # Run unit and integration tests across workspaces
npm run typecheck    # Run TypeScript typechecking across all workspaces
npm run dev          # Launch all editors + shell in development mode
npm run dist:win     # Package Windows x64 NSIS installer
npm run dist:mac     # Package macOS Apple Silicon (arm64) & Intel (x64) DMG/ZIP
npm run dist:linux   # Package Linux AppImage, DEB, and RPM
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for architecture and security details.

---

## Code Signing Policy

Free code signing on Windows is provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

- **Committers & Release Approvers:** Official maintainers of [ITAC AI Heavy Industries](https://github.com/ITACAHI).
- **Privacy & Network Policy:** This program is local-first and will not transfer any document content or personal information to other networked systems unless specifically requested by the user or the person installing or operating it (such as signing in to an AI provider or checking for updates). See [PRIVACY.md](PRIVACY.md) for details.

## License & Legal Compliance

Lycero Office is distributed under the [Apache License, Version 2.0](LICENSE).

- Copyright © 2026 **ITAC AI Heavy Industries**. All rights reserved.
- Pursuant to Section 4 of the Apache License, Version 2.0: Lycero Office is a derivative work based on open-source software originally developed by Mainfunc, Inc. (*Original work Copyright © 2026 Mainfunc, Inc., licensed under the Apache License, Version 2.0*).
- See [LICENSE](LICENSE), [NOTICE](NOTICE), and [LEGAL_AND_IP_COMPLIANCE.md](LEGAL_AND_IP_COMPLIANCE.md) for complete statutory and open-source license disclosures.
