#!/usr/bin/env bash
set -e

cd /tmp
echo "[APPIMAGE-BUILDER] Extracting base AppImage..."
/work/GenOffice-0.10.488.AppImage --appimage-extract > /dev/null

echo "[APPIMAGE-BUILDER] Updating binaries and resources with Lycero Office..."
# Copy new app.asar
cp /repo/apps/shell/release/linux-unpacked/resources/app.asar squashfs-root/resources/app.asar
cp /repo/apps/shell/release/linux-unpacked/resources/THIRD-PARTY-NOTICES.txt squashfs-root/resources/THIRD-PARTY-NOTICES.txt
cat << 'EOF' > squashfs-root/resources/app-update.yml
provider: generic
url: https://releases.lycero.com/desktop
channel: latest
EOF

# Copy lycero-office binary
cp /repo/apps/shell/release/linux-unpacked/lycero-office squashfs-root/lycero-office
chmod +x squashfs-root/lycero-office
rm -f squashfs-root/genoffice

# Patch AppRun
sed -i 's|BIN="$APPDIR/genoffice"|BIN="$APPDIR/lycero-office"|g' squashfs-root/AppRun

# Update desktop entry
cat << 'EOF' > squashfs-root/lycero-office.desktop
[Desktop Entry]
Name=Lycero Office
Exec=lycero-office %U
Terminal=false
Type=Application
Icon=lycero-office
StartupWMClass=lycero-office
Comment=Lycero Office: Bộ ứng dụng văn phòng AI đa năng thế hệ mới
MimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/vnd.ms-excel.sheet.macroEnabled.12;application/vnd.openxmlformats-officedocument.presentationml.presentation;application/vnd.ms-excel;text/csv;application/pdf;text/markdown;text/html;
Categories=Office;WordProcessor;Spreadsheet;Presentation;
EOF
rm -f squashfs-root/genoffice.desktop

# Update icons
for sz in 16x16 32x32 48x48 64x64 128x128 256x256 512x512 1024x1024; do
  if [ -f "/repo/apps/shell/build/icons/${sz}.png" ]; then
    mkdir -p "squashfs-root/usr/share/icons/hicolor/${sz}/apps"
    cp "/repo/apps/shell/build/icons/${sz}.png" "squashfs-root/usr/share/icons/hicolor/${sz}/apps/lycero-office.png"
    rm -f "squashfs-root/usr/share/icons/hicolor/${sz}/apps/genoffice.png"
  fi
done

cd squashfs-root
ln -sf usr/share/icons/hicolor/1024x1024/apps/lycero-office.png lycero-office.png
ln -sf usr/share/icons/hicolor/1024x1024/apps/lycero-office.png .DirIcon
rm -f genoffice.png
cd /tmp

echo "[APPIMAGE-BUILDER] Extracting runtime header (188392 bytes)..."
dd if=/work/GenOffice-0.10.488.AppImage of=/tmp/runtime bs=1 count=188392 2>/dev/null

echo "[APPIMAGE-BUILDER] Installing squashfs-tools..."
apt-get update -qq && apt-get install -y -qq squashfs-tools > /dev/null

echo "[APPIMAGE-BUILDER] Generating squashfs filesystem..."
mksquashfs squashfs-root /tmp/new.squashfs -comp xz -root-owned -noappend > /dev/null

echo "[APPIMAGE-BUILDER] Creating final AppImage..."
cat /tmp/runtime /tmp/new.squashfs > /work/Lycero-Office-1.0.0.AppImage
chmod +x /work/Lycero-Office-1.0.0.AppImage

echo "[APPIMAGE-BUILDER] Done! Generated /work/Lycero-Office-1.0.0.AppImage ($(du -h /work/Lycero-Office-1.0.0.AppImage | cut -f1))"
