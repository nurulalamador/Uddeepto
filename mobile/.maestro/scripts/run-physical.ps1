param(
    [Parameter(Mandatory = $true)][string]$Serial,
    [string]$IncludeTags = '',
    [string]$ExcludeTags = 'destructive,media',
    [string]$MaestroCommand = 'maestro'
)

# Opt-in runner for an already connected physical Android phone. No device creation.
$ErrorActionPreference = 'Stop'
$suiteDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixturePath = Join-Path $suiteDirectory 'local\env.json'
if (-not (Test-Path -LiteralPath $fixturePath)) { throw 'Start npm run maestro:fixtures first.' }
if ($Serial -match '^emulator-' -or $Serial.Contains(',')) { throw 'Select one physical Android phone.' }
Get-Command adb -ErrorAction Stop | Out-Null
Get-Command $MaestroCommand -ErrorAction Stop | Out-Null
$deviceState = & adb -s $Serial get-state 2>$null
if ($LASTEXITCODE -ne 0 -or "$deviceState".Trim() -ne 'device') { throw 'The selected phone is not connected and authorized.' }
$qemu = & adb -s $Serial shell getprop ro.kernel.qemu
if ($LASTEXITCODE -ne 0) { throw 'Could not verify the selected device.' }
$hardware = & adb -s $Serial shell getprop ro.hardware
if ($LASTEXITCODE -ne 0 -or "$qemu".Trim() -eq '1' -or "$hardware" -match 'goldfish|ranchu') { throw 'Emulators are not allowed.' }
$values = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
if ($values.API_URL -ne 'http://127.0.0.1:4400/api/v1') { throw 'This runner only supports the isolated local fixture API.' }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:4400/health' -TimeoutSec 5
if ($health.service -ne 'backend-simple') { throw 'The local fixture API is not ready.' }
& adb -s $Serial reverse tcp:4400 tcp:4400
if ($LASTEXITCODE -ne 0) { throw 'Could not connect the phone to the local API.' }
# Native document pickers read these explicit fixtures from a dedicated Downloads folder.
& adb -s $Serial shell mkdir -p /sdcard/Download/UddeeptoMaestro
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the fixture directory on the phone.' }
foreach ($fixtureName in @('maestro-cv.pdf', 'invalid-cv.pdf', 'maestro-audio.wav')) {
    & adb -s $Serial push (Join-Path $suiteDirectory "assets\$fixtureName") "/sdcard/Download/UddeeptoMaestro/$fixtureName"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy $fixtureName to the selected phone." }
}
New-Item -ItemType Directory -Path (Join-Path $suiteDirectory 'artifacts') -Force | Out-Null
$maestroArgs = @('--device', $Serial, 'test', '--format', 'junit', '--output', 'artifacts\report.xml')
foreach ($property in $values.PSObject.Properties) { $maestroArgs += @('-e', "$($property.Name)=$($property.Value)") }
if ($IncludeTags) { $maestroArgs += "--include-tags=$IncludeTags" }
if ($ExcludeTags) { $maestroArgs += "--exclude-tags=$ExcludeTags" }
$maestroArgs += '.'
Push-Location -LiteralPath $suiteDirectory
try {
    & $MaestroCommand @maestroArgs
    $resultCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $resultCode
