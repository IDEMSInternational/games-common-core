# Builds the app icon and Android launch-screen source images in
# assets/app/ from the IDEMS Games logo: the knot symbol, cut out with
# smooth edges, on the logo's background colour.
#
# Usage (Windows PowerShell), from this repo:
#   tools/make-app-images.ps1 -Logo path/to/idems-games-logo.png -OutDir assets/app
# The logo must be the full-size original (1672 x 941), where the knot is
# at x 260-551, y 309-549. Each game then turns these into Android
# resources with: npm run app-images
param([string]$Logo, [string]$OutDir)

Add-Type -AssemblyName System.Drawing
$bg = [System.Drawing.Color]::FromArgb(0xf6, 0xf3, 0xed)
$orange = [System.Drawing.Color]::FromArgb(0xfb, 0x63, 0x25)

# 1. Cut out the knot: each pixel becomes orange with an opacity matching
#    how far it is from the background towards the orange.
$src = [System.Drawing.Bitmap]::FromFile($Logo)
$box = New-Object System.Drawing.Rectangle 250, 300, 312, 260   # knot is x 260-551, y 309-549
$knot = New-Object System.Drawing.Bitmap $box.Width, $box.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$full = [math]::Sqrt([math]::Pow($orange.R - $bg.R, 2) + [math]::Pow($orange.G - $bg.G, 2) + [math]::Pow($orange.B - $bg.B, 2))
for ($y = 0; $y -lt $box.Height; $y++) {
  for ($x = 0; $x -lt $box.Width; $x++) {
    $c = $src.GetPixel($box.X + $x, $box.Y + $y)
    $d = [math]::Sqrt([math]::Pow($c.R - $bg.R, 2) + [math]::Pow($c.G - $bg.G, 2) + [math]::Pow($c.B - $bg.B, 2))
    $a = [int][math]::Min(255, [math]::Max(0, ($d / $full) * 255 * 1.08 - 6))
    $knot.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $orange.R, $orange.G, $orange.B))
  }
}
$src.Dispose()

function Save-Composite([int]$size, [double]$knotWidthFraction, [bool]$withBackground, [string]$name) {
  $img = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  if ($withBackground) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }
  $w = [int]($size * $knotWidthFraction)
  $h = [int]($w * $knot.Height / $knot.Width)
  $g.DrawImage($knot, [int](($size - $w) / 2), [int](($size - $h) / 2), $w, $h)
  $img.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $img.Dispose()
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
# Icon on its own (older launchers): knot fills most of the square.
Save-Composite 1024 0.72 $true 'icon-only.png'
# Adaptive icon foreground: knot inside the safe zone launchers never crop.
Save-Composite 1024 0.50 $false 'icon-foreground.png'
# Adaptive icon background: the logo's colour.
$bgImg = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bgImg); $g.Clear($bg); $g.Dispose()
$bgImg.Save((Join-Path $OutDir 'icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png); $bgImg.Dispose()
# Launch screen (Android before 12 shows this full image; 12+ shows the icon).
Save-Composite 2732 0.18 $true 'splash.png'
$knot.Dispose()
Get-ChildItem $OutDir | Select-Object Name, Length
