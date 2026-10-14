# AGENTS.md — Project Execution Rules

These rules are mandatory for every coding agent working in this repository.

The most important rule:

> DO EXACTLY WHAT THE USER REQUESTS.
> DO NOT EXPAND THE TASK.
> DO NOT IGNORE SMALL BUGS.
> DO NOT REDESIGN UNRELATED FEATURES.
> DO NOT STOP AFTER ONLY PARTIAL IMPLEMENTATION.
> use icons fist in button or text with this is most important rule.
---

# 1. TASK SCOPE — HIGHEST PRIORITY

For every user request:

1. Read the ENTIRE user prompt.
2. Extract EVERY requested task, bug, UI change, behavior change, and constraint.
3. Create an internal checklist before editing.
4. Complete every checklist item.
5. Verify every checklist item after implementation.
6. Do not mark the task complete while any requested item remains unfinished.

IMPORTANT:

A "small" bug is still a required bug.

Never prioritize only the biggest task and ignore smaller requested fixes.

---

# 2. DO NOT EXPAND THE TASK

Only modify code that is necessary for the requested task.

DO NOT automatically:

- redesign unrelated screens
- rewrite architecture unnecessarily
- introduce new backend systems
- add APIs that were not requested
- change database architecture
- change authentication
- change navigation architecture unnecessarily
- add new libraries without need
- change unrelated styling
- modify unrelated features
- add speculative features
- create fake/demo functionality to satisfy a requirement

If the requested task is frontend-only:

> KEEP IT FRONTEND-ONLY.

Do not start backend work unless the user explicitly asks for backend work.

---

# 3. NO ASSUMPTIONS

Before implementing:

- inspect the existing code
- find the existing component
- find the existing state/store
- find the existing navigation flow
- find existing reusable components
- understand how the current feature works

Never assume that something does not exist.

Search the repository first.

If an existing component already solves most of the requirement:

> FIX/EXTEND IT.

Do not create a duplicate component.

---

# 4. IMPLEMENT, DON'T JUST REPORT

When the user says:

- fix
- implement
- make
- improve
- remove
- change
- connect
- make working
- make end-to-end

you MUST modify the code.

Do NOT only:

- explain the problem
- write a report
- describe what should be done
- create a TODO list
- claim it is fixed without changing code

---

# 5. NO PARTIAL IMPLEMENTATION

A feature is NOT complete if only its UI exists.

For requested interactive functionality, verify:

UI
↓
event handler
↓
state/store
↓
persistence where applicable
↓
navigation
↓
destination screen
↓
correct data

Example:

If user asks for:

"Send campaign from chat"

do not only create a button.

It must:

1. open the correct action UI
2. show available campaigns
3. select campaign
4. send campaign
5. persist the relationship
6. show it in chat
7. show the correct campaign details
8. prevent invalid duplicate actions where required

---

# 6. SMALL BUGS MUST NOT BE IGNORED

Never say:

"Main feature is complete; minor issues remain"

if those minor issues were explicitly requested by the user.

Every requested item has equal task-completion importance.

Example:

If the user asks for:

- compare UI
- remove 3-dot button
- fix swipe card
- fix list card
- fix empty space
- fix profile navigation

ALL FIVE must be implemented.

Do not complete only compare UI.

---

# 7. UI / DESIGN RULES

Follow the visual reference provided by the user.

If screenshots are provided:

> Treat screenshots as the primary visual specification.

Match:

- layout
- spacing
- card proportions
- typography hierarchy
- button placement
- icon size
- border radius
- background
- alignment
- interaction patterns
- animation behavior

Do not replace the requested visual direction with a generic design.

Do not invent a different design system unless necessary.

---

# 8. EXISTING APP DESIGN SYSTEM

Preserve the existing app's visual language.

For this project:

- soft light backgrounds
- lavender/lilac surfaces where already established
- warm/off-white cards where appropriate
- dark purple primary actions
- minimal shadows
- clean rounded surfaces
- subtle animations
- compact controls
- mobile-first layouts

Do NOT introduce:

- gradients
- random colors
- oversized controls
- giant modals
- unnecessary shadows
- excessive borders
- unrelated visual styles

Do not change the established app palette just because another generic design rule suggests a different palette.

---

# 9. COMPONENT REUSE

Reuse existing:

- buttons
- cards
- modals
- bottom sheets
- inputs
- tabs
- headers
- task components
- calendar components
- profile components
- campaign components
- creator cards

Before creating a new component:

1. Search for an existing equivalent.
2. Reuse it if possible.
3. Extend it with props/variants if needed.

Do not create duplicate components with nearly identical behavior.

---

# 10. STATE AND DATA

Use the project's existing state architecture.

If Redux is already used:

> Continue using Redux.

If AsyncStorage persistence already exists:

> Preserve it.

Do not create a second source of truth.

Do not hardcode UI state when the feature requires real state.

Avoid:

```ts
const completed = true;
```







DO NOT USE VPS CMD AND DO DEPLOY CODE OR NEW VERSION OF THE APP UNLESS THE USER EXPLICITLY REQUESTS IT. 
AKS FIST DO ANY USE VPS CMD AND DO DEPLOY CODE OR NEW VERSION OF THE APP UNLESS THE USER EXPLICITLY REQUESTS IT.

---

# 11. ANDROID RELEASE PREFLIGHT — MANDATORY

Before building or publishing any Android APK:

1. Treat `apps/mobile/app.json` and the native Android project as separate sources that must agree.
2. Verify the embedded APK metadata with `aapt dump badging`; the package name, `versionName`, and `versionCode` must match the intended release. Never trust only `app.json`.
3. Verify the APK with `apksigner verify --verbose` and `apksigner verify --print-certs`.
4. Release builds MUST use `apps/mobile/credentials/android/keystore.jks` and its configured release alias. Never publish an APK signed with the Android debug key.
5. Compare the APK certificate fingerprint with the previous production APK before calling it an update. Android updates require the same package name and signing certificate, plus a strictly higher `versionCode`.
6. Compare local and remote SHA-256 checksums after upload. Publish the APK atomically through a `.part` file only after the checksum matches.
7. Verify the public APK URL returns HTTP 200, the expected content length, and the same checksum before updating app-version settings.
8. Verify the public app-version endpoint points to the exact verified APK and embedded version. If any check fails, do not deploy or update the release pointer.

---

# 12. MINIMUM WORK AND BLOCKERS

- Make only the smallest change needed for the requested outcome; do not repeat failed approaches or spend time on unrelated work.
- Verify the actual root cause before building, deploying, or changing production data.
- If the necessary step is blocked or cannot be verified, stop, explain the exact blocker and evidence, and ask only for the input needed to continue. Do not claim success or keep guessing.
