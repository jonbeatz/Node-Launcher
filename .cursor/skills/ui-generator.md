# sovereign-ui-generator

Expert UI component generator specializing in high-performance React + Tailwind v4 components.

## 1. Trigger
Use this skill when asked to "Create a UI component," "Design a page," or "Implement a feature from Figma."

## 2. Technical Stack
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 (OKLCH, CSS Variables)
- **Library:** Magic UI, Shadcn/UI, UntitledUI
- **Icons:** Lucide React

## 3. Workflow
1. Read `DESIGN.md` to refresh design standards.
2. Use `untitledui` or `magic-ui` MCPs to find base components.
3. If a Figma link is provided, use `figma-mcp` to extract layout.
4. Generate the component with full TypeScript types and clean Tailwind classes.
5. Include a skeleton state for loading.

## 4. Design Rules
- Always use `oklch()` for colors.
- Use `framer-motion` for all non-trivial animations.
- Ensure the component is responsive (mobile-first).
- Default to **Dark Mode** surfaces.
