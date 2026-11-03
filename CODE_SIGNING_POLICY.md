# Code Signing Policy — Lycero Office Desktop

**Lycero Office Desktop** (`https://github.com/ITACAHI/lycero-office`) is an open-source office suite distributed under the **Apache License, Version 2.0** (see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE)).

---

## 1. Code Signing Provider

Free code signing on Windows is provided by **[SignPath.io](https://signpath.io)**, and the certificate is issued by the **[SignPath Foundation](https://signpath.org)**.

---

## 2. Build & Release Integrity (Zero-Key Reproducible Pipeline)

1. **Automated CI/CD Builds Only:**
   - All official Windows (`.exe`), macOS (`.dmg`, `.zip`), and Linux (`.AppImage`, `.deb`, `.rpm`) release binaries are built exclusively from tagged commits (`v*.*.*`) on the `main` branch via GitHub-hosted runners in [`.github/workflows/release.yml`](./.github/workflows/release.yml).
   - No developer workstation binaries are ever uploaded to official releases or submitted for code signing.
2. **Pre-Signing Security Gates:**
   - Every release build must pass the automated **Security & Public Hygiene Gate** ([`tools/check-public-hygiene.mjs`](./tools/check-public-hygiene.mjs)), **Lockstep Version Synchronization Gate** ([`tools/check-version-sync.mjs`](./tools/check-version-sync.mjs)), **Production Dependency License Audit** ([`tools/check-licenses.mjs`](./tools/check-licenses.mjs)), and **Windows Defender Antimalware Scan** ([`tools/submit-wdsi.mjs`](./tools/submit-wdsi.mjs)) before signing or publishing.
3. **SHA-256 Checksum Transparency:**
   - Every Windows release publishes `SHA256SUMS.txt` alongside the installer assets on [GitHub Releases](https://github.com/ITACAHI/lycero-office/releases).

---

## 3. Team Roles & Authorization (SignPath Governance)

| Role | GitHub Team / Maintainers | Responsibilities |
| :--- | :--- | :--- |
| **Contributors / Authors** | Open-source community & `@ITACAHI` contributors | Submit pull requests and source changes |
| **Reviewers / Committers** | `@ITACAHI` Core Maintainers | Review pull requests, verify automated test suites, and merge to `main` |
| **Approvers** | `@ITACAHI` Release Owners (2FA enforced) | Approve tagged release builds (`v*.*.*`) and authorize code signing requests in SignPath |

---

## 4. Privacy & Data Sovereignty Policy

- **Local-First & Offline Core:** Lycero Office Desktop processes and saves `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.md`, and `.html` files locally on the user's device.
- **No Unauthorized Network Transmission:** This program will not transfer any user document or personal information to other networked systems unless specifically requested by the user (for example, when invoking an optional cloud AI provider configured by the user).
- **Zero Telemetry in Source Builds:** Source and community builds run with all analytics disabled by default. See [`LEGAL_AND_IP_COMPLIANCE.md`](./LEGAL_AND_IP_COMPLIANCE.md) for full compliance documentation.
