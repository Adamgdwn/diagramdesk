# Roadmap

## Just Completed

- 2026-11-08: fixed all seven High findings from the review, in the AI builder and on security, and finished the rename on Linux
- renamed the app from Mermaid Tool to DiagramDesk
- added Windows and macOS support, with installers built and smoke tested in CI on all three systems
- fixed the seven critical findings from the review, including PNG export, lost typing, and crash recovery
- bundled the editor so the app works offline, and upgraded to a supported Electron release
- shipped a tabbed workspace so multiple Mermaid files can stay open at once in a single window
- added multi-window support for side-by-side editing sessions
- switched autosave and recovery from one shared session file to per-tab draft files
- aligned `Save As` and `Open` so unsaved-work flows start in the same local draft/save folder
- added a guided AI builder that can draft Mermaid changes through local-model conversation
- refined the AI sidebar so the dialogue collapses upward while the diagram picker remains visible
- refreshed the app chrome with the Guided AI Labs signal-spark brand treatment
- kept Linux packaging, launcher behavior, and docs in sync with the current desktop workflow

## Now

- work through the open Medium and Low findings in `docs/reviews/2026-11-06-functionality-and-tool-review.md`
- hold the governance alignment review that is due before the first production release, now that DiagramDesk is a full release
- try the installers by hand: a browser-downloaded Windows setup, and a physical Mac
- publish free installers through GitHub Releases
- stabilize the new multi-tab, multi-window, and AI-guided workflow
- verify reinstall and daily-use behavior for the `0.2.x` packaged app
- smoke-test the Guided AI Labs branded chrome in local launch and packaged flows
- keep documentation aligned with the actual operator workflow
- maintain the governance preflight, validation scripts, and launcher setup

## Next

- add recent files and reopen helpers so larger multi-file sessions are easier to resume
- add a side-by-side "AI draft vs current diagram" review step before applying assistant changes
- let users click a node in the preview to focus the assistant automatically
- add one-click starter prompts for common cases like org charts, process maps, and system context diagrams
- add release checks for distributable artifacts
- add richer export options such as PDF or clipboard image copy
- keep future app surfaces aligned with the Guided AI Labs signal-spark brand treatment
- expand test coverage around tab lifecycle, draft recovery, and multi-window state

## Later

- add configurable themes, preferences, and starter libraries
- add lightweight undo history for AI-applied diagram drafts
- add reusable diagram snippets and domain packs for product, engineering, and operations diagrams
- explore inline assistant suggestions directly beside the editor instead of only in the sidebar
- revisit packaging, release automation, and vulnerability management as the app matures
