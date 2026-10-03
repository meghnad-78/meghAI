Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class WinAudioIn {
    [DllImport("winmm.dll")]
    public static extern int waveInGetNumDevs();

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct WAVEINCAPS {
        public short wMid;
        public short wPid;
        public uint vDriverVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szPname;
        public uint dwFormats;
        public short wChannels;
        public short wReserved1;
    }

    [DllImport("winmm.dll", CharSet = CharSet.Ansi)]
    public static extern int waveInGetDevCaps(IntPtr uDeviceID, out WAVEINCAPS pwic, int cbwic);
}
"@

$num = [WinAudioIn]::waveInGetNumDevs()
$list = @()
for ($i = 0; $i -lt $num; $i++) {
    $caps = New-Object WinAudioIn+WAVEINCAPS
    [void][WinAudioIn]::waveInGetDevCaps([IntPtr]$i, [ref]$caps, [System.Runtime.InteropServices.Marshal]::SizeOf($caps))
    $list += [PSCustomObject]@{
        Id = $i
        Name = $caps.szPname
        Channels = [int]$caps.wChannels
    }
}
$list | ConvertTo-Json -Compress
