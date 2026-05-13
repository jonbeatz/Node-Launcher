# Refresh PATH from Machine + User, then verify ngrok from system drive root.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [System.Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location -LiteralPath $env:SystemDrive\
& ngrok version
