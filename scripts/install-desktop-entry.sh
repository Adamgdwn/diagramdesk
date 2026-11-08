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

# Desktop launchers split Exec on spaces, so the path is quoted below. These characters would also
# need escaping inside the quotes, and no real checkout path has them, so refuse rather than write a broken launcher.
case "${desktop_launcher_path}" in
  *[\"\`\$\\%]*)
    echo "This checkout's path contains one of \" \` \$ \\ %, which a desktop launcher can't use: ${repo_root}" >&2
    echo "Move the checkout to a path without them, then rerun npm run install:desktop." >&2
    exit 1
    ;;
esac

mkdir -p "${desktop_dir}"
mkdir -p "${mime_dir}"

install -m 0644 "${mime_source}" "${mime_target}"

cat > "${desktop_file}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DiagramDesk
Comment=Local diagram app with live preview and export, built on Mermaid
Exec="${desktop_launcher_path}" %F
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

# File-type choices made for the old launcher would otherwise point at nothing. xdg-mime only updates
# mimeapps.list, and desktops such as COSMIC read their own list first, like cosmic-mimeapps.list.
config_dir="${XDG_CONFIG_HOME:-${HOME}/.config}"
for mimeapps_list in "${config_dir}"/*mimeapps.list "${desktop_dir}/mimeapps.list"; do
  if [[ -f "${mimeapps_list}" ]] && grep -qE '(^|[=;])mermaid-tool(-dev)?\.desktop(;|$)' "${mimeapps_list}"; then
    sed -i -E ':again; s/(^|[=;])mermaid-tool(-dev)?\.desktop(;|$)/\1diagramdesk.desktop\3/; t again' "${mimeapps_list}"
  fi
done

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
