/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const LINUX_UNPACKED = path.join(ROOT_DIR, 'apps', 'shell', 'release', 'linux-unpacked');
const STAGING_DIR = path.join(ROOT_DIR, 'build-artifacts', 'deb-staging');
const OUTPUT_DEB = path.join(ROOT_DIR, 'File', 'lycero-office_1.0.0_amd64.deb');
const OUTPUT_DEB_SHELL = path.join(ROOT_DIR, 'apps', 'shell', 'release', 'lycero-office_1.0.0_amd64.deb');

console.log('[DEB-BUILDER] Checking linux-unpacked at:', LINUX_UNPACKED);
if (!fs.existsSync(LINUX_UNPACKED)) {
  console.error('Error: linux-unpacked does not exist!');
  process.exit(1);
}

// Ensure staging directory
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

const DATA_DIR = path.join(STAGING_DIR, 'data');
const CONTROL_DIR = path.join(STAGING_DIR, 'control');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CONTROL_DIR, { recursive: true });

// 1. Copy linux-unpacked to data/opt/lycero-office
const OPT_APP_DIR = path.join(DATA_DIR, 'opt', 'lycero-office');
fs.mkdirSync(OPT_APP_DIR, { recursive: true });
console.log('[DEB-BUILDER] Copying linux-unpacked to opt/lycero-office...');
fs.cpSync(LINUX_UNPACKED, OPT_APP_DIR, { recursive: true });

// 2. Setup desktop file
const APPS_DIR = path.join(DATA_DIR, 'usr', 'share', 'applications');
fs.mkdirSync(APPS_DIR, { recursive: true });
const desktopContent = `[Desktop Entry]
Name=Lycero Office
Exec=/opt/lycero-office/lycero-office %U
Terminal=false
Type=Application
Icon=lycero-office
StartupWMClass=lycero-office
Comment=Lycero Office: Bộ ứng dụng văn phòng AI sư phạm và đa ngành số 1 Việt Nam
MimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/vnd.ms-excel.sheet.macroEnabled.12;application/vnd.openxmlformats-officedocument.presentationml.presentation;application/vnd.ms-excel;text/csv;application/pdf;text/markdown;text/html;
Categories=Office;WordProcessor;Spreadsheet;Presentation;
`;
fs.writeFileSync(path.join(APPS_DIR, 'lycero-office.desktop'), desktopContent, 'utf8');

// 3. Setup icons
const ICONS_SOURCE_DIR = path.join(ROOT_DIR, 'apps', 'shell', 'build', 'icons');
const SIZES = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512', '1024x1024'];
for (const sz of SIZES) {
  const iconSrc = path.join(ICONS_SOURCE_DIR, `${sz}.png`);
  if (fs.existsSync(iconSrc)) {
    const iconDestDir = path.join(DATA_DIR, 'usr', 'share', 'icons', 'hicolor', sz, 'apps');
    fs.mkdirSync(iconDestDir, { recursive: true });
    fs.copyFileSync(iconSrc, path.join(iconDestDir, 'lycero-office.png'));
  }
}

// 4. Calculate md5sums
console.log('[DEB-BUILDER] Calculating md5sums...');
function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(res));
    } else {
      files.push(res);
    }
  }
  return files;
}

const allDataFiles = getFiles(DATA_DIR);
let totalInstalledSize = 0;
const md5Lines = [];
for (const file of allDataFiles) {
  const stat = fs.statSync(file);
  totalInstalledSize += stat.size;
  const content = fs.readFileSync(file);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const relPath = path.relative(DATA_DIR, file).replace(/\\/g, '/');
  md5Lines.push(`${hash}  ${relPath}`);
}
fs.writeFileSync(path.join(CONTROL_DIR, 'md5sums'), md5Lines.join('\n') + '\n', 'utf8');

const installedSizeKb = Math.ceil(totalInstalledSize / 1024);

