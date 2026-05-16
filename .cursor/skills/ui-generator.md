# cult-ui-expert

Expert agent for integrating Cult UI and AI SDK agent patterns.

## 1. Trigger
Use this skill when implementing advanced AI agent UIs, RAG interfaces, or competitor research tools.

## 2. Capabilities
- **92+ Patterns:** Access to high-performance AI SDK patterns (Competitor Research, Data Analysis, Accessibility Audit).
- **Pro Blocks:** Gemini Image Editor, Evaluator-Optimizer, Orchestrator Pattern.
- **Workflow:** Use `agent-browser` to read `cult-ui.com/docs` and pull the latest TypeScript schemas for agent-human interaction artifacts.

## 3. Best Practices
- **Parallel Research:** Use Firecrawl Map + Parallel Scrape as seen in Cult's research agent.
- **Artifact Streaming:** Always implement real-time artifact streaming for complex agent outputs.
- **shadcn-compatible:** All components must follow the shadcn install pattern.

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
