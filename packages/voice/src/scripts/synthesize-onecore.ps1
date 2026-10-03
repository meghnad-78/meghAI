param (
    [Parameter(Mandatory=$true)]
    [string]$Text,
    [Parameter(Mandatory=$false)]
    [string]$VoiceName = "",
    [Parameter(Mandatory=$false)]
    [double]$Rate = 1.0,
    [Parameter(Mandatory=$false)]
    [double]$Volume = 1.0,
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

function Await-WinRtTask($winRtTask, [Type]$resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($winRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

$synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]::new()

if ($VoiceName) {
    $allVoices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
    $match = $allVoices | Where-Object { 
        $_.DisplayName -like "*$VoiceName*" -or $_.Id -like "*$VoiceName*" 
    } | Select-Object -First 1
    if ($match) {
        $synth.Voice = $match
    }
}

if ($synth.Options) {
    try {
        $r = [Math]::Max(0.5, [Math]::Min(3.0, $Rate))
        $synth.Options.SpeakingRate = $r
    } catch {}
    try {
        $v = [Math]::Max(0.0, [Math]::Min(1.0, $Volume))
        $synth.Options.AudioVolume = $v
    } catch {}
}

$op = $synth.SynthesizeTextToStreamAsync($Text)
$stream = Await-WinRtTask $op ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

$dataReader = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]::new($stream)
$loadOp = $dataReader.LoadAsync($stream.Size)
$loaded = Await-WinRtTask $loadOp ([uint32])

$bytes = New-Object byte[] $stream.Size
$dataReader.ReadBytes($bytes)

[System.IO.File]::WriteAllBytes($OutputFile, $bytes)
Write-Output "SUCCESS:$OutputFile:SIZE:$($bytes.Length)"
