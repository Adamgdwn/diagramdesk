# Rename to DiagramDesk

- Date: 2026-11-06
- Decision: the owner renamed the product from Mermaid Tool to DiagramDesk, because it offers much more than a plain Mermaid editor, and should stand alone and say clearly what it does
- Branch: `installers/0.2.3`, merged to `main` at `fe4d046` and since deleted

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

These are visible to others, so they waited for the owner. All five were finished on 2026-11-06:

1. Check DiagramDesk in the Canadian and US trademark databases. Earlier searches covered GitHub, the web, and domains, not trademarks. **Done:** Adam reports no conflict.
2. Merge this branch to `main`. **Done:** `main` fast-forwarded from `e35ee01` to `fe4d046`, and [CI passed](https://github.com/Adamgdwn/diagramdesk/actions/runs/42298257175).
3. Rename the GitHub repo to `Adamgdwn/diagramdesk`. GitHub redirects the old URL, including for existing clones, until something else takes that name. **Done.**
4. Update the repo description, and add topics such as `mermaid`, `diagrams`, and `local-ai`, so people searching for Mermaid can still find it. **Done.**
5. Rename the local folder `02. Mermaid Tool` when nothing is using it. Claude Code keeps this project's memory under a folder named after the old path, so move or re-save that memory afterwards. **Done:** the folder is now `02. DiagramDesk`, the memory is copied across, and the originals are removed.

Adam also explicitly approved the new D icon, as R-006 asks, and chose to publish [Release v0.2.3](https://github.com/Adamgdwn/diagramdesk/releases/tag/v0.2.3) from `fe4d046` before trying an installer downloaded through a browser. That test is still open, along with the checks on a physical Mac and a real Linux desktop.

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

3. **Get the code.** Use `main`. Then run `npm ci`, `npm run build`, and `npm run test:smoke`.
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

## 2026-11-08 - Linux Result

Done on the Linux laptop with Adam's go-ahead. The checkout there is `/home/adamgoodwin/01. Code/02. Applications/DiagramDesk`, which Adam renamed from `mermaid-tool`; step 5 above names the Windows folder.

| Step | Result |
| --- | --- |
| 1. Checkout | No uncommitted work. `main` fast-forwarded from `e35ee01` to `6e5f670`. |
| 2. What existed | One live draft from 2026-09-08, a draft set aside in May as `4121786d-…json.bak-20260517154347`, and a stray `Eady Draft Doc Flows.mmd` in the drafts folder. Five saved diagrams in `~/Documents/Mermaid Tool`. A user launcher, `mermaid-tool.desktop`, already broken by the folder rename. The `mermaid-tool` 0.2.1 package in `/opt/Mermaid Tool`, with its own launcher. |
| 3. Code | `npm ci`, lint, 39 unit tests, the build, and every smoke step pass. |
| 4. Launcher | Two bugs found and fixed first, below. `diagramdesk.desktop` and `diagramdesk.xml` are installed, and the old launcher and file type are gone. |
| 5. System package | Adam agreed. `mermaid-tool` 0.2.1 was removed and purged, so `/opt/Mermaid Tool` and its launcher are gone. One launcher remains. |
| 6. Drafts | The live draft was copied unchanged. The May draft was restored too, with its tab renamed `recovered-2026-05-17.mmd` and its content unchanged. It doesn't render, because labels such as `[/learn/start-from-zero...]` read as a shape, which is probably why it was set aside. `AI Agency Flowchart.mmd`, saved the same day, looks like its later version. `Eady Draft Doc Flows.mmd` was copied to `~/Documents/DiagramDesk/`. |
| 7. Saved diagrams | Left in `~/Documents/Mermaid Tool`. |
| 8. Remote | `origin` is now `https://github.com/Adamgdwn/diagramdesk.git`. |
| 9. Launcher path | Installed from the renamed folder. |
| 10. Desktop check | Below. |
| 11. Report | Posted on issue #1 and in `DIRECTLINK_CURRENT.md`. |

### Bugs Found

- `npm run install:desktop` wrote `Exec=` without quotes, so on a path with spaces the launcher did nothing. The old launcher worked only because its quotes were added by hand in the September folder migration. Fixed in `248ee8d`.
- On COSMIC, `.mmd` files would still have opened with the removed launcher. `xdg-mime` only updates `mimeapps.list`, and COSMIC reads `cosmic-mimeapps.list` first. Fixed in `248ee8d`.
- A second launch, such as double-clicking a file while the app is open, handed the file over correctly but then opened a window of its own as it quit, which failed to load. Fixed in `9d6a582`, with a smoke step that starts a real second copy of the app.

### Desktop Check

| Check | Result |
| --- | --- |
| Launches from the menu, with one launcher | Started through its desktop entry with `gio launch`, from this checkout and with the new `~/.config/DiagramDesk` profile. `diagramdesk.desktop` is the only DiagramDesk or Mermaid entry in the user and system application folders. How the menu looks still needs Adam. |
| D icon in the menu and window | The entry's icon file exists, and the D shows in the app header. The menu and window icons still need Adam. |
| Double-clicking a `.mmd` file | `xdg-mime` and both user lists give `diagramdesk.desktop`. `gio open` on a saved diagram started a second launch, which quit as it should. The new smoke step confirms a second launch's file reaches the open window. The tab in the running app wasn't seen, so that still needs Adam. |
| Recovered drafts appear as tabs | Checked on a copy of the new drafts folder: both appear, and the status bar says "Recovered 2 draft tabs". |
| PNG export and Copy Image | The smoke test passes for both. Pasting into another app still needs Adam. |

Kept until Adam has looked: `~/.config/Mermaid Tool/`, which still holds the original drafts, and `~/Documents/Mermaid Tool/`. Removed: `release/`, with the 0.2.1 installers (774 MB, rebuildable from `da08938`); `~/.config/mermaid-tool`, an April development profile with no diagrams in it; and `.playwright-mcp/`. Copies of every launcher and file-type list changed, the package's records, and the old launcher log are in `~/.local/state/diagramdesk/changes/2026-11-08-rename/`.

If `.mmd` files stop opening in DiagramDesk after logging in again, check `xdg-mime query default text/x-mermaid` and `~/.config/cosmic-mimeapps.list` first, in case COSMIC rewrites its list.
