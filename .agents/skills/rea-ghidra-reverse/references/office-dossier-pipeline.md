# Automated Office Dossier Pipeline (REA/Ghidra $\rightarrow$ Lycero Office)

After extracting verified Evidence via REA and Ghidra, use the `lycero-office` CLI (or `D:\Lycero Office` engines) to produce structured Office deliverables.

---

## 1. Spreadsheet Matrix (`.xlsx`) — Imports, Exports, Functions & Findings

Convert REA JSON Evidence into a multi-sheet JSON specification (`table.json`) and compile it into an Excel workbook with live formulas:

### Schema for `table.json`:
```json
{
  "sheets": [
    {
      "name": "Artifact_Overview",
      "rows": [
        ["Property", "Observed Value", "Epistemic Status", "Source Tool"],
        ["File Name", "target.exe", "Observed", "rea-ghidra-triage"],
        ["SHA-256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Observed", "crypto.createHash"],
        ["Total Imported DLLs", "=COUNTA(PE_Imports!A2:A500)", "Formula", "engine-sheets"],
        ["High-Risk APIs Detected", "=COUNTIF(PE_Imports!D2:D500, \"HIGH\")", "Formula", "engine-sheets"]
      ]
    },
    {
      "name": "PE_Imports",
      "rows": [
        ["DLL Name", "Function / Ordinal", "IAT RVA", "Risk Tier", "Notes"],
        ["KERNEL32.dll", "VirtualAllocEx", "0x00024110", "HIGH", "Remote process memory allocation"],
        ["ADVAPI32.dll", "CryptAcquireContextW", "0x00024188", "MEDIUM", "CryptoAPI initialization"]
      ]
    },
    {
      "name": "Ghidra_Functions",
      "rows": [
        ["Entry Address", "Function Name", "Size (Bytes)", "High P-code Ops", "Unresolved Calls", "Summary"],
        ["0x140001000", "FUN_140001000", 412, 185, 0, "Main dispatcher and CLI parser"]
      ]
    }
  ]
}
```

### Build & Verify Commands:
```powershell
lycero-office create --type xlsx --from table.json --header --out reverse-engineering-matrix.xlsx --json
lycero-office sheet check reverse-engineering-matrix.xlsx --json
```

---

## 2. Technical Audit Report (`.docx`)

Compile a structured Markdown report (`audit-report.md`) that strictly separates **Observed Facts**, **Decompiler/P-code Inferences**, and **Residual Unknowns**, then compile it to `.docx`:

### Required Sections in `audit-report.md`:
1. **Executive Summary & Scope**
2. **Target Identity & Cryptographic Provenance** (File path, byte size, SHA-256, Authenticode/APK signer fingerprints)
3. **Static Architecture & Dependency Inventory** (PE/ELF sections, Rust `.dep-v0` crates, Go `buildinfo`, or Electron ASAR module graph)
4. **Deep Code Analysis (Ghidra 12.3 Decompilation & SSA P-code)**
   - Include exact virtual addresses (`0x...`), file offsets, decompiled C snippets, and critical SSA P-code operations (`CALLIND`, `PTRSUB`, `MULTIEQUAL`).
5. **Security & Behavioral Findings Ledger** (Severity, Evidence ID, Epistemic Status, Remediation)
6. **Coverage Limitations & Unknowns**

### Build & Verify Commands:
```powershell
lycero-office create --type docx --from audit-report.md --out reverse-engineering-audit.docx --json
lycero-office docs check reverse-engineering-audit.docx --json
```

---

## 3. Architecture & Briefing Presentation (`.pptx`)

Follow the **Astryx Design System** (`DESIGN.md`: Warm Ivory `#F4F2EB` canvas, Soft Paper `#F9F8F3` cards, Warm Charcoal `#1C1B18` ink, Warm Terracotta `#8B3A1A` accent, `Be Vietnam Pro` typography, zero purple/blue gradients):

1. Slide 1: **Title & Target Provenance** (Binary Name, SHA-256, Architecture, Compiler Toolchain)
2. Slide 2: **System Architecture & Module Topology** (Entry points, imported subsystems, IPC/Network surface)
3. Slide 3: **Core Control Flow & Decompiler Findings** (Call graph & annotated C / P-code breakdown)
4. Slide 4: **Risk Matrix & Actionable Recommendations**

```powershell
lycero-office create --type pptx --spec ./slides-spec --out reverse-engineering-briefing.pptx --json
lycero-office slides audit reverse-engineering-briefing.pptx --json
```
