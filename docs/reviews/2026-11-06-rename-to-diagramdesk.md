# Rename to DiagramDesk

- Date: 2026-11-06
- Decision: the owner renamed the product from Mermaid Tool to DiagramDesk, because it offers much more than a plain Mermaid editor, and should stand alone and say clearly what it does
- Branch: `installers/0.2.3`

## What Changed

| Item | Before | After |
| --- | --- | --- |
| Product name | Mermaid Tool | DiagramDesk |
| npm package | `mermaid-tool` | `diagramdesk` |
| App ID | `com.adamgoodwin.mermaidtool` | `com.adamgoodwin.diagramdesk` |
| Renderer API | `window.mermaidTool` | `window.diagramDesk` |
| Windows drafts | `%APPDATA%\Mermaid Tool\drafts\` | `%APPDATA%\DiagramDesk\drafts\` |
| macOS drafts | `~/Library/Application Support/Mermaid Tool/drafts/` | `~/Library/Application Support/DiagramDesk/drafts/` |
| Linux drafts | `~/.config/Mermaid Tool/drafts/` | `~/.config/DiagramDesk/drafts/` |
| Default save folder | `Documents/Mermaid Tool` | `Documents/DiagramDesk` |
| Windows installer | `Mermaid-Tool-<version>-win-x64-setup.exe` | `DiagramDesk-<version>-win-x64-setup.exe` |
| macOS installers | `Mermaid-Tool-<version>-mac-<arch>.dmg` and `.zip` | `DiagramDesk-<version>-mac-<arch>.dmg` and `.zip` |
| Linux installers | `Mermaid Tool-<version>-x86_64.AppImage` and `-amd64.deb` | `DiagramDesk-<version>-x86_64.AppImage` and `-amd64.deb` |
| Linux executable | `/opt/Mermaid Tool/mermaid-tool` | `/opt/DiagramDesk/diagramdesk` |
| Linux launcher | `mermaid-tool.desktop` | `diagramdesk.desktop` |
| Linux scripts | `bin/launch-mermaid-tool.sh`, `bin/desktop-launch-mermaid-tool.sh` | `bin/launch-diagramdesk.sh`, `bin/desktop-launch-diagramdesk.sh` |
| Linux file types | `mermaid-tool.xml` | `diagramdesk.xml` |
| Linux launcher log | `~/.local/state/mermaid-tool/` | `~/.local/state/diagramdesk/` |
| App icon and header badge | An M | A D drawn as a small diagram, in the same colors |
| Homepage in `package.json` | mermaid.js.org | This product's GitHub repo |

## What Stays

"Mermaid" stays wherever it means the engine or its file format, because those are accurate:

- the `mermaid` dependency, and the credit in the README and app description
- the `.mmd` and `.mermaid` file associations, and the `text/x-mermaid` and `application/x-mermaid` file types
- the "Mermaid Diagram" file type label, and the "Mermaid Diagram" preview heading for types the app doesn't recognize
- instructions to the AI model, which has to write Mermaid
- changelog entries from before the rename

The Guided AI Labs logo and "Guided AI Labs Studio" in the header also stay. They name the maker, and changing them wasn't part of this decision.

## Other Projects

Nothing outside this repo needs changing:

| Where | Mention | Action |
| --- | --- | --- |
| `03. Websites/01. Guided AI Labs/docs/current-build-pathway.md` | Build log from May 2026 listing curated repos | Leave, as history. GitHub redirects the old link. If the site's live "From the workbench" strip shows the repo, check its label after the GitHub rename |
| `Enhanced Graphify/docs/relationship-map-plan.md` | Planning example | Leave |
| `Enhanced Graphify/docs/video-script-obsidian-vs-cockpit.md` | Example in a video script | Update if that script gets recorded |
| `DirectLink/repos/v0.3.x/.../mermaidWebViewBundle.generated.ts` | `mermaidTooltip` | False match, unrelated |

## Steps for the Owner

These are visible to others, so they wait for the owner:

1. Check DiagramDesk in the Canadian and US trademark databases. Earlier searches covered GitHub, the web, and domains, not trademarks.
2. Merge this branch to `main`.
3. Rename the GitHub repo to `Adamgdwn/diagramdesk`. GitHub redirects the old URL, including for existing clones, until something else takes that name.
4. Update the repo description, and add topics such as `mermaid`, `diagrams`, and `local-ai`, so people searching for Mermaid can still find it.
5. Rename the local folder `02. Mermaid Tool` when nothing is using it. Claude Code keeps this project's memory under a folder named after the old path, so move or re-save that memory afterwards.

## Steps for Linux

Linux was offline during the rename, and it's the only computer known to have real Mermaid Tool data. Nothing on Windows needs moving: it has no install, drafts, or saved diagrams under the old name. The Mac wasn't checked.

Ask Adam before installing or removing an app. Keep everything under the old folders until Adam has seen the result.

1. **Find the checkout.** Look for the clone with `Adamgdwn/mermaid-tool` or `Adamgdwn/diagramdesk` as its remote. Run `git status`, and don't pull over uncommitted work.
2. **Close the app, and record what exists.**

   ```bash
   ls -la ~/.config/"Mermaid Tool"/drafts ~/Documents/"Mermaid Tool" 2>/dev/null
   ls ~/.local/share/applications/ | grep -i mermaid
   dpkg -s mermaid-tool 2>/dev/null | head -3
   ```

3. **Get the code.** Use `main` if the rename has merged, otherwise `installers/0.2.3`. Then run `npm ci`, `npm run build`, and `npm run test:smoke`.
4. **Replace the launcher.** `npm run install:desktop` adds `diagramdesk.desktop` and `diagramdesk.xml`, and removes `mermaid-tool.desktop`, `mermaid-tool-dev.desktop`, and `mermaid-tool.xml`.
5. **Replace the system package, if there is one.** If step 2 found it, and Adam agrees, run `sudo dpkg -r mermaid-tool`. The new package has a different name, so it won't replace the old one by itself.
6. **Bring the recovery drafts across, so they appear in the new app.** Copy rather than move, and only with the app closed:

   ```bash
   mkdir -p ~/.config/DiagramDesk/drafts
   cp -n ~/.config/"Mermaid Tool"/drafts/*.json ~/.config/DiagramDesk/drafts/ 2>/dev/null
   ```

7. **Leave saved diagrams where they are, unless Adam says otherwise.** New files now default to `~/Documents/DiagramDesk`, and `~/Documents/Mermaid Tool` still opens normally. Drafts remember their file's full path, so moving that folder would disconnect any draft of a file in it.
8. **Update the remote after the GitHub rename.** Run `git remote set-url origin` with the new `Adamgdwn/diagramdesk` URL, in the same form (HTTPS or SSH) as the current one. The old URL keeps redirecting, so this isn't urgent.
9. **If the checkout folder gets renamed, run `npm run install:desktop` again,** because the launcher stores an absolute path.
10. **Check it on the real desktop.**
    - DiagramDesk launches from the applications menu, and only one launcher appears
    - the D icon shows in the menu and the window
    - double-clicking a `.mmd` file opens it in DiagramDesk
    - recovered drafts appear as tabs
    - a PNG export shows the labels, and Copy Image pastes into another app
11. **Report back.** Post the results on issue #1 of `Adamgdwn/directlink`, and add them to `/home/adamgoodwin/DirectLink/Exchange/DIRECTLINK_CURRENT.md`.
