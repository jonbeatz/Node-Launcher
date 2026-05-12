# Stitch Activation Prompt: Vader Project Engine (VPE)

**Role:** Senior UI/UX Engineer (Specialist in Studio Dark & Glassmorphism)
**Project:** Vader Project Engine (VPE) v2.0
**Hardware Context:** Optimized for **Vader** (AMD Ryzen 9700x / Gigabyte B650)

### 1. Objectives
Initialize the frontend architecture for the VPE dashboard. You are to design and implement a high-performance, tactical command center UI that allows for the management, repair, and "Nuking" of local Node.js/Next.js environments.

### 2. Required Aesthetic (The Vader Protocol)
Strict adherence to the **Vader Protocol** design system is non-negotiable:
*   **Palette:** Background `#121212`, Surface `#1c1c1c`, Accent (Vader Red) `#e02b20`.
*   **Atmosphere:** Tactical command center with 1px borders (`#333333`) and `vader-glow` shadows.
*   **HUD Framing:** 1px horizontal Vader Red lines at 30% opacity on extreme top/bottom edges.
*   **Typography:** **JetBrains Mono** for all code, terminal, and monospace data.

### 3. Functional Source of Truth
Reference these files verbatim to guide your implementation:
*   **`Node-Launcher-PRD_5.md`**: For feature requirements and PM2/Puppeteer integration logic.
*   **`Node-Launcher-Stitch-Prompt.md`**: For the specific UI component specs and layout instructions.
*   **.cursorrules**: For naming conventions (`msc-` prefix) and "Vader Shield" security constraints.
*   **`vader-protocol-ui_3.mdc`**: For visual token discipline and design standards.

### 4. Immediate Tasks
1.  **Dashboard Grid:** Implement the responsive grid with Project Cards featuring 4:3 WebP thumbnails and pulsing Vader Red LEDs.
2.  **Log Drawer:** Create the glassmorphic side-panel with a terminal area featuring CRT scanline overlays.
3.  **Vader Repair Modal:** Design the AST-diff viewer for Next.js 15 Suspense patching.
4.  **Hardware Badge:** Ensure all cards display the "9700x Tuned" pill badge.

**Constraint:** All interactive elements must meet WCAG AA contrast and feature a 2px solid `#e02b20` focus ring.

---
**"Powered by the MSC Media Engine"**