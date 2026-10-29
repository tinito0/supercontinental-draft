# Windows built-in OCR (Windows.Media.Ocr) on one image; prints one JSON line per recognised text line with its
# bounding box (in the original image's coordinates), so the caller can rebuild the table layout from positions.
#   powershell -NoProfile -ExecutionPolicy Bypass -File ocr.ps1 <image> [-Crop x,y,w,h] [-Scale 3] [-Threshold 160]
# -Crop/-Scale/-Threshold: light text on the game's semi-transparent panels OCRs badly as is; cropping, keeping
# only pixels brighter than Threshold (as black on white) and upscaling makes the digits readable.
param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [string]$Language = 'es-ES',
    [string]$Crop,   # "x,y,w,h" (a string: powershell -File does not bind comma lists to int[])
    [int]$Scale = 1,
    [int]$Threshold = 0,
    [string]$DebugImage,  # save the preprocessed image here instead of deleting it
    [switch]$Bold
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 writes stdout in the console code page; callers parse it as UTF-8 (names with accents).
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$offsetX, $offsetY = 0, 0
$sourcePath = (Resolve-Path -LiteralPath $ImagePath).Path
if ($Crop -or $Scale -gt 1 -or $Threshold -gt 0) {
    Add-Type -AssemblyName System.Drawing
    $original = [System.Drawing.Bitmap]::new($sourcePath)
    $c = if ($Crop) { [int[]]($Crop -split ',') }
    $rect = if ($Crop) { [System.Drawing.Rectangle]::new($c[0], $c[1], $c[2], $c[3]) }
            else { [System.Drawing.Rectangle]::new(0, 0, $original.Width, $original.Height) }
    $offsetX, $offsetY = $rect.X, $rect.Y
    $cropped = $original.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $original.Dispose()
    if ($Threshold -gt 0) {
        # LockBits instead of GetPixel: a 400x700 crop with GetPixel takes seconds in PowerShell.
        $data = $cropped.LockBits([System.Drawing.Rectangle]::new(0, 0, $cropped.Width, $cropped.Height),
            [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $cropped.PixelFormat)
        $bytes = New-Object byte[] ($data.Stride * $cropped.Height)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
        for ($row = 0; $row -lt $cropped.Height; $row++) {
            $p = $row * $data.Stride
            for ($col = 0; $col -lt $cropped.Width; $col++) {
                $lum = (0.114 * $bytes[$p] + 0.587 * $bytes[$p + 1] + 0.299 * $bytes[$p + 2])
                $v = if ($lum -ge $Threshold) { 0 } else { 255 }
                $bytes[$p] = $v; $bytes[$p + 1] = $v; $bytes[$p + 2] = $v
                $p += 3
            }
        }
        if ($Bold) {
            # Thicken strokes by one pixel to the right and down: thin glyphs like "0" are otherwise skipped.
            $copy = [byte[]]$bytes.Clone()
            for ($row = 0; $row -lt $cropped.Height - 1; $row++) {
                for ($col = 0; $col -lt $cropped.Width - 1; $col++) {
                    $p = $row * $data.Stride + $col * 3
                    if ($copy[$p] -eq 0) {
                        foreach ($q in ($p + 3), ($p + $data.Stride), ($p + $data.Stride + 3)) {
                            $bytes[$q] = 0; $bytes[$q + 1] = 0; $bytes[$q + 2] = 0
                        }
                    }
                }
            }
        }
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
        $cropped.UnlockBits($data)
    }
    $scaled = [System.Drawing.Bitmap]::new($cropped.Width * $Scale, $cropped.Height * $Scale)
    $g = [System.Drawing.Graphics]::FromImage($scaled)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($cropped, 0, 0, $scaled.Width, $scaled.Height)
    $g.Dispose(); $cropped.Dispose()
    $sourcePath = Join-Path ([System.IO.Path]::GetTempPath()) ("scl_ocr_" + [guid]::NewGuid().ToString('N') + '.png')
    $scaled.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $scaled.Dispose()
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

function Await($operation, [Type]$resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait()
    return $task.Result
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($sourcePath)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Language))
if ($null -eq $engine) { throw "No OCR engine for $Language" }
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

foreach ($line in $result.Lines) {
    $words = @($line.Words)
    $x = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
    $y = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
    $right = ($words | ForEach-Object { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure-Object -Maximum).Maximum
    [pscustomobject]@{
        text = $line.Text
        x = [int]($x / $Scale + $offsetX); y = [int]($y / $Scale + $offsetY); w = [int](($right - $x) / $Scale)
    } | ConvertTo-Json -Compress
}
$stream.Dispose()
if ($sourcePath -like '*scl_ocr_*') {
    if ($DebugImage) { Move-Item -LiteralPath $sourcePath -Destination $DebugImage -Force }
    else { Remove-Item -LiteralPath $sourcePath -ErrorAction SilentlyContinue }
}