// 5. Setup control file
const controlContent = `Package: lycero-office
Version: 1.0.0
License: Apache-2.0
Vendor: ITAC AI Heavy Industries <contact@itac.ai>
Architecture: amd64
Maintainer: ITAC AI Heavy Industries <contact@itac.ai>
Installed-Size: ${installedSizeKb}
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Section: default
Priority: optional
Homepage: https://lycero.com/office
Description: 
  Unified Lycero Office shell: Nền tảng văn phòng AI sư phạm và chuyên ngành số 1 Việt Nam.
`;
fs.writeFileSync(path.join(CONTROL_DIR, 'control'), controlContent, 'utf8');

// 6. Setup postinst & postrm
const postinstContent = `#!/bin/sh
set -e
launcher="/opt/lycero-office/resources/cli/lycero-office"
if [ -x "$launcher" ]; then
  ln -sf "$launcher" /usr/bin/lycero-office
  ln -sf "$launcher" /usr/bin/lycero
fi
app="/opt/lycero-office/lycero-office"
if [ -x "$app" ]; then
  ln -sf "$app" /usr/local/bin/lycero-office || true
fi
exit 0
`;
fs.writeFileSync(path.join(CONTROL_DIR, 'postinst'), postinstContent, 'utf8');

const postrmContent = `#!/bin/sh
case "$1" in
  0|remove|purge) ;;
  *) exit 0 ;;
esac
rm -f /usr/bin/lycero-office /usr/bin/lycero /usr/local/bin/lycero-office || true
exit 0
`;
fs.writeFileSync(path.join(CONTROL_DIR, 'postrm'), postrmContent, 'utf8');

// 7. Compress control.tar.xz and data.tar.xz using tar.exe
console.log('[DEB-BUILDER] Compressing control.tar.xz...');
const controlTarXz = path.join(STAGING_DIR, 'control.tar.xz');
execFileSync('tar.exe', ['-cJf', controlTarXz, '-C', CONTROL_DIR, '.'], { stdio: 'inherit' });

console.log('[DEB-BUILDER] Compressing data.tar.xz (this may take 1-2 minutes)...');
const dataTarXz = path.join(STAGING_DIR, 'data.tar.xz');
execFileSync('tar.exe', ['-cJf', dataTarXz, '-C', DATA_DIR, '.'], { stdio: 'inherit' });

// 8. Assemble .deb using standard AR format
console.log('[DEB-BUILDER] Assembling AR container for .deb...');
function makeAr(entries) {
  const parts = [Buffer.from('!<arch>\n', 'latin1')];
  for (const { name, data } of entries) {
    const header = Buffer.alloc(60, ' ');
    const id = name.endsWith('/') ? name : name + '/';
    header.write(id, 0, 'latin1');
    header.write('0', 16, 'latin1');
    header.write('0', 28, 'latin1');
    header.write('0', 34, 'latin1');
    header.write('100644', 40, 'latin1');
    header.write(String(data.length), 48, 'latin1');
    header[58] = 0x60;
    header[59] = 0x0a;
    parts.push(header);
    parts.push(data);
    if (data.length % 2 === 1) {
      parts.push(Buffer.from('\n', 'latin1'));
    }
  }
  return Buffer.concat(parts);
}

const debEntries = [
  { name: 'debian-binary', data: Buffer.from('2.0\n', 'latin1') },
  { name: 'control.tar.xz', data: fs.readFileSync(controlTarXz) },
  { name: 'data.tar.xz', data: fs.readFileSync(dataTarXz) }
];

const debBuffer = makeAr(debEntries);
fs.writeFileSync(OUTPUT_DEB, debBuffer);
fs.writeFileSync(OUTPUT_DEB_SHELL, debBuffer);

console.log(`[DEB-BUILDER] SUCCESS! Built ${OUTPUT_DEB} (${(debBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

// Clean staging directory to preserve disk space
fs.rmSync(STAGING_DIR, { recursive: true, force: true });
console.log('[DEB-BUILDER] Cleaned temporary staging directory.');
