# Manual

## What This Project Is

DiagramDesk is a Guided AI Labs local desktop editor for Mermaid diagram files. It is meant to feel approachable for someone who just wants to open a file, edit the diagram text, and export a good-looking visual without learning a bigger design toolchain.

## How To Work In This Repo

1. Run `bash scripts/governance-preflight.sh`. On Windows, run it from Git Bash.
2. Review `project-control.yaml`.
3. Install dependencies with `npm install`.
4. Use `npm run lint`, `npm run test`, `npm run build`, `npm run test:smoke`, and `npm run secret-scan` before considering the repo ready.
5. Update the docs when operator expectations, risks, or desktop workflow behavior change.

## Expected Outputs

- a working local Electron app on Windows, macOS, and Linux
- built assets in `dist/`
- installers in `release/`
- on Linux, a launcher script in `bin/` and a desktop entry installed through `npm run install:desktop`
- current operator and governance documentation

## Operator Notes

- `npm run start` builds the renderer and Electron code before launch, on every system.
- `npm run package:win`, `npm run package:mac`, and `npm run package:linux` produce installers. Each must run on its own system, or through the manually started CI workflow.
- On Linux, `bin/launch-diagramdesk.sh` is the fastest repeat-launch path after dependencies are installed and rebuilds automatically when repo source files are newer than the built output.
- On Linux, `npm run install:desktop` writes `~/.local/share/applications/diagramdesk.desktop` so the repo checkout reuses the normal DiagramDesk desktop ID instead of publishing a second launcher. On other systems it only prints a note.
- The editor and every other part of the app load from bundled files, so the app makes no internet requests of its own and works offline.
- The app now supports multiple tabs per window and multiple windows at the same time.
- `Ctrl+W` or `Cmd+W` closes the active tab. `Ctrl+Shift+W` or `Cmd+Shift+W` closes the window.
- The left rail now includes a collapsible AI builder at the top of the sidebar.
- The sidebar keeps the same width whether the dialogue is open or closed, and the starter diagram chooser stays visible below it.
- The main toolbar is grouped by intent: start a diagram, keep work, share a visual, or use less-common maintenance actions.
- The app chrome uses the Guided AI Labs signal-spark brand treatment while preserving the existing DiagramDesk app icon.
- The AI builder uses local models only for now. It auto-detects Ollama, LM Studio, and other OpenAI-compatible local servers before the user has to think about endpoints.
- If no local model is available, the assistant area explains that AI is optional and shows setup guidance without blocking manual editing.
- Ollama still defaults to `http://127.0.0.1:11434`, while OpenAI-compatible local servers are checked on common local addresses such as LM Studio on `http://127.0.0.1:1234/v1` and `llama.cpp` on `http://127.0.0.1:8080/v1`.
- Selecting a starter diagram now opens the AI conversation with diagram-aware guidance instead of forcing the user to begin in raw Mermaid syntax.
- The AI builder can focus on the whole diagram or a detected node from the current Mermaid text, then draft a full updated Mermaid document for the editor.
- Inside the expanded dialogue, the transcript and prompt composer stay near the top of the frame so the conversation starts where the user is already looking.
- The app warns before replacing unsaved work in-editor and before closing the window with unsaved edits.
- In-progress edits autosave per tab to the Electron user-data folder and are recovered automatically on the next normal launch, but that recovery draft is not treated as the user's saved file.
- Each window keeps its own recovery drafts. A new window starts clean instead of copying another window's unsaved tabs. Once a window has closed, its drafts return in the next window opened or the next launch.
- A recovery draft that can't be read is moved to an `unreadable` folder inside the draft folder, and the status bar says so. The other drafts still recover.
- A failed save or open shows a message saying why. After a failed save the tab stays marked unsaved, so nothing is lost.
- Unsaved diagrams show a visible "File not chosen yet" location panel with direct `Save`, `Save As`, and disabled `Show Folder` controls.
- New file saves default to `Documents/DiagramDesk`, while existing saved files still default to their current folder.
- `Open` now starts in `Documents/DiagramDesk` by default so user-created files live in a normal documents location instead of hidden app data.
- Saved diagrams show their full file path in the editor and can be revealed with `Show Folder`.
- `Open` can import several files in one pass and adds them as tabs instead of replacing the active document.
- `Wipe` clears the current editor contents without deleting the file on disk until you save.
- `Delete File` permanently removes the current saved file from disk and then opens a fresh untitled document.
- `Full Screen` on the preview panel opens a presentation-style view and supports `Escape` to return.
- Drag the preview with any mouse button to pan around larger diagrams.
- Fullscreen preview now locks page scrolling so the canvas owns both horizontal and vertical grab-and-pan movement.
- On Windows and Linux, scroll over the preview canvas to zoom in or out around the cursor position.
- On a Mac, two-finger scrolling pans the preview. Pinch or Command+scroll to zoom around the cursor position.
- `Fit Width` is the best default reading mode for large diagrams, while `Whole` shows the entire graph bounds on one screen.
- Flowcharts use tighter spacing so complex diagrams waste less space in preview and fullscreen. The ELK layout engine is requested in settings but isn't installed, so Mermaid's standard layout does the work.
- Built-in templates are meant as onboarding shortcuts, not authoritative Mermaid examples for every syntax feature.
- The built-in templates focus on common business diagrams such as client journeys, support handoffs, launch plans, strategy maps, data models, and approval workflows.
- Export works best after the preview is green and rendering successfully.
- PNG exports use double resolution. A very large diagram is scaled down to fit, and the status bar says when that happens. SVG keeps full detail.
- On a large diagram the preview waits for a longer pause in typing, so the editor stays responsive.
- `Copy Image` places a PNG version of the current preview on the system clipboard for quick sharing in documents and messages.
- The Windows and macOS installers register `.mmd` and `.mermaid`. On Linux, `npm run install:desktop` registers them locally through the desktop database and MIME database.
