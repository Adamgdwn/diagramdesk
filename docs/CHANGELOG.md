# Change Log

## 0.2.3 - Unreleased

The first Windows and macOS build. Nothing has been published under this number yet, so the items recorded under it in April 2026 are included here.

- fixed PNG export and Copy Image, which lost labels and cropped nearly every diagram; they now match the preview, and the `canvg` dependency is gone
- fixed Enter being taken by a word-suggestion popup after typing `flowchart TD`, by turning those suggestions off
- fixed characters being lost while typing on large diagrams, and made the preview wait for a longer pause on diagrams that are slow to draw
- made recovery drafts safe against crashes during a write, and made an unreadable draft move to an `unreadable` folder instead of blocking all recovery
- stopped autosave rewriting drafts every second when nothing had changed
- made failed saves and opens show a message saying why, and keep the tab marked unsaved
- made the app fit the window, with each panel scrolling inside itself, so the diagram is visible on launch; the window can now shrink to 1024 by 640
- stopped a new window copying another window's unsaved tabs, since both then overwrote the same draft
- kept undo history when a tab is saved or renamed, which also makes an applied AI draft undoable
- fixed a new tab fitting its diagram using the previous tab's size
- added Windows and macOS support: installers for each system, a native macOS menu, per-platform GPU and sandbox settings, and `.mmd` and `.mermaid` file associations
- made every npm script work on Windows, macOS, and Linux by replacing shell-only commands with Node scripts; `scripts/secret-scan.sh` became `scripts/secret-scan.mjs` and no longer needs ripgrep
- bundled the Monaco editor into the app, so it no longer downloads from a CDN at runtime and a new install works with no internet
- fixed `Ctrl+W` and `Cmd+W` closing the whole window instead of the active tab; closing the window is now `Ctrl+Shift+W` or `Cmd+Shift+W`
- added panning with any mouse button, Mac trackpad gestures, and smooth zoom so trackpads no longer jump straight to maximum zoom
- stopped the same file opening twice on Windows and macOS when its path arrives with different letter case
- made files opened from the system wait until a window is ready, so none are lost during launch, and opened a window for them when none is open on macOS
- upgraded Electron from 41 to 45, because 41 is out of support, and moved Copy Image to the new clipboard API; Electron 44 and later require macOS 13 or newer
- applied non-breaking `npm audit fix` updates, which cleared the critical `dompurify` advisory
- removed bundled production dependencies from packaged builds, since Vite already includes them in the renderer
- added an end-to-end smoke test, `npm run test:smoke`, and a CI workflow covering all three systems
- added `.gitattributes` so shell scripts keep LF line endings on Windows checkouts
- recorded a full functionality and tool review in `docs/reviews/2026-11-06-functionality-and-tool-review.md`
- resolved all 47 npm dependency vulnerabilities (1 critical, 37 high, 9 moderate) by running `npm audit fix`; electron updated to 41.10.7 and all transitive build-tool advisories cleared
- added three screenshots to the README so visitors can immediately see the editor, live preview, and Kanban v11 diagram support
- extended diagram type detection to cover all Mermaid v11 diagram types: XY Chart, Packet, Architecture, Treemap, Tree View, Kanban, Venn, Ishikawa, ZenUML, and C4 diagrams
- added YAML frontmatter skipping so `---` config blocks no longer confuse diagram type detection
- added node extraction for Timeline diagrams (sections and periods) so the AI assistant node picker works for those diagrams
- added node extraction for Kanban diagrams (columns and tasks) so the AI assistant node picker works for those diagrams
- refreshed the app chrome with the Guided AI Labs signal-spark brand treatment while keeping the existing Mermaid Tool icon unchanged
- changed blank new tabs to show a calm ready state instead of a preview error
- clarified the assistant availability badge when no local AI runtime is detected
- grouped the main toolbar into start, keep, share, and more actions for easier scanning
- added clipboard image sharing and refreshed starter diagrams around practical business use cases
- expanded the no-model assistant state into an optional local-AI setup panel
- clarified the difference between autosave recovery and user-saved files with a visible file-location panel
- changed new saves and opens to default to `Documents/Mermaid Tool` instead of the hidden recovery draft folder
- added a `Show Folder` action for saved diagrams
- changed the assistant sidebar so the dialogue collapses upward inside the existing left column while the diagram picker remains visible
- moved the assistant transcript and prompt composer to the top of the expanded dialogue area
- simplified the local desktop integration back to one `mermaid-tool.desktop` launcher and refreshed the docs around deployment, recovery, and roadmap ideas

