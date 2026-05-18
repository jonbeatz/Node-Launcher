param([int]$Port = 9226)

$src = @"
using System;
using System.Runtime.InteropServices;
using System.Net;

public class TcpForce {
    [StructLayout(LayoutKind.Sequential)]
    public struct MIB_TCPROW {
        public uint dwState;
        public uint dwLocalAddr;
        public uint dwLocalPort;
        public uint dwRemoteAddr;
        public uint dwRemotePort;
    }

    [DllImport("iphlpapi.dll")]
    public static extern uint SetTcpEntry(ref MIB_TCPROW pTcpRow);

    public static void Kill(string localIp, int localPort, string remoteIp, int remotePort) {
        var row = new MIB_TCPROW();
        row.dwState = 12; // DELETE_TCB
        row.dwLocalAddr = BitConverter.ToUInt32(IPAddress.Parse(localIp).GetAddressBytes(), 0);
        row.dwLocalPort = (uint)((localPort >> 8) | ((localPort & 0xFF) << 8)) << 16;
        row.dwRemoteAddr = BitConverter.ToUInt32(IPAddress.Parse(remoteIp).GetAddressBytes(), 0);
        row.dwRemotePort = (uint)((remotePort >> 8) | ((remotePort & 0xFF) << 8)) << 16;
        SetTcpEntry(ref row);
    }
}
"@

Add-Type -TypeDefinition $src -Language CSharp -ErrorAction SilentlyContinue

$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    Write-Host "Killing TCP connection: Local=$($c.LocalAddress):$($c.LocalPort) Remote=$($c.RemoteAddress):$($c.RemotePort) State=$($c.State) PID=$($c.OwningProcess)"
    try {
        $remAddr = if ($c.RemoteAddress -and $c.RemoteAddress -ne '0.0.0.0') { $c.RemoteAddress } else { '0.0.0.0' }
        $remPort = if ($c.RemotePort) { $c.RemotePort } else { 0 }
        [TcpForce]::Kill($c.LocalAddress, $c.LocalPort, $remAddr, $remPort)
    } catch {
        Write-Host "  API call error: $_"
    }
}

Start-Sleep -Milliseconds 500
$remaining = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "Port $Port still has connections - trying process kill..."
    foreach ($c in $remaining) {
        $ownerPid = $c.OwningProcess
        if ($ownerPid -and $ownerPid -ne 0) {
            $p = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
            if ($p) { $p | Stop-Process -Force }
        }
    }
    Start-Sleep -Milliseconds 800
}

$final = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($final) {
    Write-Host "WARNING: Port $Port still occupied after cleanup"
} else {
    Write-Host "Port $Port is now free"
}
