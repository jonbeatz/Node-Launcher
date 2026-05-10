vader-project-engine/

│

├── README.md                          # Master Execution Plan (human-facing)

├── .cursorrules                       # Global Law v1.5 (always-on enforcement)

├── .cursor/docs/core/VPE_ENGINE_CAPABILITIES.md  # Agent identity + hooks/prompt index (v1.9.9+)

├── .cursor/docs/guides/PRD.md         # Feature \& Requirement Truth

├── .cursor/docs/core/Vader-Project-Engine.md  # UI Design Generation Prompt

├── package.json                       # Executable scripts (when created)

│

├── src/                               # (When development begins)

│   ├── main/                          # Electron main process (Hardware/PM2 logic)

│   ├── renderer/                      # Next.js UI (Vader Protocol styling)

│   └── preload/                       # IPC bridge (contextBridge isolation)

│

├── scripts/                           # (When development begins)

│   └── repair/                        # AST logic \& vader-fix-suspense.mjs

│

├── media/                             # Generated assets (thumbnails, screenshots)

│

├── cache/                             # Puppeteer thumbnail cache

│   └── thumbnails/

│

└── .cursor/

&#x20;   ├── docs/

&#x20;   │   ├── core/                      # TRUTH, VPE-BUILD-PROTOCOL, AGENT-BOOT, VPE_ENGINE_CAPABILITIES

&#x20;   │   └── guides/                    # START-HERE, Custom-Commands, Stability, PRD, Checkpoint

&#x20;   │

&#x20;   └── rules/

&#x20;       ├── vader-hardware-optimization.mdc    # Ryzen 9700x + Win11 I/O rules

&#x20;       ├── vader-shield-ipc.mdc              # Security isolation enforcement

&#x20;       ├── vader-repair-ast.mdc              # Safe code transformation rules

&#x20;       └── vader-protocol-ui.mdc             # Studio Dark design enforcement

