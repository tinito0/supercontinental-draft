# Crea el acceso directo "SCL Bridge" en el Escritorio, que abre tray.ps1 sin ventana.
#   powershell -ExecutionPolicy Bypass -File pes-collector\bridge\install-shortcut.ps1
# Para quitarlo, borrá el acceso directo. No instala nada más ni arranca solo con Windows.

$tray = Join-Path $PSScriptRoot 'tray.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop 'SCL Bridge.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$tray`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = (Join-Path $env:SystemRoot 'System32\shell32.dll') + ',13'
$shortcut.Description = 'Sube los partidos de PES 2021 a Supercontinental'
$shortcut.Save()
Write-Output "Acceso directo creado: $link"
