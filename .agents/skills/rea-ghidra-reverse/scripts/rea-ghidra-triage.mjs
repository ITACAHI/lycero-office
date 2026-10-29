#!/usr/bin/env node
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Coordinated Triage & Dossier Generator (REA v6.8.0 × Ghidra 12.3 × Lycero Office)
 * Usage:
 *   node rea-ghidra-triage.mjs <target-path> [--out-dir <dir>]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const REA_CLI_CANDIDATES = [
  "D:\\rea-upstream-20261028\\scripts\\rea.mjs",
  "D:\\rea\\scripts\\rea.mjs",
];

function findReaCli() {
  for (const candidate of REA_CLI_CANDIDATES) {
    const rootDir = path.dirname(path.dirname(candidate));
    if (
      fs.existsSync(candidate) &&
      fs.existsSync(path.join(rootDir, "dist", "main.js"))
    ) {
      return candidate;
    }
  }
  return null;
}

function computeSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(65536);
  let bytesRead = 0;
  while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    hash.update(buf.subarray(0, bytesRead));
  }
  fs.closeSync(fd);
  return hash.digest("hex");
}

function detectFormat(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return { kind: "directory", magicHex: "" };
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(Math.min(64, stat.size));
  fs.readSync(fd, header, 0, header.length, 0);
  fs.closeSync(fd);

  const magicHex = header.subarray(0, 16).toString("hex");
  const ext = path.extname(filePath).toLowerCase();

  if (header.length >= 2 && header[0] === 0x4d && header[1] === 0x5a) {
    return { kind: "pe", magicHex };
  }
  if (
    header.length >= 4 &&
    header[0] === 0x7f &&
    header[1] === 0x45 &&
    header[2] === 0x4c &&
    header[3] === 0x46
  ) {
    return { kind: ext === ".ko" ? "kernel-module" : "elf", magicHex };
  }
  if (
    header.length >= 4 &&
    [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(
      header.readUInt32BE(0),
    )
  ) {
    return { kind: "macho", magicHex };
  }
  if (
    header.length >= 4 &&
    header[0] === 0x00 &&
    header[1] === 0x61 &&
    header[2] === 0x73 &&
    header[3] === 0x6d
  ) {
    return { kind: "wasm", magicHex };
  }
  if (header.subarray(0, 15).toString("utf8") === "SQLite format 3") {
    return { kind: "sqlite", magicHex };
  }
  if (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    header[2] === 0x03 &&
    header[3] === 0x04
  ) {
    if (ext === ".apk" || ext === ".aab") return { kind: "apk", magicHex };
    return { kind: "zip-archive", magicHex };
  }
  if (ext === ".asar") return { kind: "asar", magicHex };
  if (ext === ".pyc") return { kind: "pyc", magicHex };
  if (path.basename(filePath).toLowerCase() === "global-metadata.dat") {
    return { kind: "il2cpp", magicHex };
  }
  if (ext === ".gguf" || ext === ".safetensors") {
    return { kind: "model", magicHex };
  }
  return { kind: "unknown-binary", magicHex };
}

function runReaCommand(reaCli, subcommand, targetPath, extraArgs = []) {
  const res = spawnSync(
    process.execPath,
    [reaCli, subcommand, targetPath, "--json", ...extraArgs],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 60000,
    },
  );
  let parsed = null;
  if (res.stdout) {
    try {
      parsed = JSON.parse(res.stdout.trim());
    } catch {
      parsed = { rawPreview: res.stdout.slice(0, 2000) };
    }
  }
  return {
    subcommand,
    exitCode: res.status,
    ok: res.status === 0 && parsed !== null,
    data: parsed,
    stderr: res.stderr ? res.stderr.slice(0, 1000) : "",
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: node rea-ghidra-triage.mjs <target-path> [--out-dir <output-folder>]",
    );
    process.exit(0);
  }

  const targetPath = path.resolve(args[0]);
  if (!fs.existsSync(targetPath)) {
    console.error(JSON.stringify({ status: "error", message: `Target not found: ${targetPath}` }));
    process.exit(2);
  }

  const outDirIdx = args.indexOf("--out-dir");
  const outDir =
    outDirIdx !== -1 && args[outDirIdx + 1]
      ? path.resolve(args[outDirIdx + 1])
      : path.join(process.cwd(), "rea-triage-out");

  fs.mkdirSync(outDir, { recursive: true });

  const stat = fs.statSync(targetPath);
  const format = detectFormat(targetPath);
  const sha256 = stat.isFile() ? computeSha256(targetPath) : null;
  const reaCli = findReaCli();

  const probes = [];
  if (reaCli) {
    if (format.kind === "pe") {
      for (const cmd of [
        "inspect-pe-imports",
        "inspect-pe-certificates",
        "inspect-pe-load-config",
        "inspect-pe-resources",
        "inspect-native-exports",
        "inspect-rust-binary",
        "inspect-go-binary",
      ]) {
        probes.push(runReaCommand(reaCli, cmd, targetPath));
      }
    } else if (format.kind === "elf") {
      for (const cmd of [
        "inspect-elf-notes",
        "inspect-native-exports",
        "inspect-rust-binary",
        "inspect-go-binary",
      ]) {
        probes.push(runReaCommand(reaCli, cmd, targetPath));
      }
    } else if (format.kind === "kernel-module") {
      probes.push(runReaCommand(reaCli, "inspect-kernel-module", targetPath));
    } else if (format.kind === "asar") {
      probes.push(runReaCommand(reaCli, "analyze-javascript-application", targetPath));
    } else if (format.kind === "apk") {
      probes.push(runReaCommand(reaCli, "inspect-apk-signature", targetPath));
    } else if (format.kind === "wasm") {
      probes.push(runReaCommand(reaCli, "inspect-wasm-artifact", targetPath));
    } else if (format.kind === "sqlite") {
      probes.push(runReaCommand(reaCli, "inspect-sqlite-database", targetPath));
    } else if (format.kind === "pyc") {
      probes.push(runReaCommand(reaCli, "inspect-python-pyc", targetPath));
    } else if (format.kind === "il2cpp") {
      probes.push(runReaCommand(reaCli, "inspect-il2cpp-metadata", targetPath));
    } else if (format.kind === "model") {
      probes.push(runReaCommand(reaCli, "inspect-model-artifact", targetPath));
    }
  }

  const dossier = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    target: {
      path: targetPath,
      name: path.basename(targetPath),
      sizeBytes: stat.size,
      sha256,
      detectedFormat: format.kind,
      magicHex: format.magicHex,
    },
    engines: {
      reaCli: reaCli ?? "not_found",
      ghidraSource: fs.existsSync("D:\\ghidra-upstream-20261028")
        ? "D:\\ghidra-upstream-20261028"
        : "not_found",
    },
    probes: probes.map((p) => ({
      subcommand: p.subcommand,
      ok: p.ok,
      exitCode: p.exitCode,
      summary: p.data?.normalized_result ?? p.data ?? null,
    })),
  };

  const dossierPath = path.join(outDir, "triage-dossier.json");
  fs.writeFileSync(dossierPath, JSON.stringify(dossier, null, 2), "utf8");

  // Build Lycero Office Excel table specification
  const sheetRows = [
    ["Property", "Observed Value", "Epistemic Status", "Source"],
    ["Target Name", dossier.target.name, "Observed", "fs.statSync"],
    ["Target Path", dossier.target.path, "Observed", "path.resolve"],
    ["Size (Bytes)", String(dossier.target.sizeBytes), "Observed", "fs.statSync"],
    ["SHA-256", dossier.target.sha256 ?? "N/A (Directory)", "Observed", "crypto.createHash"],
    ["Detected Format", dossier.target.detectedFormat, "Observed", "magic-bytes"],
    ["Magic Header (16B)", dossier.target.magicHex, "Observed", "fs.readSync"],
    ["Executed REA Probes", String(probes.length), "Observed", "rea-cli"],
    ["Successful Probes", String(probes.filter((p) => p.ok).length), "Observed", "rea-cli"],
  ];

  const probeRows = [
    ["REA Inspector", "Status", "Exit Code", "Evidence Digest / Summary"],
    ...probes.map((p) => [
      p.subcommand,
      p.ok ? "PASS" : "SKIPPED_OR_UNSUPPORTED",
      String(p.exitCode ?? -1),
      JSON.stringify(p.data?.normalized_result ?? p.data ?? {}).slice(0, 220),
    ]),
  ];

  const matrixPath = path.join(outDir, "triage-matrix.json");
  fs.writeFileSync(
    matrixPath,
    JSON.stringify(
      {
        sheets: [
          { name: "Artifact_Identity", rows: sheetRows },
          { name: "REA_Probes", rows: probeRows },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  // Build Lycero Office Markdown report for .docx compilation
  const mdLines = [
    `# Báo Cáo Triage & Định Danh Nhị Phân: ${dossier.target.name}`,
    "",
    "## 1. Định Danh Cryptographic & Provenance (Observed)",
    "",
    `- **Đường dẫn tệp:** \`${dossier.target.path}\``,
    `- **Kích thước:** \`${dossier.target.sizeBytes.toLocaleString("en-US")} bytes\``,
    `- **Mã băm SHA-256:** \`${dossier.target.sha256 ?? "N/A"}\``,
    `- **Định dạng nhận diện:** \`${dossier.target.detectedFormat}\``,
    `- **Magic Bytes (16B đầu):** \`${dossier.target.magicHex}\``,
    "",
    "## 2. Kết Quả Quét Tĩnh Không Thực Thi (REA Target-Free Probes)",
    "",
    "| Bộ phân tích REA | Trạng thái | Mã thoát | Tóm tắt Evidence |",
    "|---|---|---|---|",
    ...probes.map(
      (p) =>
        `| \`${p.subcommand}\` | ${p.ok ? " hoàn tất" : "⚪ không áp dụng"} | \`${p.exitCode}\` | \`${JSON.stringify(p.data?.normalized_result ?? {}).slice(0, 120).replace(/\|/g, "\\|")}\` |`,
    ),
    "",
    "## 3. Khuyến Nghị Bước Tiếp Theo (Stage 2 — Ghidra 12.3 SSA P-code)",
    "",
    "- Mở mục tiêu qua `open_binary` với `provider_id: \"ghidra\"` (`ReaGhidraBridge.java`).",
    "- Truy vấn danh sách thủ tục (`list_procedures`) và phân tích sâu đồ thị SSA `HighFunction` + `PcodeOpAST` bằng `analyze_function`.",
  ];

  const mdPath = path.join(outDir, "triage-report.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        status: "ok",
        target: dossier.target,
        outputs: {
          dossierJson: dossierPath,
          xlsxSpecJson: matrixPath,
          docxMarkdown: mdPath,
        },
      },
      null,
      2,
    ),
  );
}

main();
