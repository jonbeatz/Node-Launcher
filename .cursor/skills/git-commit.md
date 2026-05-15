# git-commit-sovereign

Expert Git commit message writer following the "Sovereign" project standard.

## 1. Trigger
Use this skill when asked to "Commit my changes" or "Write a commit message."

## 2. Standards
Commit messages must follow the `type(scope): subject` format.

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`.
- **Scope:** The module or component being updated (e.g., `api`, `ui`, `mcp`, `ritual`).
- **Subject:** Imperative mood, present tense (e.g., "add ritual" not "added ritual").

## 3. Workflow
1. Run `git diff --staged` to see changes.
2. Analyze the impact on the "Sovereign" architecture.
3. Write a concise, meaningful message.
4. Execute the commit if authorized.

## 4. Examples
- `feat(mcp): install firecrawl and docker servers`
- `fix(ritual): resolve port 4000 conflict in Start Project`
- `docs(design): create DESIGN.md for UI standards`
