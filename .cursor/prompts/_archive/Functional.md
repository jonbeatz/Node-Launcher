\# VPE v2.1: Focused Refinement \& Functional Alignment



Act as a Senior UI Engineer. Clean up the current dashboard to align strictly with the "Node-Launcher-Stitch-Prompt\_6.md" and "VPE PRD" specifications.



\### 1. Sidebar \& Navigation Purge

\- Remove: "Videos Manager", "Custom Toolz", "Troubleshooting", "Instructionz".

\- Keep: "Dashboard" (Active State).

\- Add New Primary Section: "Registry" with a sub-item "Add New Project" (Style this as a high-contrast button with a + icon).

\- Add Section: "Repair Logs" (To track AST Suspense patches).

\- Move "Settings" to the bottom of the sidebar or keep in Top Bar.



\### 2. Project Card "Action Row" Update

Every card in the grid must have exactly these four actions in a pill-shaped button group:

\- \[Start/Stop] (Toggle state based on PM2 status)

\- \[Logs] (Opens/focuses the Log Drawer)

\- \[Repair] (Triggers the Vader Repair Suite modal)

\- \[Nuke] (Vader Red border, high-impact reset)



\### 3. Log Drawer (Right Panel) Enhancement

\- Add a "Project Tab Bar" at the top of the Log Drawer. 

\- Tabs should show the Project Name and a tiny status LED.

\- Ensure the xterm.js terminal area uses "JetBrains Mono" and has the 2% opacity horizontal scanline overlay for the "HUD" effect.



\### 4. Global Framing Fixes

\- Ensure the 1px horizontal 'HUD' lines (#e02b20 at 30% opacity) are visible at the extreme top and bottom of the viewport.

\- The footer must be fixed: "Powered by the MSC Media Engine" (Muted text, centered).



\### 5. Interaction Model

\- When "Add New Project" is clicked, simulate a modal appearing for "Project Registration" with a "Scan Directory" button and auto-detected fields for Package Manager (npm/pnpm/yarn).



\---

"Powered by the MSC Media Engine"

