Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class MicStreamer {
    public const int WAVE_MAPPER = -1;
    public const int CALLBACK_EVENT = 0x00050000;

    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEFORMATEX {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEHDR {
        public IntPtr lpData;
        public uint dwBufferLength;
        public uint dwBytesRecorded;
        public IntPtr dwUser;
        public uint dwFlags;
        public uint dwLoops;
        public IntPtr lpNext;
        public IntPtr reserved;
    }

    [DllImport("winmm.dll")]
    public static extern int waveInGetNumDevs();

    [DllImport("winmm.dll")]
    public static extern int waveInOpen(out IntPtr phwi, int uDeviceID, ref WAVEFORMATEX lpFormat, IntPtr dwCallback, IntPtr dwInstance, int fdwOpen);

    [DllImport("winmm.dll")]
    public static extern int waveInPrepareHeader(IntPtr hwi, ref WAVEHDR pwh, int cbwh);

    [DllImport("winmm.dll")]
    public static extern int waveInUnprepareHeader(IntPtr hwi, ref WAVEHDR pwh, int cbwh);

    [DllImport("winmm.dll")]
    public static extern int waveInAddBuffer(IntPtr hwi, ref WAVEHDR pwh, int cbwh);

    [DllImport("winmm.dll")]
    public static extern int waveInStart(IntPtr hwi);

    [DllImport("winmm.dll")]
    public static extern int waveInStop(IntPtr hwi);

    [DllImport("winmm.dll")]
    public static extern int waveInReset(IntPtr hwi);

    [DllImport("winmm.dll")]
    public static extern int waveInClose(IntPtr hwi);

    public static void StreamToStdout(int maxFrames = 0) {
        if (waveInGetNumDevs() == 0) {
            Console.Error.WriteLine("ERROR: NO_INPUT_DEVICES");
            Environment.Exit(2);
        }

        IntPtr hWaveIn;
        WAVEFORMATEX format = new WAVEFORMATEX();
        format.wFormatTag = 1; // PCM
        format.nChannels = 1;  // Mono
        format.nSamplesPerSec = 16000;
        format.wBitsPerSample = 16;
        format.nBlockAlign = 2;
        format.nAvgBytesPerSec = 32000;
        format.cbSize = 0;

        AutoResetEvent bufferEvent = new AutoResetEvent(false);
        int res = waveInOpen(out hWaveIn, WAVE_MAPPER, ref format, bufferEvent.SafeWaitHandle.DangerousGetHandle(), IntPtr.Zero, CALLBACK_EVENT);
        if (res != 0) {
            Console.Error.WriteLine("ERROR: WAVEIN_OPEN_FAILED " + res);
            Environment.Exit(3);
        }

        int bufferSize = 3200; // 100ms at 16kHz 16-bit mono
        const int numBuffers = 4;
        IntPtr[] pBuffers = new IntPtr[numBuffers];
        WAVEHDR[] headers = new WAVEHDR[numBuffers];

        for (int i = 0; i < numBuffers; i++) {
            pBuffers[i] = Marshal.AllocHGlobal(bufferSize);
            headers[i] = new WAVEHDR();
            headers[i].lpData = pBuffers[i];
            headers[i].dwBufferLength = (uint)bufferSize;
            waveInPrepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
            waveInAddBuffer(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
        }

        Stream stdout = Console.OpenStandardOutput();
        waveInStart(hWaveIn);

        byte[] rawBuffer = new byte[bufferSize];
        int frameCount = 0;

        try {
            while (maxFrames == 0 || frameCount < maxFrames) {
                bufferEvent.WaitOne(200);
                for (int i = 0; i < numBuffers; i++) {
                    if ((headers[i].dwFlags & 0x01) == 0x01) { // WHDR_DONE
                        waveInUnprepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
                        int bytesRec = (int)headers[i].dwBytesRecorded;
                        if (bytesRec > 0) {
                            Marshal.Copy(headers[i].lpData, rawBuffer, 0, bytesRec);
                            stdout.Write(rawBuffer, 0, bytesRec);
                            stdout.Flush();
                            frameCount++;
                        }

                        headers[i].dwBytesRecorded = 0;
                        headers[i].dwFlags = 0;
                        waveInPrepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
                        waveInAddBuffer(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
                    }
                }
            }
        } finally {
            waveInStop(hWaveIn);
            waveInReset(hWaveIn);
            for (int i = 0; i < numBuffers; i++) {
                waveInUnprepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf(typeof(WAVEHDR)));
                Marshal.FreeHGlobal(pBuffers[i]);
            }
            waveInClose(hWaveIn);
            bufferEvent.Dispose();
        }
    }
}
"@

$max = 0
if ($args.Count -gt 0) {
    $max = [int]$args[0]
}
[MicStreamer]::StreamToStdout($max)
