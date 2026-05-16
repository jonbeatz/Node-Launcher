# Agent Orchestration & Design Patterns

This repository utilizes an advanced multi-agent workflow powered by Cursor and the Model Context Protocol (MCP).

## Core Principles

1. **Agent Autonomy:** Agents are empowered to research, design, and implement features with minimal human intervention.
2. **Context-Rich Interactions:** Always provide the agent with full context via `.md` docs and mandatory reads.
3. **Tool-First Workflow:** Prefer MCP tools (GitHub, Magic UI, Postgres, Vercel) over manual data entry.
4. **Sovereign Implementation:** All code must be production-ready and follow the "Sovereign" design standard (clean, modular, documented).

## Advanced Workflow Patterns

### 1. High-Performance UI (Registry-First)
- **Trigger:** "Implement a new React component from a registry."
- **Tools:** `animate-ui-mcp`, `untitledui-mcp`, `agent-browser`.
- **Process:**
  1. Use `animate-ui-mcp` (shadcn) to find and install high-quality animated components.
  2. Use `untitledui-mcp` for standard business UI building blocks.
  3. Use `agent-browser` to visit component libraries (Watermelon, ForgeUI, Cult UI) and extract live code or rationale if MCP is not available.
  4. Generate production JSX with Tailwind v3 classes and OKLCH color tokens.

### 2. Database-Driven Development (Prisma + Postgres)
- **Trigger:** "Add a notifications feed to the database and UI."
- **Tools:** `prisma-mcp`, `postgres-mcp`, `neon-postgres-mcp`.
- **Process:**
  1. Use `prisma-mcp` to update the schema and run migrations.
  2. Use `postgres-mcp` to verify the table structure and seed data.
  3. Implement the frontend using the generated Prisma client.

### 3. Automated Deployment & Verification (Vercel)
- **Trigger:** "Deploy the latest changes to production and verify the build."
- **Tools:** `mcp-vercel`, `fetch-mcp`, `playwright-mcp`.
- **Process:**
  1. Use `mcp-vercel` to trigger or check deployment status.
  2. Use `fetch-mcp` to check the live URL for 200 OK.
  3. Use `playwright-mcp` to run smoke tests on the deployed site.

### 4. High-Efficiency Web Research & Scraping
- **Trigger:** "Find technical examples or research a topic on the live web."
- **Tools:** `firecrawl`, `agent-browser`.
- **Process:**
  1. Use `firecrawl` for deep site mapping and extraction into clean Markdown.
  2. Use `agent-browser` for complex interactive flows (logging into documentation sites, clicking through menus).
  3. Synthesize findings into technical specs or implement directly using the extracted code.

### 5. Automated Design System Validation
- **Trigger:** "Validate my design tokens or check for UI regressions."
- **Tools:** `@google/design.md` (CLI).
- **Process:**
  1. Run `designmd lint DESIGN.md` to check for token errors and WCAG contrast failures.
  2. Run `designmd export --format tailwind` to sync tokens with your Next.js theme.
  3. Analyze JSON reports to fix brand inconsistencies before shipping.

## Active MCP Servers

See [.cursor/docs/MCPs.md](.cursor/docs/MCPs.md) for the full catalog of available tools.

## Agent Skills

Managed via the `Cursor Agent SDK`. Ensure `SKILL.md` files are kept up to date in their respective directories.
