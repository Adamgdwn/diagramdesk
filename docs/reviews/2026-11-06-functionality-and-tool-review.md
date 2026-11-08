# Functionality and Tool Review

- Date: 2026-11-06
- Code reviewed: commit `e35ee01` on `main`, then the Windows and macOS changes and the fixes recorded here, on branch `installers/0.2.3`
- Tested on: Windows 11 Home, build 26300, with Node 24.20.0 and npm 11.19.0, plus GitHub's Windows, macOS, and Linux runners
- Reviewer: Claude Code session, for the project owner
- Name: the app was called Mermaid Tool during this review, and is now DiagramDesk. See [the rename review](2026-11-06-rename-to-diagramdesk.md)

## Summary

The app now builds, installs, and passes its end-to-end test on Windows, macOS, and Linux. All seven Critical findings are fixed, including PNG export, lost typing, and crash recovery. Each fix has a check that runs on all three systems, so it should stay fixed.

Eight High findings remain, mostly in the optional AI builder. The most visible is that it can auto-select a model that can't chat. None of them affect editing, saving, or exporting without AI.

Three things can only be judged by a person. Nobody has tried a physical Mac, a Windows installer downloaded through a browser, or double-clicking a `.mmd` file. See [Not Tested](#not-tested).

## How This Was Tested

An automated harness drove the real app through Playwright, with an isolated profile and temporary folders. It stubbed native dialogs, the clipboard, and the file manager. The same 172 checks ran at each stage:

| | Pass | Fail | Note |
| --- | --- | --- | --- |
| Original code | 121 | 29 | 22 |
| After the Windows and macOS work | 128 | 26 | 18 |
| After the fixes in this review | 139 | 15 | 18 |

No check is worse than it was on the original code. Of the 15 failures, 10 are the cosmetic diagram labels in M2, 1 is ZenUML in M1, and 4 are H2, H3, and H8.

One check's input changed. "Invalid syntax shows an error" had typed text that was only invalid because of C2. Once C2 was fixed, that text rendered as a valid diagram, so the check now types text that's truly invalid.

A passing PNG check only proves that a valid image file was written. So the 30 exported diagram types were also checked by eye after the C1 fix. All 30 showed their labels and the whole diagram.

The smoke test separately runs 20 steps with all remote hosts blocked. CI runs it 7 times per build on an installers branch: from source on each system, then against each installed app. CI uses the real system clipboard.

## Platform Status

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Build, lint, unit tests, secret scan | Tested here and in CI | Build in CI. Other checks run on Linux | CI |
| App runs from source | Tested here and in CI | CI | CI |
| Installer builds | CI | CI, for Apple Silicon and Intel | CI |
| Installed app passes the smoke test | CI, after a silent install | CI, from the Apple Silicon `.dmg` | CI, from both the `.deb` and the AppImage |
| Copy Image with the real clipboard | CI | CI | CI |
| File association with `.mmd` and `.mermaid` | Configured, not tested | Configured, not tested | Unchanged, not retested |

**Windows installer on this machine.** `npm run package:win` fails at the last step with `spawn UNKNOWN`. electron-builder has to run an unsigned helper executable, and Smart App Control is on here and blocks it. The Windows Code Integrity log (event 3077) names the exact file. CI has no such limit. Turning Smart App Control off is not recommended, because Microsoft's guidance and reports conflict on whether it can be turned back on without resetting Windows.

**What this means for users.** The CI-built installer did open its wizard on this machine with Smart App Control on, with no block recorded. That's better than feared, but it isn't proof. The wizard was closed without installing, and the copy came through `gh`, so it lacked the mark a browser download adds. The owner has accepted this risk rather than buy code signing.

## Fixed: Critical Findings

| ID | Problem | Cause | Fix | How it's checked |
| --- | --- | --- | --- | --- |
| C1 | PNG export and Copy Image were wrong for nearly every diagram. Only 1 of 30 was correct | `canvg` couldn't draw HTML labels, and `width="100%"` was read as 100 pixels | The browser engine now draws the image, sized from the `viewBox`. Dark-theme diagrams get a dark background. Very large diagrams are scaled down, and the status bar says so. `canvg` is removed | 30 types checked by eye. The smoke test looks for label pixels in the exported file |
| C2 | Enter after `flowchart TD` didn't start a new line | A word-suggestion popup took the key press | Word suggestions are off | Smoke test, comparing the exact text |
| C3 | Typing on large diagrams silently dropped characters | The editor's own text came back through React and overwrote newer keystrokes | The editor owns its text. Only changes made by the app are pushed into it. Slow diagrams also wait for a longer pause before rendering | No characters lost on a 300-edge diagram at 6 and 12 characters per second, previously lost every run. Also in the smoke test |
| C4 | One unreadable draft stopped all crash recovery | Drafts were overwritten in place, and one parse failure failed them all | Atomic writes, in order for each draft. An unreadable draft moves to an `unreadable` folder, and the status bar says so | Unit tests and smoke test. 0 of 12 hard kills left a damaged draft |
| C5 | Autosave rewrote every second indefinitely | Each save updated the tab, which scheduled the next save | Autosave now reacts only to changes in the draft's contents | One write in 8 idle seconds, previously 9 or 10 |
| C6 | Failed saves and opens said nothing | No error handling on those paths | A message gives the reason in plain language, and the tab stays marked unsaved | Harness and smoke test |
| C7 | The preview looked empty on launch | The page was 2,423 pixels tall, with the diagram off-screen | The workspace fits the window, and each panel scrolls inside itself. Short and narrow windows use a more compact header | Harness and smoke test, plus screenshots at four window sizes |

### Found and Fixed Along the Way

| Problem | How it came up | Fix |
| --- | --- | --- |
| H1: a second window copied the first window's unsaved tabs. Closing the copy deleted the first window's draft | Not in the agreed scope, but fixing C5 made it worse. The endless autosave had been hiding it by rewriting the draft every second | Each draft belongs to one window, and is released when that window closes |
| H5: applying an AI draft to an untitled tab couldn't be undone | Fixed by the C3 change. Editor models now belong to the tab, not its file path | Also keeps undo history through Save and Save As |
| Whole clipped the bottom 16 pixels of tall diagrams | Exposed by C7, because diagrams are now often limited by height | Whole now leaves a margin on every side |
| A new tab fitted its diagram using the previous tab's size | Code reading during C7 | The fit waits for the tab's own diagram to render |
| Save could mark a tab clean while newer typing was unsaved | Code reading during C3 | Save always reads the latest text, and the tab stays unsaved if the text changed during the save |
| CI only built Mac installers for Apple Silicon | Checking the installer sizes | The build now uses both architectures in the config |
| electron-builder tried to publish from CI, and failed without a token | First CI run | Installer scripts now pass `--publish never` |

## Open Findings

### High

| ID | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- |
| H2 | **The AI builder can pick a model that can't chat.** It selects the first model listed, and on this machine that's an embedding model, so the first message fails. | Auto-selected `nomic-embed-text`, then got `does not support chat`. | Ask Ollama for each model's capabilities, and list only chat models. |
| H3 | **AI drafts can't be reviewed before applying.** The app says to review the draft in the preview, but nothing shows it. | Neither the preview nor the panel contains the draft. | Render the draft in the preview, with Apply and Discard. |
| H4 | **AI drafts aren't checked before being offered.** | The real `qwen3:1.7b` model gave a draft that wouldn't render, on every run so far. | Run `mermaid.parse` on the draft first, and report or retry when it fails. |
| H6 | **Automatic repair calls the model without being asked.** Each pause on invalid text sends a request, adds a "You" message the user never wrote, and opens the panel. | 2 unrequested calls from 3 pauses in the final run. | Make repair opt-in through the existing Suggest Fix button. |
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
| M5 | Medium | SVG exports keep HTML labels, 19 of them in the starter flowchart. Design and office tools often can't draw these, so labels may vanish there. This wasn't tested in those tools. The C1 fix only covers PNG and Copy Image. |
| M7 | Medium | Delete permanently removes the file. `shell.trashItem` would send it to the Recycle Bin or Trash. |
| L1 | Low | Typing a character discards a waiting AI draft with no notice. |
| L2 | Low | Mermaid's 500-edge limit shows a confusing message: "500 edges found, but the limit is 500". |
| L3 | Low | A never-saved tab says "Recovery draft only" and "Saved state", though neither is true. |
| L4 | Low | The close prompt says it will quit and discard edits, even for one of several windows, and the draft still returns on the next launch. |
| L5 | Low | Exports default to the top of Documents, not next to the diagram. |
| L6 | Low | Zoom is shared across tabs rather than kept per tab. |
| L7 | Low | The editor highlights Mermaid as Markdown, so ordinary brackets show in red. |
| L8 | Low | The preview canvas stays light in the dark theme, so lines are faint there, although the exported PNG is correct. A theme set inside the file itself isn't seen by export, so a dark diagram set that way still gets a white background. |
| L9 | Low | A click soon after an editor first appears sometimes doesn't take focus. It logged 2 to 4 times per CI build across 7 smoke runs, on the Linux and macOS runners, and caused one test failure on Linux before the test began retrying. It never happened in 43 tries on this Windows machine, even at 20 times CPU slowdown. The cause isn't confirmed. A person would at worst need to click again, and no typed text was lost once the editor had focus. |

M6, the panels stacking in one column below 1280 pixels, is fixed by the C7 work. They now stack only below 1000 CSS pixels, which takes a large app zoom to reach.

## Fixed in the Windows and macOS Work

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

Everything below passed on the final build, except where marked.

| Area | Result |
| --- | --- |
| Startup | Window, starter diagram, editor, background worker, and version label all work |
| Editing | Typing updates the preview and marks the tab unsaved, with no characters lost |
| Tabs | New Tab, New, switching, close with and without changes, closing the last tab |
| Templates | All six load and render |
| Save, Save As, Show Folder | All work, from both the toolbar and the editor panel, and failures are reported |
| Open | Multiple files, with spaces, `#`, and accented letters in names, and `.txt` and `.md` files. Reopening focuses the tab, and failures are reported |
| Wipe, Delete | Work, including their confirmation prompts |
| Render errors | Clear message, export disabled, and the preview returns once fixed |
| Themes | All five render. See M4 and L8 |
| Zoom and pan | Plus and minus buttons, wheel, drag with any button, Fit Width, and Whole |
| Full screen | Opens, Fit Width, Whole, wheel zoom, Escape, and Close |
| PNG, Copy Image | Match the preview. The harness stubbed the clipboard, and CI used the real one |
| SVG | Writes valid markup. See M5 |
| Sidebar | Collapse, Open dialogue, and node chips |
| Native menu | New Tab, Close Tab, Open, Save As, Export PNG, and Export SVG, run directly. Save, Wipe, Delete, and Quit share handlers already tested from the toolbar |
| Shortcuts | `Ctrl+N` and `Ctrl+W` tested |
| Crash recovery | Restores unsaved tabs, and survives an unreadable draft |
| Close prompt | Keep Editing and Quit Anyway both work. See L4 |
| Files from the system | Command-line argument, second launch reusing the window, and a simulated macOS `open-file` event |
| Windows | New Window starts clean and leaves other windows' drafts alone |
| AI builder | Real Ollama round trip, model listing, and node focus work. See H2, H3, H4, and H6 to H8 |
| Links inside diagrams | Clicking one doesn't navigate the app away |

### Diagram Types

| Result | Types |
| --- | --- |
| Render in the preview and export correctly (30) | Flowchart, graph, `flowchart-elk`, ELK frontmatter, frontmatter, init directive, sequence, class, state, ER, journey, Gantt, pie, mindmap, timeline, quadrant, requirement, git graph, Sankey, XY chart, block, packet, architecture, treemap, tree view, Kanban, Venn, Ishikawa, radar, C4 |
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
| `electron-builder` | 26.18.1 | 26.18.1 | `npm audit` suggests "fixing" it by downgrading to 25.1.0. Don't apply that |
| `typescript`, `eslint`, `vitest` | 5.9, 9, 4 | 7, 10, 5 | Major versions behind. Not urgent |

`canvg` has been removed. `npm audit` still reports 12 moderate issues in development tools, which don't ship to users, and the 2 low production ones above.

2026-11-08: `npm audit` reports none now. Two `overrides` in `package.json` hold `katex` at 0.18 and move the affected `minimatch` copies to 11. The change log says when each can go. The Mermaid 12 upgrade is no longer needed for security, only for its own features.

### Build, Test, and Automation

| Tool | Assessment |
| --- | --- |
| Unit tests | Grew from 11 to 39, and all pass. They now cover drafts, export sizing, and error messages, but not the renderer's tab state |
| Smoke test (new) | `npm run test:smoke` drives the real app with all remote hosts blocked, in 20 steps. Its 8 regression steps were confirmed to fail on the code before the fixes, though the Enter and large-diagram steps may have failed there because of C7 rather than their own bugs. The harness's typing checks confirm C3 separately |
| Review harness | The 172-check harness lives outside the repo. The smoke test now carries the checks that matter most, so it isn't essential to bring in |
| CI (new) | Passing. Fast checks on Linux, then smoke tests on all three systems. A branch under `installers/` also builds, installs, and tests the installers. Standard runners are free for public repos, and metered if the repo goes private. The smoke test retries a click that doesn't take focus and logs a note, see L9 |
| ESLint | Passes. The complexity rule isn't configured |
| Complexity | `App()` still scores 87, against a threshold of 21. That's the same baseline as before these fixes, not a regression. No new function exceeds 10. It remains about 2,000 lines and holds almost all of the app's state, so splitting out tab and draft state is still worthwhile |
| Governance preflight | Passes, but only checks that files and script names exist. Needs `bash`; on Windows use Git Bash, because `bash` in PowerShell can start WSL |
| Dependabot | PRs #11 to #13 are superseded by the updated lockfile and can be closed once it's merged |
| Graphify | `graphify-out/` was committed, against the GitHub efficiency standard, and one update changed 25 tracked files and about 21,000 lines. It's now untracked |
| Bundle | The main chunk is 4.1 MB and Vite warns about it. Harmless for a local app |
| `package.json` | Version is now 0.2.3, matching the changelog. `homepage` now points to this product |

## Not Tested

- A physical Mac: real trackpad gestures, and the Gatekeeper prompt that a downloaded copy gets. CI files aren't quarantined
- Running the Intel Mac build, which is built but not run, because CI's Macs are Apple Silicon
- A Windows installer downloaded through a browser, and on Smart App Control, a full install through the wizard
- Double-clicking files through real file associations on Windows and macOS. Linux was checked on 2026-11-08; see `2026-11-06-rename-to-diagramdesk.md`
- Real system dialogs and file manager, which were stubbed everywhere
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
