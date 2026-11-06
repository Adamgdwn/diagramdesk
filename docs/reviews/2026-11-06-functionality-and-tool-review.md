# Functionality and Tool Review

- Date: 2026-11-06
- Code reviewed: commit `e35ee01` on `main`, then the Windows and macOS changes made the same day
- Tested on: Windows 11 Home, build 26300, with Node 24.20.0 and npm 11.19.0
- Reviewer: Claude Code session, for the project owner

## Summary

The app does a lot well: editing, tabs, templates, saving, previewing, zooming, and every diagram type Mermaid can render all work on Windows. It now also builds and runs on Windows with the same commands as Linux, works with no internet, and is on a supported Electron release.

It isn't ready to ship to other people yet. PNG export and Copy Image, which are core features, are broken for nearly every diagram. Several smaller problems can lose or corrupt a user's work. None of these are specific to Windows or macOS, so they affect Linux as well.

macOS is configured but unverified, because it can't be built or run on this machine. The Windows installer's final step is blocked on this machine, so the installer itself is also unproven.

## How This Was Tested

An automated harness drove the real app through Playwright, with an isolated profile and temporary folders. It stubbed native dialogs, the clipboard, and the file manager, so those three were not exercised for real. The same 172 checks ran against an untouched build of the original commit and against the new code:

| | Pass | Fail | Note |
| --- | --- | --- | --- |
| Original code | 121 | 29 | 22 |
| New code | 128 | 26 | 18 |

Seven checks improved and none got worse. Most remaining failures are the open findings below, and 10 are the cosmetic diagram labels in M2.

A passing PNG check only proves that a valid image file was written. The export quality findings came from looking at the images themselves.

## Platform Status

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| `npm install`, `build`, `start`, `lint`, `test`, `secret-scan` | Tested and working | Should work, not run | Should work, not run |
| App launches and runs from source | Tested | Not run | Not run |
| Packaged app runs | Tested from `release/win-unpacked` | Not built | Not rebuilt |
| Installer | Final step blocked on this machine, see below | Configured, not built | Configuration kept, not rebuilt |
| File association with `.mmd` and `.mermaid` | Configured, not tested | Configured, not tested | Unchanged, not retested |

**Windows installer.** `npm run package:win` fails at the last step with `spawn UNKNOWN`. electron-builder has to run an unsigned helper executable, and Smart App Control is on here and blocks it. The Windows Code Integrity log (event 3077) names the exact file. Everything before that step succeeds, and the packaged app it produces passes the full smoke test. Options are to build in CI, or to sign. Turning Smart App Control off is not recommended, because Microsoft's guidance and reports conflict on whether it can be turned back on without resetting Windows.

**What this means for users.** Smart App Control offers no per-app override. An unsigned installer would probably be blocked outright on any PC that has it on, not just warned about. This hasn't been tested with a finished installer. The owner has accepted this risk rather than buy code signing.

## Open Findings

Nothing in this section has been fixed yet. Each suggested fix is a starting point, not a finished design.

### Critical: core features broken, or work can be lost

| ID | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- |
| C1 | **PNG export and Copy Image are wrong for nearly every diagram.** Labels vanish from flowcharts, class, ER, state, mindmap, Kanban, block, and requirement diagrams, and most types are cropped or badly scaled. | Of 30 exported diagrams checked by eye, only the sequence diagram was correct. Both builds behave the same. Likely causes: `canvg` can't draw HTML labels, and [export.ts](../../src/lib/export.ts) reads `width="100%"` as 100 pixels. | Replace `canvg` by drawing the SVG to a canvas through the browser engine, with size taken from the `viewBox`. |
| C2 | **Enter doesn't start a new line after `flowchart TD` in a new tab.** The word-suggestion popup takes the key press, giving `flowchart TDA[One] --> B[Two]`. This is the first thing most people type. | Reproduced at two typing speeds in both builds. | Turn off word-based suggestions in the Monaco options. |
| C3 | **Typing on large diagrams silently drops characters.** A 300-edge diagram at normal speed produced `012346789` instead of `0123456789`. | 2 of 2 runs at both 6 and 12 characters per second, in both builds. The original lost about 10 characters per sentence, the new code about 1. Small diagrams lost none in 20 runs, up to 200 characters per second. Likely cause: the editor's content is overwritten by older React state while rendering keeps the app busy. | Stop feeding the editor's own text back into it, and render off the typing path. |
| C4 | **One unreadable draft file stops all crash recovery**, and the user sees only "Startup recovery failed". Drafts are overwritten in place, so an interrupted write can create one. | The controlled test fails in both builds. It also happened unprompted once in 14 exits and kills. | Write to a temporary file and rename it. Skip bad files instead of failing all of them. |
| C5 | **Autosave never stops.** A tab with unsaved changes rewrites its draft about once a second, even when nobody is typing. | 9 or 10 writes in 8 seconds in both builds. Each save updates the tab, which schedules the next save. | Don't change tab state when the content hasn't changed. |
| C6 | **Failed saves and opens say nothing.** Saving to an unwritable location or a read-only file, or opening a missing file, shows no message. A read-only save leaves only the existing `*` on the tab. | Three failing checks in both builds. | Catch these errors and show them in the status bar, or in a dialog for saves. |
| C7 | **The preview looks empty on launch.** The page is 2,423 pixels tall, the preview stretches to match the sidebar, and the diagram is centered off-screen. | Diagram at y=1048 to 1664 in a 754-pixel window, in both builds. The README screenshot shows the same layout on Linux. | Fit the workspace to the window, and scroll inside each panel. |

