# Sovereign Design System Specification (DESIGN.md)

This file defines the visual identity and UI/UX standards for the Vader Project Engine. It is intended for both human developers and AI design agents.

## 1. Visual Identity

- **Brand:** My Studio Channel (MSC)
- **Vibe:** Technical, Sovereign, High-Performance, Studio-Dark.
- **Base Surface:** `oklch(15% 0.01 250)` (Deep Space Black)
- **Accent Color:** `oklch(60% 0.15 250)` (Vader Blue)
- **Warning Color:** `oklch(65% 0.2 30)` (Amber Glow)

## 2. Typography

- **Headings:** Geist Sans (Standard) / Inter
- **Body:** Geist Sans
- **Monospace:** Geist Mono / JetBrains Mono (Terminal/Code)
- **Base Size:** 16px
- **Scale:** 1.250 (Major Third)

## 3. Component Standards (Tailwind v4)

### Buttons
- **Primary:** `bg-vader-blue text-white hover:bg-vader-blue/90 transition-all rounded-lg px-4 py-2 font-semibold shadow-vader`
- **Ghost:** `text-vader-blue hover:bg-vader-blue/10 rounded-lg px-4 py-2 transition-colors`

### Cards
- **Container:** `bg-surface border border-white/5 rounded-xl p-6 shadow-xl backdrop-blur-md`
- **Hover:** `hover:border-vader-blue/30 hover:shadow-vader-soft transition-all`

## 4. Layout Protocols

- **Grid:** 12-column responsive grid.
- **Spacing:** Multiples of 4px (1rem = 16px).
- **Container:** Max-width 1280px (7xl) for dashboard content.

## 5. Agent Instructions

When generating UI, agents MUST:
1. Prioritize **Magic UI** for landing pages and high-impact animations.
2. Use **OKLCH** color values for all CSS.
3. Ensure **Dark Mode** is the primary and default experience.
4. Implement **Skeleton States** for all data-fetching components.
5. Use **Lucide React** for icons, but check **SVGL** for brand logos.

## 6. Accessibility (A11y)

- **Contrast:** Maintain 4.5:1 ratio for all body text.
- **Focus:** Use high-visibility rings for keyboard navigation.
- **Semantic:** Use proper HTML tags (main, section, nav, aside).
