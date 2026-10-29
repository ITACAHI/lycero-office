# REA v6.8.0 Workflow, CLI/MCP Routing & Evidence Ledger Reference

## 1. Invoking REA on This Machine

REA is available both in source (`D:\rea-upstream-20261028`, v6.8.0) and as a pre-built runtime (`D:\rea\scripts\rea.mjs`).

### Direct CLI Invocation Pattern:
```powershell
# Run any REA CLI subcommand with --json output:
node "D:\rea\scripts\rea.mjs" <subcommand> <target-path> --json
```

### Common Target-Free CLI Subcommands (Zero Disassembler Startup):
| Target Type | CLI Subcommand | MCP Tool Equivalent |
|---|---|---|
| Desktop app folder | `inspect-desktop-application <dir> --detail summary --evidence_output <bundle.json>` | `inspect_desktop_application` |
| Electron / JS tree / `.asar` | `analyze-javascript-application <path> --json` | `analyze_javascript_application` |
| PE Authenticode certs | `inspect-pe-certificates <exe> --json` | `inspect_pe_certificates` |
| PE Imports & Delay-Load | `inspect-pe-imports <exe> --json` | `inspect_pe_imports` |
| PE TLS & Load Config (CFG/XFG) | `inspect-pe-load-config <exe> --json` | `inspect_pe_load_config` |
| PE Resources (Icons/Manifests) | `inspect-pe-resources <exe> --json` | `inspect_pe_resources` |
| PE / ELF Exports | `inspect-native-exports <bin> --json` | `inspect_native_exports` |
| ELF Notes / Build-ID | `inspect-elf-notes <elf> --json` | `inspect_elf_notes` |
| ELF Offline Layout | `inspect-binary-layout <elf> --json` | `inspect_binary_layout` |
| Linux Kernel Module (`.ko`) | `inspect-kernel-module <ko> --json` | `inspect_kernel_module` |
| Rust `.dep-v0` crates | `inspect-rust-binary <bin> --json` | `inspect_rust_binary` |
| Go `buildinfo` & modules | `inspect-go-binary <bin> --json` | `inspect_go_binary` |
| Unity `global-metadata.dat` | `inspect-il2cpp-metadata <dat> --json` | `inspect_il2cpp_metadata` |
| Python `.pyc` (3.7–3.13) | `inspect-python-pyc <pyc> --json` | `inspect_python_pyc` |
| Android APK Signatures | `inspect-apk-signature <apk> --json` | `inspect_apk_signature` |
| SQLite Database Snapshot | `inspect-sqlite-database <db> --json` | `inspect_sqlite_database` |
| WebAssembly (`.wasm`) | `inspect-wasm-artifact <wasm> --json` | `inspect_wasm_artifact` |
| AI Models (`.gguf` / `.safetensors`) | `inspect-model-artifact <model> --json` | `inspect_model_artifact` |

---

## 2. Deep Native Analysis & Deadline Recovery

When opening large native binaries (10 MB–200 MB) with Ghidra:

1. **Cold Import Timeout Management:**
   - Default startup budget is `330,000 ms` (5.5 minutes).
   - If `provider_timeout` occurs on `ghidra.startup_timeout_ms`, increase it via `update_analysis_settings` (`action: "set"`, `setting: "ghidra.startup_timeout_ms"`, `value: 1800000`) or via environment variable in CLI mode:
     ```powershell
     $env:REA_GHIDRA_STARTUP_TIMEOUT_MS="1800000"
     node "D:\rea\dist\cli.js" analyze "<path-to-binary>" --provider ghidra --json
     ```
2. **Reusing an Existing Ghidra Project (`.gpr`):**
   - Set `REA_GHIDRA_PROJECT_PATH` to the `.gpr` file path and optionally `REA_GHIDRA_PROGRAM_NAME`.
   - REA clones a fingerprint-bound ephemeral copy in `-readOnly` mode so the user's original Ghidra project is never locked or mutated.

---

## 3. Cross-Version Binary Diffing Workflow (`v1` vs `v2`)

To compare two builds of a binary (e.g., patch Tuesday diff, upstream vs fork binary diff):

1. Open `v1` with `open_binary` $\rightarrow$ call `list_procedures` $\rightarrow$ export Evidence bundle (`export_evidence_bundle`) $\rightarrow$ `close_binary`.
2. Open `v2` with `open_binary` $\rightarrow$ call `list_procedures` $\rightarrow$ import `v1` bundle (`import_evidence_bundle`).
3. Call `match_native_functions` with both `list_procedures` Evidence IDs and optional `left_observations` / `right_observations`.
4. Page matched pairs via `inspect_analysis_view` (`kind: "function-matches"`, `collection: "matches"`).
5. For functions with altered body digests, call `analyze_function` on both sides and pass their `parent_evidence_id` references to `compare_functions`.

---

## 4. Finding Ledger Format

Maintain a structured ledger during every investigation:

| Question / Hypothesis | Status | Evidence ID / Source | Epistemic Class (`Observed` / `Inferred` / `Unknown`) | Technical Finding & Address Range |
|---|---|---|---|---|
| Does binary verify TLS certs? | Answered | `ev_019...` (`analyze_function @ 0x140012a40`) | `Observed` (Import) + `Inferred` (Decompiled C) | Calls `WinHttpSetOption` with `SECURITY_FLAG_IGNORE_UNKNOWN_CA` (`0x100`) at `0x140012a8c`. |
