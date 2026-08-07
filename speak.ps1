param(
    [Parameter(Mandatory=$true)][string]$Text,
    [string]$Voice = "",
    [ValidateRange(-10,10)][int]$Rate = -1,
    [ValidateRange(0,100)][int]$Volume = 90
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    if (-not [string]::IsNullOrWhiteSpace($Voice)) {
        try { $synth.SelectVoice($Voice) } catch { }
    }
    $synth.Rate = $Rate
    $synth.Volume = $Volume
    $synth.Speak($Text)
}
finally {
    $synth.Dispose()
}
