# Agent Orchestration & Design Patterns

This repository utilizes an advanced multi-agent workflow powered by Cursor and the Model Context Protocol (MCP).

## Core Principles

1. **Agent Autonomy:** Agents are empowered to research, design, and implement features with minimal human intervention.
2. **Context-Rich Interactions:** Always provide the agent with full context via `.md` docs and mandatory reads.
3. **Tool-First Workflow:** Prefer MCP tools (GitHub, Figma, Postgres, Vercel) over manual data entry.
4. **Sovereign Implementation:** All code must be production-ready and follow the "Sovereign" design standard (clean, modular, documented).

## Advanced Workflow Patterns

### 1. Design-to-Code (Figma + Tailwind)
- **Trigger:** "Implement the selected Figma frame as a React component."
- **Tools:** `figma-mcp`, `magic-ui-mcp`, `untitledui-mcp`.
- **Process:**
  1. Use `figma-mcp` to extract layout, tokens, and assets.
  2. Use `magic-ui-mcp` or `untitledui-mcp` to find matching components.
  3. Generate production JSX with Tailwind v4 classes.

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

## Active MCP Servers

See [.cursor/docs/MCPs.md](.cursor/docs/MCPs.md) for the full catalog of available tools.

## Agent Skills

Managed via the `Cursor Agent SDK`. Ensure `SKILL.md` files are kept up to date in their respective directories.
