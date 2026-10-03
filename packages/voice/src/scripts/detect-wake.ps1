param(
  [Parameter(Mandatory=$true)]
  [string]$AudioPath
)

$ErrorActionPreference = 'Stop'

try {
  if (-not (Test-Path $AudioPath)) {
    Write-Output '{"detected":false,"error":"Audio file not found"}'
    exit 0
  }

  Add-Type -AssemblyName System.Speech

  $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $choices = New-Object System.Speech.Recognition.Choices
  $choices.Add([string[]]@("Hey Megh", "Megh", "Hey Megh AI", "Megh AI"))
  $gb = New-Object System.Speech.Recognition.GrammarBuilder($choices)
  $wakeGrammar = New-Object System.Speech.Recognition.Grammar($gb)
  $wakeGrammar.Name = "WakePhrases"
  $rec.LoadGrammar($wakeGrammar)

  $rec.SetInputToWaveFile($AudioPath)
  $res = $rec.Recognize([TimeSpan]::FromSeconds(3))

  if ($res -and $res.Confidence -ge 0.5) {
    $normalizedPhrase = if ($res.Text -match 'Hey Megh') { 'Hey Megh' } else { 'Megh' }
    $json = [PSCustomObject]@{
      detected = $true
      phrase = $normalizedPhrase
      confidence = [Math]::Round($res.Confidence, 3)
      rawText = $res.Text
    } | ConvertTo-Json -Compress
    Write-Output $json
  } else {
    Write-Output '{"detected":false}'
  }

  $rec.Dispose()
} catch {
  Write-Output ('{"detected":false,"error":"' + ($_.Exception.Message -replace '"', '\"') + '"}')
}
