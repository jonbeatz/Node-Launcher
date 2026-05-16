# UI/UX & High-Performance Design Standards

This document defines the high-end design standards for the Vader Project Engine.

## Modern Tech Stack (2026)

- **Framework:** Next.js 15 (Stable Release)
- **Styling:** Tailwind CSS v3.4 (Stable Baseline)
- **UI Registries:** Animate UI, Shadcn/UI, UntitledUI, ForgeUI, Cult UI
- **Animations:** Motion for React (Framer), React Bits
- **Icons:** Lucide React, SVGL (Brand Assets)
- **Linter:** `@google/design.md` (Design system validation)

## Design System Tokens & Color Space

### Colors (OKLCH)
The project utilizes the **OKLCH** color space for superior perceptual uniformity and accessibility. Although running on Tailwind v3.4, OKLCH values remain fully integrated via custom CSS variable mappings and the `@google/design.md` validation layer.

- **Primary:** `oklch(60% 0.15 250)` (Vader Blue)
- **Secondary:** `oklch(70% 0.1 200)`
- **Accent:** `oklch(85% 0.2 150)` (Neon Glow)

### Typography
- **Headings:** Inter or Geist Sans (Bold, Tight tracking)
- **Body:** Inter or Geist Mono (Standard tracking)

## High-Performance UI Patterns

1. **Micro-Interactions:** Every button and card should have a subtle hover/active state.
2. **Skeleton States:** Always use skeleton loaders for data-heavy components.
3. **Motion Sense:** Use `AnimatePresence` for smooth entry/exit of elements.
4. **Dark Mode First:** All designs must be built with Dark Mode as the primary experience.

## Tooling Integration

- **Figma MCP:** Use the official Figma MCP to pull live design tokens directly into Tailwind config.
- **Magic UI:** Prioritize Magic UI components for high-impact landing pages and dashboard sections.