## 0.2.2 - 2026-04-18

- added a collapsible left-edge AI builder rail so users can guide Mermaid diagrams through natural-language conversation
- expanded local-model discovery and chat wiring to auto-detect Ollama, LM Studio, and other OpenAI-compatible localhost runtimes
- added node detection and node-focused prompting so the guided builder can target specific parts of the active diagram
- made the repo launcher rebuild automatically when local source files are newer than the built app and moved the local desktop install back to a single `mermaid-tool.desktop` override so the repo checkout does not publish a second launcher

## 0.2.1 - 2026-04-11

- made the `Open` dialog start in the same draft/save folder used by unsaved `Save As`

## 0.2.0 - 2026-04-11

- added tabbed editing so multiple Mermaid files can stay open concurrently inside the same window
- added multi-window Electron support with `New Window` and per-window file routing
- switched draft recovery from a single session file to per-tab draft files so concurrent work can be restored cleanly
- updated open, save, close-tab, and startup flows to work against the active tab instead of replacing the whole workspace

## 0.1.9 - 2026-04-11

- made `Save As` default to the local draft folder for unsaved diagrams so the dialog lines up with autosave recovery
- kept `Save As` anchored to the current file folder when you are editing an existing saved document

## 0.1.8 - 2026-04-11

- tightened the default Mermaid flowchart layout so large diagrams use space more logically and wrap labels sooner
- fixed fullscreen preview scrolling so grab-and-pan works vertically as well as horizontally
- changed fullscreen preview styling to keep the canvas on a single paper-like surface instead of reading like separate screens

## 0.1.7 - 2026-04-11

- changed fullscreen entry to open in fit-width mode so large diagrams feel readable instead of poster-sized
- split preview fitting into `Fit Width` and `Whole` so users can choose between reading and overview modes

## 0.1.6 - 2026-04-11

- replaced transform-based preview zoom with true SVG resizing so the canvas scroll area matches the visible diagram
- added fit-to-view controls and a deeper zoom-out range for large diagrams in preview and fullscreen mode

## 0.1.5 - 2026-04-11

- added wheel-based zoom directly on the preview canvas in both normal and fullscreen modes
- fixed dirty-window shutdown so closing the app now shows an Electron discard prompt instead of silently refusing to quit

## 0.1.4 - 2026-04-11

- added right-click grab-and-pan behavior for the preview canvas in both normal and fullscreen modes
- added cursor feedback and disabled the browser context menu on the diagram surface to support panning

## 0.1.3 - 2026-04-11

- added a fullscreen presentation mode for the live preview canvas
- added an in-app close path and `Escape` handling to return from fullscreen preview cleanly

## 0.1.2 - 2026-04-11

- added automatic local draft save and recovery for in-progress diagrams
- added desktop-style File menu commands for new, open, save, save as, wipe, delete, and export actions
- added explicit `Wipe` and `Delete File` controls to the main toolbar
- hardened the renderer and Electron contract around file deletion and draft persistence

## 0.1.1 - 2026-04-11

- fixed the `New` action so it opens a truly blank untitled document
- rebuilt the Linux packages so the installed app can pick up the corrected editor actions

## 0.1.0 - 2026-04-11

- built the first functional Electron desktop application for local Mermaid editing
- added Monaco-based editing, live Mermaid preview, theme switching, zoom, and starter templates
- added local SVG and PNG export flows
- added a launcher script and Linux desktop entry installer
- added Linux AppImage and Debian packaging with generated icons
- added `.mmd` and `.mermaid` MIME registration and desktop file association support
- added governance preflight support, lint, tests, build, and secret-scan hooks
- replaced placeholder repo documentation with project-specific operating docs
