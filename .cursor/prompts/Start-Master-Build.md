Open PowerShell or your terminal of choice.

Navigate to the root of the VPE project:

cd "D:\\Cursor\_Projectz\\Node-Launcher"

Execute the start command:
pnpm run start





The Quick Fix (Core Setup)
If you already have Node.js installed, you can activate pnpm instantly by running this command in your PowerShell window:

corepack enable

After running that, try your start command again:

pnpm run start



The Direct Install (If Corepack Fails)
If the above doesn't work, install it globally using npm (which comes with Node.js):

npm install -g pnpm


Once finished, close and restart PowerShell to refresh the path, then navigate back and run:

cd "D:\Cursor_Projectz\Node-Launcher"
pnpm run start







pnpm run dev



in terminal run npm run dev or yarn dev




To launch your Vader v2 system and see the results of the UI Prop Sanitization Fix, you need to execute the start scripts through your terminal. Since you are using a WordPress/Next.js/Node.js stack hosted via Spaceship, your environment likely uses standard npm or yarn commands.

## 🚀 Execution Commands
Open your terminal in Cursor (Ctrl + ~) and run one of the following depending on your specific configuration:

Standard Development Launch:
npm run dev or yarn dev

Vader Protocol Full-Stack Sync:
If you have separate scripts for your renderer and main process (typical for Electron/Next.js apps like this), use:
npm run start





# 🏁 VADER ENGINE DEPLOYMENT CHECK

1.  **Verify Fix**: Check `src/renderer/components/Msc_ProjectCard.tsx` to ensure no props are leaking into the DOM.
2.  **Environment Check**: Ensure the system recognizes the **RTX 5060 Ti** and **9700x**.
3.  **Action**: Run the primary development script (`npm run dev`) and monitor the console for any remaining "Leakage Audit" errors.
4.  **Confirm**: Ensure the footer displays 'Powered by the MSC Media Engine'.











&#x20;```

&#x20;   \*This command triggers the Electron main process defined in `src/main/main.js`, initializing the \*\*Vader Shield\*\* and the \*\*PM2 Manager\*\*.\*



\---



\#### Option 2: Launch via the Built Executable

If you have already run a production build, you can launch the app like any other Windows program:



1\.  \*\*Navigate to the release folder\*\*:

&#x20;   \*   Go to `D:\\Cursor\_Projectz\\Node-Launcher\\dist` (or your configured output directory).

2\.  \*\*Run the Executable\*\*:

&#x20;   \*   Find \*\*VPE.exe\*\* (or \*\*Vader-Project-Engine.exe\*\*) and double-click it.

3\.  \*\*Verify System Tray\*\*:

&#x20;   \*   Check the Windows System Tray (bottom right) for the \*\*Vader Red\*\* icon to confirm the \*\*Vader Status Tray\*\* is active.



\---



\### 🛡️ Post-Launch Verification

Once the window opens, ensure the following \*\*Vader Protocol\*\* elements are present:



\*   \*\*HUD Frame\*\*: You should see faint 1px red lines at the extreme top and bottom of the window.

\*   \*\*The Signature\*\*: "Powered by the MSC Media Engine" must be visible in the footer.

\*   \*\*Hardware Confirmation\*\*: Look for the \*\*9700x Tuned\*\* badge in the UI to ensure the hardware-level optimizations are active.



\*\*Status\*\*: If the window remains black or shows an error, check the \*\*Log Drawer\*\* in your terminal for any IPC handshake failures.



\*\*Powered by the MSC Media Engine\*\*

















