$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$defaultVoice = $synth.Voice.Name
[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()
while (($line = [Console]::In.ReadLine()) -ne $null) {
    try {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $message = $line | ConvertFrom-Json
        $voice = [string]$message.voice
        if ([string]::IsNullOrWhiteSpace($voice)) { $synth.SelectVoice($defaultVoice) } else { $synth.SelectVoice($voice) }
        $synth.Rate = [Math]::Max(-10, [Math]::Min(10, [int]$message.rate))
        $synth.Volume = [Math]::Max(0, [Math]::Min(100, [int]$message.volume))
        $synth.Speak([string]$message.text)
        [Console]::Out.WriteLine("OK"); [Console]::Out.Flush()
    } catch {
        [Console]::Out.WriteLine("ERR " + $_.Exception.Message); [Console]::Out.Flush()
    }
}
$synth.Dispose()
