param(
  [Parameter(Mandatory=$true)]
  [string]$AudioPath,
  [string]$Culture = 'en-US'
)

$ErrorActionPreference = 'Stop'

try {
  if (-not (Test-Path $AudioPath)) {
    Write-Output '{"success":false,"text":"","error":"Audio file not found"}'
    exit 0
  }

  Add-Type -AssemblyName System.Speech

  # Find best matching recognizer for requested culture
  $recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
  $targetRec = $recognizers | Where-Object { $_.Culture.Name -eq $Culture } | Select-Object -First 1
  if (-not $targetRec) {
    $targetRec = $recognizers | Where-Object { $_.Culture.Name -like "$($Culture.Split('-')[0])*" } | Select-Object -First 1
  }
  if (-not $targetRec) {
    $targetRec = $recognizers | Select-Object -First 1
  }

  $rec = if ($targetRec) {
    New-Object System.Speech.Recognition.SpeechRecognitionEngine($targetRec)
  } else {
    New-Object System.Speech.Recognition.SpeechRecognitionEngine
  }

  # Load standard dictation grammar
  $dictGrammar = New-Object System.Speech.Recognition.DictationGrammar
  $dictGrammar.Name = "GeneralDictation"
  $rec.LoadGrammar($dictGrammar)

  # Load assistant command grammar choices to significantly improve recognition of common assistant phrases
  $cmdChoices = New-Object System.Speech.Recognition.Choices
  $cmdChoices.Add([string[]]@(
    "hello", "hi", "hey megh", "megh",
    "what is two plus two", "what is 2 plus 2",
    "what is my name", "what is my favorite programming language",
    "create a note", "open calculator", "open chrome", "open notepad",
    "give me my daily brief", "daily brief",
    "how are you", "who are you", "what can you do", "introduce yourself",
    "tell me a joke", "what time is it", "system status"
  ))
  $gb = New-Object System.Speech.Recognition.GrammarBuilder($cmdChoices)
  $cmdGrammar = New-Object System.Speech.Recognition.Grammar($gb)
  $cmdGrammar.Name = "AssistantCommands"
  $cmdGrammar.Priority = 1 # Higher priority for command phrases
  $rec.LoadGrammar($cmdGrammar)

  $rec.SetInputToWaveFile($AudioPath)
  $res = $rec.Recognize([TimeSpan]::FromSeconds(15))

  if ($res -and $res.Text.Trim().Length -gt 0) {
    $json = [PSCustomObject]@{
      success = $true
      text = $res.Text.Trim()
      confidence = [Math]::Round($res.Confidence, 3)
      culture = $rec.RecognizerInfo.Culture.Name
    } | ConvertTo-Json -Compress
    Write-Output $json
  } else {
    Write-Output '{"success":true,"text":"","confidence":0}'
  }

  $rec.Dispose()
} catch {
  Write-Output ('{"success":false,"text":"","error":"' + ($_.Exception.Message -replace '"', '\"') + '"}')
}
