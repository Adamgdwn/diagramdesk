# Deployment Guide

## Environments

- `dev`: source checkout with validation commands run locally
- `staging`: locally built app launched from `dist/` for smoke testing
- `prod`: launcher installed for day-to-day desktop use on the target machine

This project is a local desktop app, so deployment means preparing a machine to run the built Electron app reliably.

## Deployment Steps

1. Run `bash scripts/governance-preflight.sh`. On Windows, run it from Git Bash, because `bash` in PowerShell can start WSL instead.
2. Run `npm install`.
3. Run `npm run lint`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Run `npm run test:smoke` to drive the built app with all remote hosts blocked.
7. Generate installers in `release/`. Python 3 is required, and each command must run on its own system:
   - Windows: `npm run package:win`
   - macOS: `npm run package:mac`
   - Linux: `npm run package:linux`
8. Install using the section for your system below.
9. If you want the AI builder, start at least one supported local runtime before smoke testing:
   - Ollama on `http://127.0.0.1:11434`
   - LM Studio on `http://127.0.0.1:1234/v1`
   - `llama.cpp` or another OpenAI-compatible local server on a reachable `/v1` endpoint

### Windows

Run `release/Mermaid-Tool-<version>-win-x64-setup.exe`. It installs for the current user without administrator rights by default, and offers a choice of folder.

The installer isn't signed, by owner decision, because the app is free. SmartScreen may show "Windows protected your PC". Choose **More info**, then **Run anyway**.

On a PC with Smart App Control on, an unsigned installer may be blocked with no override. The CI-built installer did open its wizard on such a PC, but that copy wasn't downloaded through a browser, which adds a mark Windows can treat differently. The same setting stops `npm run package:win` from finishing, because electron-builder has to run an unsigned helper. On such a PC, build the installer through CI instead.

### macOS

Open `release/Mermaid-Tool-<version>-mac-arm64.dmg` on Apple Silicon or `-x64.dmg` on Intel, then drag the app to Applications.

The app has only an ad-hoc signature, because Apple's Developer ID requires a paid membership. macOS blocks it on first launch: try to open it, then go to **System Settings > Privacy & Security** and choose **Open Anyway**.

If that decision ever changes, replace `"identity": "-"` under `build.mac` in `package.json` with the Developer ID identity, then add notarization.

### Linux

Choose one:

- `npm run install:desktop` for the local source checkout flow
- `sudo dpkg -i "release/Mermaid Tool-<version>-amd64.deb"` for a system package
- `chmod +x "release/Mermaid Tool-<version>-x86_64.AppImage"` and launch the AppImage directly

Then launch `Mermaid Tool` from the applications menu, the installed package, the AppImage, or `bin/launch-mermaid-tool.sh`.

## Continuous Integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main` or to a branch under `installers/`, skipping documentation-only changes:

- `checks`: preflight, lint, typecheck, unit tests, and secret scan on Linux
- `smoke`: build and smoke test on Linux, Windows, and macOS, only after `checks` passes
- `package`: builds installers for all three systems, keeps them for 7 days, then installs them and smoke tests what they installed. It runs only on a branch under `installers/`, or when started by hand from the Actions tab with the `package` option. GitHub only offers the hand-started route once the workflow is on `main`

To download installers from a run, use the run's page on the Actions tab, or `gh run download <run-id>`. Publish anything meant for users as a GitHub Release, because these copies expire.

Standard GitHub-hosted runners are free for public repositories. If this repository becomes private, Windows and especially macOS minutes become metered, so review the workflow's triggers and matrix first. To undo, delete the workflow file.

## Rollback

Windows: uninstall Mermaid Tool from **Settings > Apps > Installed apps**.

macOS: delete Mermaid Tool from Applications.

Linux:

1. Remove the desktop entry at `~/.local/share/applications/mermaid-tool.desktop` if installed.
2. Remove `~/.local/share/mime/packages/mermaid-tool.xml` and refresh MIME caches if reverting local file association.
3. Uninstall the Debian package with `sudo dpkg -r mermaid-tool` if it was installed system-wide.

All systems:

1. Remove `dist/` and `release/` to clear the current build artifacts.
2. Reinstall dependencies or restore the previous source snapshot if needed.
3. Rebuild and reinstall the launcher or package once the rollback target is ready.

Uninstalling does not remove recovery drafts or saved diagrams. See `docs/runbook.md` for where they live.

## Validation

- confirm the app launches without renderer errors
- disconnect from the network, launch, and confirm the editor still loads
- confirm the Guided AI Labs signal-spark lockup appears in the app chrome while the Mermaid Tool app icon remains unchanged
- open one or more sample `.mmd` files
- change the text and verify the preview refreshes
- save the file and confirm disk changes
- confirm `Open` starts in the expected local draft/save folder
- open several files and confirm they appear as tabs instead of replacing one another
- create a second window and confirm it stays independent from the first
- wipe the editor and confirm a blank document can be saved cleanly
- delete a saved test file and confirm the app returns to an untitled document
- open the preview in fullscreen and confirm `Escape` returns to the normal layout
- drag the preview canvas and confirm large diagrams pan smoothly
- on Windows and Linux, scroll over the preview canvas and confirm zoom follows the cursor in normal and fullscreen modes
- on a Mac, confirm two-finger scrolling pans, and pinch or Command+scroll zooms around the cursor
- use `Fit Width` and `Whole` and confirm large diagrams can be reviewed both as a readable document and as a full-map overview
- export both SVG and PNG, and confirm the PNG shows the labels and the whole diagram
- confirm the app fits the window at the default and minimum sizes, with the diagram visible on launch
- type `flowchart TD` then Enter in a new tab, and confirm the cursor moves to a new line
- on Linux, confirm the desktop launcher opens the app from the menu
- on Linux, confirm only one Mermaid Tool launcher is shown when the local desktop entry overrides the packaged app
- confirm `.mmd` and `.mermaid` open in Mermaid Tool after installation, both with the app closed and with it already running
- confirm packaged metadata still uses the Mermaid Tool product name with the Guided AI Labs desktop comment
- confirm dirty tabs recover after relaunch
- confirm the AI builder can discover at least one supported local runtime when one is running
- confirm the AI dialogue collapses upward while starter diagram cards remain visible in the sidebar
- confirm `Ctrl+W` or `Cmd+W` closes only the active tab, and `Ctrl+Shift+W` or `Cmd+Shift+W` closes the window
- on a Mac, confirm the first menu is named Mermaid Tool and holds About and Quit
- confirm the installer for each system runs cleanly: the Windows setup, the macOS `.dmg`, the Linux AppImage, and the `.deb`