### High

| ID | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- |
| H1 | **A second window copies the first window's unsaved tabs**, and both then overwrite the same draft file. After a crash, only whichever wrote last survives. | The draft alternated between windows: `1 1 2 1 1 2`. The deployment guide says windows should stay independent. | Track which drafts a window owns, and restore them only at app startup. |
| H2 | **The AI builder can pick a model that can't chat.** It selects the first model listed, and on this machine that's an embedding model, so the first message fails. | Auto-selected `nomic-embed-text`, then got `does not support chat`. | Ask Ollama for each model's capabilities, and list only chat models. |
| H3 | **AI drafts can't be reviewed before applying.** The app says to review the draft in the preview, but nothing shows it. | Neither the preview nor the panel contains the draft. | Render the draft in the preview, with Apply and Discard. |
| H4 | **AI drafts aren't checked before being offered.** | The real `qwen3:1.7b` model gave a draft that wouldn't render, in 2 of 2 runs, at about 30 seconds each. | Run `mermaid.parse` on the draft first, and report or retry when it fails. |
| H5 | **Applying a draft to an untitled tab can't be undone.** | Five presses of Ctrl+Z had no effect. Likely cause: the rename swaps the editor's undo history. | Keep the editor's model when a tab is renamed. |
| H6 | **Automatic repair calls the model without being asked.** Each pause on invalid text sends a request, adds a "You" message the user never wrote, and opens the panel. | 3 unrequested calls from 3 pauses. | Make repair opt-in through the existing Suggest Fix button. |
| H7 | **AI failures show raw errors**, such as `Error invoking remote method...SyntaxError`. Common replies fail: plain prose, or a code fence inside the diagram. LM Studio and llama.cpp aren't asked for JSON at all. | Reproduced with a scripted server. | Strip fences, request JSON mode, and show friendly messages. |
| H8 | **`OLLAMA_HOST=127.0.0.1:11434` isn't understood**, so Ollama isn't found. This format is common. | Zero runtimes found. The `http://` form works. | Add `http://` when the scheme is missing. |
| H9 | **The renderer has no Content Security Policy, and its file handlers trust any path.** Saving and deleting accept any path with no check in the main process, and draft IDs are joined into paths unchecked. Bundling Monaco removed the known remote code path, but any future script injection would have broad file access. | Electron's own security warning, and code reading. | Add a strict policy, track approved paths in the main process, and validate draft IDs. |

### Medium and Low

