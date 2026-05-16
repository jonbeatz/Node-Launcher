# UI/UX & High-Performance Design Standards

This document defines the high-end design standards for the Vader Project Engine.

## Modern Tech Stack (2026)

- **Framework:** Next.js 16 (App Router + PPR + Cache Components)
- **Styling:** Tailwind CSS v4 (Zero-runtime, OKLCH colors, Container Queries)
- **UI Registries:** Animate UI, Shadcn/UI, UntitledUI, ForgeUI, Cult UI
- **Animations:** Motion for React (Framer), React Bits
- **Icons:** Lucide React, SVGL (Brand Assets)
- **Linter:** `@google/design.md` (Design system validation)

## Design System Tokens

### Colors (OKLCH)
Prefer OKLCH for better color accuracy and accessibility.
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
