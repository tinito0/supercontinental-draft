# SCL Bridge: icono en la bandeja que mantiene corriendo el puente (bridge.mjs) mientras se juega.
# Se abre con el acceso directo "SCL Bridge" (install-shortcut.ps1). Sin dependencias: PowerShell 5.1 + Windows Forms.
#
# Color del icono (lee <probeDir>\_bridge\status.json cada 2 s):
#   gris = esperando partido o solo local, verde = partido en vivo subiendose, azul = subida en pausa,
#   amarillo = sin conexion (los partidos quedan en cola), rojo = error de configuracion (token, funcion).
# Si el puente se cae lo reinicia (como mucho cada 10 s). Al salir del icono, el puente termina tambien.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\SCLBridgeTray', [ref]$created)
if (-not $created) {
    [System.Windows.Forms.MessageBox]::Show('SCL Bridge ya está abierto: buscá el ícono junto al reloj.', 'SCL Bridge') | Out-Null
    exit
}

$bridgeScript = Join-Path $PSScriptRoot 'bridge.mjs'
$configFile = Join-Path $env:APPDATA 'scl-bridge\config.json'
$probeDir = 'E:\eFootball PES 2021\scl_probe'
if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($config.probeDir) { $probeDir = $config.probeDir }
}
$outDir = Join-Path $probeDir '_bridge'
$statusFile = Join-Path $outDir 'status.json'
$logFile = Join-Path $outDir 'bridge.log'
$pausedFile = Join-Path $outDir 'paused'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    [System.Windows.Forms.MessageBox]::Show('No se encontró Node.js. Instalalo desde nodejs.org y volvé a abrir SCL Bridge.', 'SCL Bridge') | Out-Null
    exit
}

function New-DotIcon([string]$color) {
    $bitmap = New-Object System.Drawing.Bitmap 16, 16
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
    $graphics.FillEllipse($brush, 1, 1, 14, 14)
    $graphics.Dispose()
    return [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
}

$icons = @{
    starting = New-DotIcon '#9CA3AF'
    idle     = New-DotIcon '#9CA3AF'
    local    = New-DotIcon '#9CA3AF'
    live     = New-DotIcon '#22C55E'
    paused   = New-DotIcon '#3B82F6'
    offline  = New-DotIcon '#F59E0B'
    error    = New-DotIcon '#EF4444'
}

$script:bridge = $null
$script:nextStart = [DateTime]::MinValue
$script:lastState = ''
$script:status = $null

function Start-Bridge {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $node.Source
    $info.Arguments = "`"$bridgeScript`" --parent $PID"
    $info.WorkingDirectory = $PSScriptRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $script:bridge = [System.Diagnostics.Process]::Start($info)
    $script:nextStart = (Get-Date).AddSeconds(10)
}

function Stop-Bridge {
    if ($script:bridge -and -not $script:bridge.HasExited) { $script:bridge.Kill() }
}

function Read-Status {
    if (-not (Test-Path $statusFile)) { return $null }
    try { return Get-Content $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icons.starting
$tray.Text = 'SCL Bridge: iniciando'
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$headline = $menu.Items.Add('Iniciando...')
$headline.Enabled = $false
$menu.Items.Add('-') | Out-Null
$showStatus = $menu.Items.Add('Estado')
$openLog = $menu.Items.Add('Abrir log')
$openFolder = $menu.Items.Add('Abrir carpeta')
$togglePause = $menu.Items.Add('Pausar subida')
$menu.Items.Add('-') | Out-Null
$quit = $menu.Items.Add('Salir')
$tray.ContextMenuStrip = $menu

$showStatus.Add_Click({
    $s = $script:status
    if (-not $s) { $text = 'Todavía no hay estado (el puente está arrancando).' }
    else {
        $text = "Estado: $($s.state)`n$($s.message)`nEn cola: $($s.queued)"
        if ($s.match) { $text += "`nPartido: $($s.match.label)" }
        if ($s.lastSentAt) { $text += "`nÚltima subida: " + ([DateTimeOffset]::FromUnixTimeMilliseconds([int64]$s.lastSentAt).LocalDateTime) }
    }
    [System.Windows.Forms.MessageBox]::Show($text, 'SCL Bridge') | Out-Null
})
$tray.Add_DoubleClick({ $showStatus.PerformClick() })
$openLog.Add_Click({ if (Test-Path $logFile) { Start-Process notepad.exe -ArgumentList "`"$logFile`"" } })
$openFolder.Add_Click({ if (Test-Path $outDir) { Start-Process explorer.exe -ArgumentList "`"$outDir`"" } })
$togglePause.Add_Click({
    if (Test-Path $pausedFile) { Remove-Item $pausedFile } else { New-Item -ItemType File -Path $pausedFile -Force | Out-Null }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
    if ((-not $script:bridge -or $script:bridge.HasExited) -and (Get-Date) -ge $script:nextStart) { Start-Bridge }
    $togglePause.Text = $(if (Test-Path $pausedFile) { 'Reanudar subida' } else { 'Pausar subida' })
    $s = Read-Status
    if ($s -and $script:bridge -and $s.pid -eq $script:bridge.Id) {
        $script:status = $s
        $state = [string]$s.state
    } else {
        $state = 'starting'
        $s = $null
    }
    $message = $(if ($s) { [string]$s.message } else { 'Iniciando...' })
    $tray.Icon = $(if ($icons.ContainsKey($state)) { $icons[$state] } else { $icons.idle })
    $tip = "SCL Bridge: $message"
    $tray.Text = $(if ($tip.Length -gt 63) { $tip.Substring(0, 60) + '...' } else { $tip })
    $headline.Text = $message
    if ($state -ne $script:lastState) {
        if ($state -eq 'error') { $tray.ShowBalloonTip(8000, 'SCL Bridge: error', $message, [System.Windows.Forms.ToolTipIcon]::Error) }
        elseif ($state -eq 'live') { $tray.ShowBalloonTip(4000, 'SCL Bridge', $message, [System.Windows.Forms.ToolTipIcon]::Info) }
        $script:lastState = $state
    }
})

$context = New-Object System.Windows.Forms.ApplicationContext
$quit.Add_Click({
    $timer.Stop()
    Stop-Bridge
    $tray.Visible = $false
    $tray.Dispose()
    $context.ExitThread()
})

Start-Bridge
$timer.Start()
try {
    [System.Windows.Forms.Application]::Run($context)
} finally {
    Stop-Bridge
    $tray.Dispose()
    $mutex.ReleaseMutex()
}