| ID | Level | Problem |
| --- | --- | --- |
| M1 | Medium | ZenUML is detected but can't render, because its plugin isn't installed, so "all Mermaid v11 types" in the changelog isn't accurate. ELK layouts are requested but silently fall back to the standard layout, because ELK isn't installed either. |
| M2 | Medium | Valid diagrams show a generic "Mermaid Diagram" heading: `radar-beta`, `swimlane-beta`, `cynefin-beta`, `railroad-beta`, `eventmodeling`, and the keywords `sankey`, `xychart`, `block`, `packet`, `treemap`, and `requirement`. C4 shows "C4 Diagram Diagram". |
| M3 | Medium | The node picker is empty for 12 types: state, ER, journey, pie, quadrant, requirement, git graph, Sankey, packet, treemap, tree view, and Ishikawa. It shows wrong entries for XY chart, C4, architecture, and ZenUML, and Kanban tasks without metadata are labelled as columns. |
| M4 | Medium | The theme isn't saved with the file, so a saved diagram reopens in the default theme. |
| M5 | Medium | SVG exports keep HTML labels, 19 of them in the starter flowchart. Design and office tools often can't draw these, so labels may vanish there. This wasn't tested in those tools. Turning off `htmlLabels` might fix both this and part of C1. |
| M6 | Medium | Below 1280 pixels wide, panels stack in one column and the editor sits far down the page. A 1080p laptop at 150% scaling would probably get this layout. |
| M7 | Medium | Delete permanently removes the file. `shell.trashItem` would send it to the Recycle Bin or Trash. |
| L1 | Low | Typing a character discards a waiting AI draft with no notice. |
| L2 | Low | Mermaid's 500-edge limit shows a confusing message: "500 edges found, but the limit is 500". |
| L3 | Low | A never-saved tab says "Recovery draft only" and "Saved state", though neither is true. |
| L4 | Low | The close prompt says it will quit and discard edits, even for one of several windows, and the draft still returns on the next launch. |
| L5 | Low | Exports default to the top of Documents, not next to the diagram. |
| L6 | Low | Zoom is shared across tabs rather than kept per tab. |
| L7 | Low | The editor highlights Mermaid as Markdown, so ordinary brackets show in red. |

## Fixed in This Change

| Problem | Before | After |
| --- | --- | --- |
| `npm run build` and `npm start` on Windows | Failed on `rm` and `env` | Work on all systems through Node scripts |
| Secret scan | Needed `bash` and ripgrep, so didn't run here | Node script, confirmed to catch a planted fake key |
| Icon generation | `python3` is a Store stub on Windows | Finds `python3`, `python`, or `py -3` |
| New install with no internet | Editor stuck on "Loading..." forever | Works, with zero remote requests |
| Remote code at startup | 13 requests to `cdn.jsdelivr.net` | None |
| `Ctrl+W` or `Cmd+W` | Closed the whole window | Closes the tab; `Ctrl+Shift+W` closes the window |
| Panning | Right mouse button only | Any mouse button |
| Trackpad zoom | 20 tiny scrolls jumped from 91% to the 500% cap | Gentle, and follows distance scrolled |
| Mac trackpad gestures | None | Two-finger scroll pans; pinch or Command+scroll zooms |
| Mac menu | File menu would have become the app menu | Native app and Window menus |
| Same file with different letter case | Opened twice | Focuses the existing tab on Windows and macOS |
| Files opened during launch | Could be lost in a timing window | Held until the window is ready |
| Packaged size of app code | Included Mermaid and Monaco a second time | `app.asar` is 7.5 MB, with no `node_modules` |
| Electron | 41, out of support | 45, with Copy Image moved to the new clipboard API |
| `npm audit` | 27 issues, 1 critical and 8 high | 14 issues, 12 moderate and 2 low |
| Shell scripts on Windows checkouts | Converted to CRLF, which breaks Linux packages | Kept as LF by `.gitattributes` |

## Feature Results on Windows

Everything below passed on the new code, except where marked.

| Area | Result |
| --- | --- |
| Startup | Window, starter diagram, editor, background worker, and version label all work |
| Editing | Typing updates the preview and marks the tab unsaved. See C2 and C3 |
| Tabs | New Tab, New, switching, close with and without changes, closing the last tab |
| Templates | All six load and render |
| Save, Save As, Show Folder | All work, from both the toolbar and the editor panel. Failures are silent, see C6 |
| Open | Multiple files, with spaces, `#`, and accented letters in names, and `.txt` and `.md` files. Reopening focuses the tab |
| Wipe, Delete | Work, including their confirmation prompts |
| Render errors | Clear message, export disabled, and the preview returns once fixed |
| Themes | All five render. See M4 |
| Zoom and pan | Plus and minus buttons, wheel, drag with any button, Fit Width, and Whole |
| Full screen | Opens, Fit Width, Whole, wheel zoom, Escape, and Close |
| PNG, Copy Image | Write valid images, but the content is wrong. See C1. The clipboard was stubbed |
| SVG | Writes valid markup. See M5 |
| Sidebar | Collapse, Open dialogue, and node chips |
| Native menu | New Tab, Close Tab, Open, Save As, Export PNG, and Export SVG, run directly. Save, Wipe, Delete, and Quit share handlers already tested from the toolbar |
| Shortcuts | `Ctrl+N` and `Ctrl+W` tested |
| Crash recovery | Restores unsaved tabs. See C4, C5, and H1 |
| Close prompt | Keep Editing and Quit Anyway both work. See L4 |
| Files from the system | Command-line argument, second launch reusing the window, and a simulated macOS `open-file` event |
| Windows | New Window works. See H1 |
| AI builder | Real Ollama round trip, model listing, and node focus work. See H2 to H8 |
| Links inside diagrams | Clicking one doesn't navigate the app away |

