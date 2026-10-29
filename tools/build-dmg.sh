#!/usr/bin/env bash
set -e

ARCH=$1 # "x64" or "arm64"
SRC_DMG=""
OUT_DMG=""

if [ "$ARCH" = "arm64" ]; then
  SRC_DMG="/work/GenOffice-0.10.488-arm64.dmg"
  OUT_DMG="/work/Lycero-Office-1.0.0-arm64.dmg"
else
  SRC_DMG="/work/GenOffice-0.10.488.dmg"
  OUT_DMG="/work/Lycero-Office-1.0.0-x64.dmg"
fi

echo "[DMG-BUILDER] Processing $ARCH from $SRC_DMG -> $OUT_DMG..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq p7zip-full genisoimage sed > /dev/null

TMP_DIR="/tmp/dmg_$ARCH"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/extract" "$TMP_DIR/staging"

echo "[DMG-BUILDER] Extracting base DMG..."
7z x "$SRC_DMG" -o"$TMP_DIR/extract" -y > /dev/null

# Locate .app directory
APP_DIR=$(find "$TMP_DIR/extract" -name "*.app" -type d | head -n 1)
echo "[DMG-BUILDER] Found app at $APP_DIR"

DEST_APP="$TMP_DIR/staging/Lycero Office.app"
mv "$APP_DIR" "$DEST_APP"

echo "[DMG-BUILDER] Replacing app.asar and legal notices..."
cp /repo/apps/shell/release/win-unpacked/resources/app.asar "$DEST_APP/Contents/Resources/app.asar"
cp /repo/apps/shell/release/win-unpacked/resources/THIRD-PARTY-NOTICES.txt "$DEST_APP/Contents/Resources/THIRD-PARTY-NOTICES.txt"

# Update app-update.yml
cat << 'EOF' > "$DEST_APP/Contents/Resources/app-update.yml"
provider: generic
url: https://releases.lycero.com/desktop
channel: latest
EOF

# Update Info.plist
echo "[DMG-BUILDER] Updating Info.plist..."
sed -i 's|<string>GenOffice</string>|<string>Lycero Office</string>|g' "$DEST_APP/Contents/Info.plist"
sed -i 's|<string>ai.genspark.office</string>|<string>vn.lycero.office</string>|g' "$DEST_APP/Contents/Info.plist"
sed -i 's|<string>Copyright  2026 Mainfunc, Inc.</string>|<string>Copyright  2026 ITAC AI Heavy Industries. All rights reserved.</string>|g' "$DEST_APP/Contents/Info.plist"

# Add Applications symlink
ln -sf /Applications "$TMP_DIR/staging/Applications"

echo "[DMG-BUILDER] Packing DMG with genisoimage..."
rm -f "$OUT_DMG"
genisoimage -D -V "Lycero Office" -no-pad -r -apple -file-mode 0777 -o "$OUT_DMG" "$TMP_DIR/staging" > /dev/null

if [ "$ARCH" != "arm64" ]; then
  cp "$OUT_DMG" "/work/Lycero-Office-1.0.0.dmg"
fi

rm -rf "$TMP_DIR"
echo "[DMG-BUILDER] SUCCESS! Built $OUT_DMG ($(du -h "$OUT_DMG" | cut -f1))"
