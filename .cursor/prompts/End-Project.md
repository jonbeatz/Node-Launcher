# End Project — VPE session closeout

When the operator says **End Project**, **closeout**, or **end session**, execute this wrap-up ritual to ensure all work is documented, committed, and ready for the next day.

## Agent procedure (canonical order)

1. **Verify State:**
   - Run `npm run typecheck` and `npm run lint` to ensure no lingering TS/lint errors remain in the `src/` tree. 
   - Report any failures to the operator before proceeding. Do NOT commit broken code without approval.

2. **Log the Work:**
   - Update `VADER_STATION_LOG.md` at the repo root.
   - Add a brief bulleted summary of today's achievements, architectural decisions, or bugs squashed under a new heading with today's date.
   - Example:
     ```markdown
     ## [Date] — [Brief Title]
     - Implemented X feature using Y pattern.
     - Fixed Z bug by updating `persistent-store.js`.
     - Next session: Start by testing the X feature edge cases.
     ```

3. **Status Check:**
   - Run `git status` to see exactly what files were modified.

4. **Commit and Push:**
   - Stage all changes (`git add .`).
   - Draft a clear, descriptive conventional commit message based on the day's work.
   - Commit the changes (`git commit -m "chore: end of day session sync"` or similar).
   - Push to the current remote branch (`git push`).

5. **Handoff:**
   - Inform the operator that the log is updated, the code is pushed, and the session is safely archived.
   - Provide a 1-sentence recap of what the *very first* task should be when they run **Start Project** tomorrow: follow **`Start-Project.md`** so the agent **auto-starts** **`.\google-api\vpe-start-api.ps1 -StartNgrok`** and **`vpe-ping-api.ps1`** unless they explicitly ask for **verify-only** (paths + **:4000** probe only).