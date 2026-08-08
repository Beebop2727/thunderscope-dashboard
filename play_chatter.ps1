param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$Volume = 50,
    [double]$DurationSeconds = 1.0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$resolved = (Resolve-Path -LiteralPath $Path).Path
$player.Open([System.Uri]::new($resolved))
$player.Volume = [Math]::Max(0.0, [Math]::Min(1.0, $Volume / 100.0))
Start-Sleep -Milliseconds 110
$player.Play()
Start-Sleep -Milliseconds ([Math]::Ceiling(([Math]::Max(0.1, $DurationSeconds) + 0.20) * 1000.0))
$player.Stop()
$player.Close()
