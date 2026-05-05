\# 🚀 VPE Operational Guide: Build \& Execution



This guide outlines the protocols for running your project and viewing it on `localhost:3000` using the \*\*Vader Project Engine (VPE)\*\*.



\---



\## 🖥️ Method 1: Using the VPE Dashboard (Recommended)



Since the \*\*Vader Project Engine\*\* is built to eliminate terminal clutter, the intended workflow is via the visual interface.



\*   \*\*Launch VPE\*\*: Open the Electron application on your \*\*Vader\*\* workstation.

\*   \*\*Locate Project\*\*: Find the specific card for your project in the \*\*Vader Grid\*\*.

\*   \*\*Vader Run Toggle\*\*: Click the \*\*Start\*\* pill-shaped button on the project card.

\*   \*\*Automatic Detection\*\*: The engine will automatically detect your package manager (`pnpm`, `npm`, or `yarn`) and execute the `detectedStartScript` (usually `dev`) via the \*\*PM2 Programmatic API\*\*.

\*   \*\*View Localhost\*\*: Once the \*\*Pulsing Status LED\*\* turns green and the \*\*Performance Strip\*\* shows active telemetry, the dashboard will provide a link, or you can manually navigate to `http://localhost:3000` in your browser.



\---



\## ⌨️ Method 2: Manual Terminal Execution



If you need to run the build and start commands manually while maintaining \*\*VPE standards\*\*, follow the \*\*Vader Protocol\*\* for process management.



\### 1. Build the Project

Before starting a production-ready local server, you must run the build sequence.



```powershell

\# Navigate to your project root

cd "D:\\Cursor\_Projectz\\Node-Launcher"



\# Execute the build (optimized for 9700x I/O)

pnpm run build







To see your project live at localhost:3000:



\# Start the development environment

pnpm run dev

