# Risk Register

## Current Risk Classification

- Tier: Medium
- Owner: Adam Goodwin
- Last reviewed: 2026-11-06

## Key Risks

| ID | Risk | Likelihood | Impact | Controls | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Dependency advisories recur. As of 2026-11-06, production dependencies report 2 low-severity `mermaid` and `katex` advisories that need a major `mermaid` upgrade, and the critical `dompurify` advisory is cleared. Development tools report 12 moderate advisories. | Medium | Medium | Local-only deployment, regular `npm audit` review, Dependabot enabled, and a smoke test that makes upgrades safer to verify. | Adam Goodwin | Open |
| R-002 | Users can lose work through force-closes, an unreadable draft that blocks all recovery, drafts shared between windows, silent save failures, and dropped keystrokes on large diagrams. The last four were confirmed by the 2026-11-06 review. | Medium | High | In-app confirmation before document replacement and before window close, local save workflow, operator guidance in the runbook. Fixes are listed in the review. | Adam Goodwin | Open |
| R-003 | Desktop launcher behavior may drift if the repo is moved after installation because the launcher stores an absolute path. | Medium | Low | Reinstall the desktop entry after moving the repo, document the recovery step in the runbook and deployment guide. | Adam Goodwin | Open |
| R-004 | Packaged Linux behavior may vary across distributions because Electron desktop integration depends on system MIME and desktop database tools. | Medium | Medium | AppImage and `.deb` both built and inspected, local launcher retained as fallback, packaging docs updated with recovery steps. | Adam Goodwin | Mitigated |
| R-005 | Local AI runtime availability or protocol differences across Ollama, LM Studio, and OpenAI-compatible servers may confuse users or produce inconsistent assistant behavior. | Medium | Medium | Runtime auto-detection, in-app status messaging, node-aware prompting, runbook guidance, and local-only fallback to manual editing when no runtime is available. | Adam Goodwin | Mitigated |
| R-007 | Windows and macOS installers are not signed by a paid certificate, so SmartScreen and Gatekeeper warn users, and Smart App Control may block the Windows installer with no override. Smart App Control has already blocked the installer's build helper on the development machine. | High | Medium | The owner decided on 2026-11-06 not to buy certificates, because the app is free. Ad-hoc signing on macOS so the app can launch at all, install steps in the deployment guide, and CI as the build path. | Adam Goodwin | Accepted |
| R-008 | macOS behavior is unverified, because it can't be built or run on the current development machine. The menu, file opening, and trackpad gestures were written from platform documentation and checked by simulation only. | Medium | Medium | CI workflow ready to build and smoke test on macOS once pushed, unit tests for gesture handling, and a macOS checklist in the deployment guide. | Adam Goodwin | Open |
| R-009 | The renderer has no Content Security Policy, and its save and delete handlers accept any path. Bundling the editor removed the known remote code path, but any future script injection would have broad file access. | Low | High | Mermaid `securityLevel: strict`, context isolation, and no remote code loaded. Hardening is listed in the review. | Adam Goodwin | Open |
| R-006 | Brand assets may drift if future visual updates recolor, redraw, or replace the Guided AI Labs signal-spark treatment or Mermaid Tool app icon unintentionally. | Low | Low | Keep the approved signal-spark SVG as a separate asset, preserve the existing Mermaid Tool icon files unless explicitly requested, and include branding checks in deployment and recovery docs. | Adam Goodwin | Mitigated |
