# Runbook

## Purpose

Operate and recover the local Mermaid Tool desktop application on a workstation.

## Alerts And Failures

- App will not launch from source: verify `node_modules/` exists and rerun `npm run build`. Electron downloads its runtime on first use, so the first launch needs internet access. Afterwards the app runs fully offline.
- App opens as plain Node or exits immediately from source: the `ELECTRON_RUN_AS_NODE` environment variable is set. `npm run start` clears it; launching Electron another way will not.
- Windows shows "Windows protected your PC": the installer isn't signed yet. Choose **More info**, then **Run anyway**.
- `npm run package:win` fails at the end with `spawn UNKNOWN`: Smart App Control blocked electron-builder's unsigned helper. Confirm in Event Viewer under **Applications and Services Logs > Microsoft > Windows > CodeIntegrity > Operational**, event 3077. Build through the CI workflow instead. Don't turn Smart App Control off just for this, because it may not be possible to turn it back on without resetting Windows. The unpacked app in `release/win-unpacked` is still usable for testing.
- macOS says the app can't be opened or is from an unidentified developer: go to **System Settings > Privacy & Security** and choose **Open Anyway**.
- macOS says the app is damaged: the build lost its ad-hoc signature, or the file was altered. Rebuild with `npm run package:mac`, and check `"identity": "-"` is still under `build.mac` in `package.json`.
- Linux desktop icon does nothing: rerun `npm run install:desktop` and confirm the launcher script is executable.
- Two Mermaid Tool launchers are visible on Linux: rerun `npm run install:desktop`, confirm only `~/.local/share/applications/mermaid-tool.desktop` exists locally, then refresh the desktop session cache if needed.
- `.mmd` file does not open in Mermaid Tool: on Windows and macOS, reinstall the app or use **Open with** to choose it. On Linux, rerun `npm run install:desktop` or reinstall the Debian package to refresh MIME registration.
- A shell script fails with `bad interpreter` or `$'\r'`: it was checked out with Windows line endings. `.gitattributes` prevents this for new checkouts. For an existing one, run `git rm --cached -r . && git reset --hard`, which discards uncommitted changes.
- Preview fails: inspect the Mermaid syntax in the editor and confirm the preview pane shows a valid render.
- AI builder cannot find models: confirm at least one supported local runtime is running, then refresh the model list in the left rail.
- Ollama checks `http://127.0.0.1:11434/api/tags` by default, LM Studio checks its OpenAI-compatible local server, and `llama.cpp` or similar servers are expected to expose `/v1/models`.
- AI dialogue layout feels wrong: confirm the repo build is the version being launched, then verify the dialogue collapses upward at the top of the left sidebar while starter diagram cards remain visible underneath.
- Guided AI Labs branding looks stale or missing: rerun `npm run build`, confirm `assets/guided-ai-labs-signal-spark.svg` is present, and confirm the launched app is using the rebuilt `dist/` output.
- Mermaid Tool icon looks wrong: confirm `assets/mermaid-tool-icon.svg` and `scripts/generate-icons.py` were not changed, then regenerate package icons only if packaging output is stale.
- Export fails: confirm the preview is healthy first, then retry SVG or PNG export.
- File open or save fails: confirm the target path is writable and the file still exists.
- Unsaved work is confusing: confirm the editor location panel says "File not chosen yet"; recovery drafts live in hidden app data, while user-created saves default to `Documents/Mermaid Tool`.
- Autosave recovery looks wrong, or the status bar says "Startup recovery failed": inspect the per-tab draft files in the draft folder listed below. Remove stale `.json` entries you do not want restored, and any that are empty or truncated, because one unreadable draft currently stops all drafts from being recovered.
- Packaged install problems: inspect `release/` artifacts and re-run package generation. On Linux, also confirm `dpkg -i` completed.

## Where Files Live

| Location | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Recovery drafts | `%APPDATA%\Mermaid Tool\drafts\` | `~/Library/Application Support/Mermaid Tool/drafts/` | `~/.config/Mermaid Tool/drafts/` |
| Saved diagrams, by default | `Documents\Mermaid Tool\` | `~/Documents/Mermaid Tool/` | `~/Documents/Mermaid Tool/` |

## Dependencies

- Node.js 24+
- npm 11+
- local `node_modules` installation
- Electron runtime, downloaded into the local dependency tree on first use
- Python 3, only for generating icons when packaging
- Git Bash on Windows, only for `scripts/governance-preflight.sh`
- on Linux: desktop entry support in `~/.local/share/applications` for launcher installation
- on Linux: `update-desktop-database`, `update-mime-database`, and `xdg-mime` for richer desktop integration when available

## Recovery

1. Run `bash scripts/governance-preflight.sh`.
2. Run `npm install` if dependencies are missing or out of sync.
3. Run `npm run lint`, `npm run test`, `npm run build`, `npm run test:smoke`, and `npm run secret-scan`.
4. Run `npm run package:win`, `npm run package:mac`, or `npm run package:linux` if the issue is specific to installers.
5. Remove `dist/` and `release/` and rebuild if launch or package assets look stale.
6. On Linux, reinstall the launcher with `npm run install:desktop`.
7. Confirm the Guided AI Labs lockup appears in the header and the Mermaid Tool app icon still uses the existing icon artwork.
8. Remove abandoned draft `.json` files from the draft folder if the app keeps restoring work you no longer want.

## Escalation

- Owner: Adam Goodwin
- Technical lead for this implementation snapshot: codex session
- Escalate when validation fails repeatedly, when local file writes are unreliable, or when dependency vulnerability exposure materially changes
