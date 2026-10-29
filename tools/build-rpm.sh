#!/usr/bin/env bash
set -e

echo "[RPM-BUILDER] Installing rpm and build dependencies..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq rpm cpio > /dev/null

RPM_ROOT="/tmp/rpmbuild"
rm -rf "$RPM_ROOT"
mkdir -p "$RPM_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS,BUILDROOT}

cat << 'EOF' > "$RPM_ROOT/SPECS/lycero-office.spec"
%define _binary_payload w19.zstdio
%define __os_install_post %{nil}
%define _build_id_links none

Name: lycero-office
Version: 1.0.0
Release: 1
Summary: Lycero Office - AI-native office suite
License: Apache-2.0
URL: https://lycero.com
Vendor: ITAC AI Heavy Industries
Packager: ITAC AI Heavy Industries <contact@itac.ai>
Group: Applications/Productivity
AutoReqProv: no

%description
Lycero Office: Bo ung dung van phong AI su pham va da nganh so 1 Viet Nam do ITAC AI Heavy Industries phat trien.

%install
mkdir -p %{buildroot}/opt/lycero-office
cp -a /repo/apps/shell/release/linux-unpacked/* %{buildroot}/opt/lycero-office/

mkdir -p %{buildroot}/usr/share/applications
cat << 'DESK' > %{buildroot}/usr/share/applications/lycero-office.desktop
[Desktop Entry]
Name=Lycero Office
Exec=/opt/lycero-office/lycero-office %U
Terminal=false
Type=Application
Icon=lycero-office
StartupWMClass=lycero-office
Comment=Lycero Office: Bo ung dung van phong AI su pham va da nganh so 1 Viet Nam
MimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/vnd.ms-excel.sheet.macroEnabled.12;application/vnd.openxmlformats-officedocument.presentationml.presentation;application/vnd.ms-excel;text/csv;application/pdf;text/markdown;text/html;
Categories=Office;WordProcessor;Spreadsheet;Presentation;
DESK

for sz in 16x16 32x32 48x48 64x64 128x128 256x256 512x512 1024x1024; do
  if [ -f "/repo/apps/shell/build/icons/${sz}.png" ]; then
    mkdir -p "%{buildroot}/usr/share/icons/hicolor/${sz}/apps"
    cp "/repo/apps/shell/build/icons/${sz}.png" "%{buildroot}/usr/share/icons/hicolor/${sz}/apps/lycero-office.png"
  fi
done

%post
launcher="/opt/lycero-office/resources/cli/lycero-office"
if [ -x "$launcher" ]; then
  ln -sf "$launcher" /usr/bin/lycero-office
  ln -sf "$launcher" /usr/bin/lycero
fi
app="/opt/lycero-office/lycero-office"
if [ -x "$app" ]; then
  ln -sf "$app" /usr/local/bin/lycero-office || true
fi

%postun
if [ "$1" = "0" ]; then
  rm -f /usr/bin/lycero-office /usr/bin/lycero /usr/local/bin/lycero-office || true
fi

%files
/opt/lycero-office
/usr/share/applications/lycero-office.desktop
/usr/share/icons/hicolor/*/apps/lycero-office.png
EOF

echo "[RPM-BUILDER] Running rpmbuild..."
rpmbuild --define "_topdir $RPM_ROOT" -bb "$RPM_ROOT/SPECS/lycero-office.spec"

BUILT_RPM=$(find "$RPM_ROOT/RPMS" -name "*.rpm" | head -n 1)
if [ -f "$BUILT_RPM" ]; then
  cp "$BUILT_RPM" /work/lycero-office-1.0.0.x86_64.rpm
  echo "[RPM-BUILDER] SUCCESS! Built /work/lycero-office-1.0.0.x86_64.rpm ($(du -h /work/lycero-office-1.0.0.x86_64.rpm | cut -f1))"
else
  echo "[RPM-BUILDER] Error: RPM was not created"
  exit 1
fi

rm -rf "$RPM_ROOT"
