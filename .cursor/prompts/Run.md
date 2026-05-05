taskkill /F /IM electron.exe /T; if (Test-Path src\\renderer\\.next) { Remove-Item -Recurse -Force src\\renderer\\.next }; npm run dev

