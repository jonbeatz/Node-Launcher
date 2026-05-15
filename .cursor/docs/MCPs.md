# Active MCP Servers Documentation

This document serves as a reference for all currently configured Model Context Protocol (MCP) servers available in your environment.

## local-wp

**Description:** Connects to local WordPress environments for management via @verygoodplugins/mcp-local-wp.
**Usage Example:** Can you list the plugins installed on my local WordPress instance?
**Status:** ✅ Active

## terminal-controller

**Description:** Python-based server that allows AI agents to control and monitor terminal processes.
**Usage Example:** Use the terminal controller to run nvidia-smi and check the output.
**Status:** ✅ Active

## payload

**Description:** Integrates with Payload CMS to create collections, fields, and manage the CMS schema.
**Usage Example:** Create a new Payload collection for Blog Posts with title and content fields.
**Status:** ✅ Active (Auto-fixed to use @govcraft/payload-cms-mcp)

## task-master-ai

**Description:** General-purpose AI task orchestration server.
**Usage Example:** Use task-master-ai to break down this large feature into smaller executable steps.
**Status:** ✅ Active

## sequential-thinking

**Description:** Provides advanced logical reasoning and step-by-step thinking tools for the AI.
**Usage Example:** Use sequential thinking to analyze why this specific database query might be failing.
**Status:** ✅ Active

## mcp-wordpress

**Description:** A Node.js based MCP server for interacting directly with the mscclean.local WordPress site via REST API/App Passwords.
**Usage Example:** Fetch the latest 5 posts from the mscclean.local WordPress site.
**Status:** ✅ Active

## github

**Description:** Official GitHub MCP server to interact with repositories, issues, PRs, and code.
**Usage Example:** Search GitHub for open issues related to this error message.
**Status:** ✅ Active

## playwright

**Description:** Browser automation framework allowing the AI to click, type, and scrape web pages headlessly.
**Usage Example:** Use Playwright to navigate to my site and take a screenshot of the homepage.
**Status:** ✅ Active

## playwright-electron

**Description:** Browser automation framework allowing the AI to click, type, and scrape web pages headlessly.
**Usage Example:** Use Playwright to navigate to my site and take a screenshot of the homepage.
**Status:** ✅ Active

## console-ninja

**Description:** Connects to Console Ninja to pipe live browser/node console logs directly to the AI.
**Usage Example:** Watch the Console Ninja logs while I click this button and tell me if an error throws.
**Status:** ✅ Active

## browser-tools-mcp

**Description:** Connects to the local web browser (via extension) to manipulate active tabs, scrape content, and navigate.
**Usage Example:** Read the current page in my browser and summarize the documentation.
**Status:** ⚠️ Active (Requires Chrome/Edge extension to be installed and Connected)

## browsermcp

**Description:** Connects to the local web browser (via extension) to manipulate active tabs, scrape content, and navigate.
**Usage Example:** Read the current page in my browser and summarize the documentation.
**Status:** ⚠️ Active (Requires Chrome/Edge extension to be installed and Connected)

## postgres

**Description:** Unrestricted direct database access to local PostgreSQL databases.
**Usage Example:** Query the local postgres database to see the schema of the users table.
**Status:** ⚠️ Active (May need valid DATABASE_URI configured in settings if connection fails)

## postman

**Description:** Integrates with Postman collections and APIs to test endpoints.
**Usage Example:** Use the Postman MCP to run the authentication endpoint test.
**Status:** ❌ Needs Configuration (Requires valid POSTMAN_API_KEY in settings. Find it in Cursor -> Settings -> MCP -> Edit Postman)

## neon-postgres

**Description:** Remote connection to Neon serverless Postgres databases.
**Usage Example:** Check the Neon database to see if the migration applied successfully.
**Status:** ✅ Active

## cursor-rules-generator

**Description:** Automatically generates .cursorrules files to enforce coding standards based on your repository.
**Usage Example:** Generate a new cursor rules file for this React project.
**Status:** ✅ Active