### Diagram Types

| Result | Types |
| --- | --- |
| Render correctly in the preview (30) | Flowchart, graph, `flowchart-elk`, ELK frontmatter, frontmatter, init directive, sequence, class, state, ER, journey, Gantt, pie, mindmap, timeline, quadrant, requirement, git graph, Sankey, XY chart, block, packet, architecture, treemap, tree view, Kanban, Venn, Ishikawa, radar, C4 |
| Can't render | ZenUML, see M1 |
| Render not tested, heading only | Swimlane, Cynefin, railroad, event modeling |

A 480-edge flowchart rendered in about 3.5 seconds. Mermaid's limit stops anything over 500 edges.

## Tool Review

### Dependencies

| Package | Now | Latest | Note |
| --- | --- | --- | --- |
| `electron` | 45.2.3 | 45.2.3 | Upgraded from 41. Electron supports three majors, so plan on upgrading at least every few months. Requires macOS 13 or newer |
| `mermaid` | 11.17.2 | 12.3.0 | The major upgrade clears the last 2 low production advisories. Needs its own test pass |
| `monaco-editor` | 0.53.0 | 0.57.0 | Pinned by an earlier decision, and now actually what runs. The old app really ran 0.55.1 from the CDN |
| `canvg` | 4.0.3 | | The likely cause of C1. Remove it when C1 is fixed |
| `electron-builder` | 26.18.1 | 26.18.1 | `npm audit` suggests "fixing" it by downgrading to 25.1.0. Don't apply that |
| `typescript`, `eslint`, `vitest` | 5.9, 9, 4 | 7, 10, 5 | Major versions behind. Not urgent |

`npm audit` still reports 12 moderate issues in development tools, which don't ship to users.

### Build, Test, and Automation

| Tool | Assessment |
| --- | --- |
| Unit tests | Grew from 11 to 19, and all pass. They cover only helper functions, not the main process, tabs, or drafts |
| Smoke test (new) | `npm run test:smoke` drives the real app with all remote hosts blocked, in 12 steps. Passes from source and against the packaged executable |
| Review harness | The 172-check harness lives outside the repo. Worth bringing in when the findings are fixed, so they stay fixed |
| CI (new, not yet run) | Fast checks on Linux, then smoke tests on all three systems, with installers only on request. It can't be validated until it's pushed. Standard runners are free for public repos, and metered if the repo goes private |
| ESLint | Passes. The complexity rule isn't configured |
| Complexity | `App()` scores 87, against a threshold of 21. It scored 87 before this work too, so it's an existing baseline and not a regression. It's about 1,840 lines and holds almost all of the app's state. Fixing C3, C5, and H1 is a natural time to split out tab and draft state |
| Governance preflight | Passes, but only checks that files and script names exist. Needs `bash`; on Windows use Git Bash, because `bash` in PowerShell can start WSL |
| Dependabot | PRs #11 to #13 are superseded by the updated lockfile and can be closed once it's merged |
| Graphify | `graphify-out/` was committed, against the GitHub efficiency standard, and one update changed 25 tracked files and about 21,000 lines. It's now untracked |
| Bundle | The main chunk is 4.1 MB and Vite warns about it. Harmless for a local app |
| `package.json` | Version is now 0.2.3, matching the changelog. `homepage` points to mermaid.js.org rather than this product |

## Not Tested

- Anything on a real Mac, or on Linux after these changes
- Running a finished installer, and double-clicking files through real file associations
- Real system dialogs, clipboard, and file manager, which were stubbed. CI will use the real clipboard
- Edit and View menu items
- Accessibility, beyond what the tests touched
- Exported SVGs in other applications
- Windows on Arm, or displays beyond this machine's scaling

## Owner Decisions

Made on 2026-11-06:

| Question | Decision |
| --- | --- |
| For sale, or a personal tool? | Free through GitHub. It isn't being sold, so the build-to-sale standard doesn't apply. Recorded in `project-control.yaml` |
| Push to GitHub to run CI? | Yes |
| Fix the Critical findings next? | Yes |
| Buy code signing? | No. Recorded as accepted risk R-007 |
| Version number | 0.2.3 |
| Untrack `graphify-out/`? | Yes. It's now in `.gitignore`. Earlier copies remain in git history |

Still open: **a governance alignment review.** None has been recorded for this project. The standard says one is due, and also before the first production release.
