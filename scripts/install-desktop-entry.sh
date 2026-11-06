#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
desktop_dir="${HOME}/.local/share/applications"
desktop_file="${desktop_dir}/diagramdesk.desktop"
desktop_launcher_path="${repo_root}/bin/desktop-launch-diagramdesk.sh"
icon_path="${repo_root}/assets/diagramdesk-icon.svg"
mime_source="${repo_root}/packaging/linux/mime/diagramdesk.xml"
mime_dir="${HOME}/.local/share/mime/packages"
mime_target="${mime_dir}/diagramdesk.xml"

mkdir -p "${desktop_dir}"
mkdir -p "${mime_dir}"

install -m 0644 "${mime_source}" "${mime_target}"

cat > "${desktop_file}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DiagramDesk
Comment=Local diagram app with live preview and export, built on Mermaid
Exec=${desktop_launcher_path} %F
Icon=${icon_path}
Terminal=false
Categories=Graphics;
MimeType=text/x-mermaid;application/x-mermaid;text/plain;
StartupNotify=true
StartupWMClass=DiagramDesk
EOF

chmod +x "${desktop_file}"
# The app was previously Mermaid Tool. Removing the old entries leaves one launcher and one file association.
rm -f "${desktop_dir}/mermaid-tool.desktop" "${desktop_dir}/mermaid-tool-dev.desktop" "${mime_dir}/mermaid-tool.xml"

if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database "${HOME}/.local/share/mime" >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${desktop_dir}" >/dev/null 2>&1 || true
fi

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default diagramdesk.desktop text/x-mermaid application/x-mermaid >/dev/null 2>&1 || true
fi

echo "Desktop entry installed at ${desktop_file}"