## resend

**Description:** Integrates with the Resend API to send and manage transactional emails.
**Usage Example:** Use Resend to trigger a test welcome email to my address.
**Status:** ❌ Needs Configuration (Requires valid RESEND_API_KEY in settings)

## mcp-vercel

**Description:** Custom Vercel MCP to manage deployments, environment variables, and projects.
**Usage Example:** Check the status of my latest Vercel deployment.
**Status:** ❌ Needs Configuration (Requires valid VERCEL_API_TOKEN in settings)

## figma-mcp

**Description:** The official Figma MCP server. Connects directly to Figma's hosted endpoint to extract design layers, tokens, and code connect data.
**Usage Example:** "Implement the selected Figma frame as a React component using Tailwind."
**Status:** ✅ Active (Remote HTTP: https://mcp.figma.com)

## magic-ui-mcp

**Description:** Direct access to Magic UI's library of high-performance React + Tailwind components.
**Usage Example:** "Add a vertical marquee of logos from Magic UI."
**Status:** ✅ Active (npx @magicuidesign/cli install cursor)

## prisma-mcp

**Description:** Database management and schema introspection via Prisma.
**Usage Example:** "List my Prisma databases and run the latest migration."
**Status:** ✅ Active (npx prisma mcp)

## firecrawl

**Description:** Advanced web scraping, crawling, and search tool that turns websites into clean Markdown.
**Usage Example:** "Search the web for the latest Next.js 16 caching patterns using firecrawl."
**Status:** ⚠️ Needs Configuration (Requires FIRECRAWL_API_KEY in .cursor/mcp.json)

## docker-mcp

**Description:** Direct control over local Docker containers, images, and logs.
**Usage Example:** "Check the logs of the postgres container and tell me why it's failing."
**Status:** ✅ Active (npx docker-mcp)

## google-workspace

**Description:** Integrates with Google Sheets, Drive, and Calendar.
**Usage Example:** "Find the 'Project Specs' doc in my Google Drive and summarize it."
**Status:** ⚠️ Needs Configuration (Requires GOOGLE_CREDENTIALS_PATH in .cursor/mcp.json)

## untitledui

**Description:** Component library reference tool for UntitledUI in React.
**Usage Example:** Lookup the documentation for the UntitledUI Button component.
**Status:** ❌ Errored (SSE endpoint may be down or requires authentication. Try restarting in settings.)

## filesystem

**Description:** The official Filesystem MCP server allowing deep workspace read/write access.
**Usage Example:** Search the filesystem for any .env backup files.
**Status:** ✅ Active

## mcpterm

**Description:** Advanced terminal access for the AI agent.
**Usage Example:** Run a long-running build command in the background using mcpterm.
**Status:** ✅ Active

## desktop-commander

**Description:** Deep Windows OS integration allowing the AI to launch apps, manage windows, press keys, and check processes.
**Usage Example:** Use windows-mcp to list all running processes consuming more than 1GB of RAM.
**Status:** ✅ Active

## desktop-automation

**Description:** Deep Windows OS integration allowing the AI to launch apps, manage windows, press keys, and check processes.
**Usage Example:** Use windows-mcp to list all running processes consuming more than 1GB of RAM.
**Status:** ✅ Active

## windows-mcp

**Description:** Deep Windows OS integration allowing the AI to launch apps, manage windows, press keys, and check processes.
**Usage Example:** Use windows-mcp to list all running processes consuming more than 1GB of RAM.
**Status:** ✅ Active

## tavily

**Description:** High-speed AI-optimized web search, scraping, and crawling tool.
**Usage Example:** Use Tavily to research the latest Next.js 15 features released this week.
**Status:** ✅ Active

## fetch

**Description:** Directly fetches HTML from URLs and converts it to clean Markdown for reading documentation.
**Usage Example:** Fetch the documentation page at this URL and tell me how to use the function.
**Status:** ✅ Active (Auto-fixed with PYTHONIOENCODING=utf-8)

