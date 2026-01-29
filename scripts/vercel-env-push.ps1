param(
  [Parameter(Mandatory=$false)][string]$EnvFile = ".env.production.local",
  [Parameter(Mandatory=$false)][string]$Environment = "production"
)

if (-not (Test-Path $EnvFile)) {
  Write-Error "Env dosyası bulunamadı: $EnvFile"
  exit 1
}

$pairs = @()
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0) { return }
  if ($line.StartsWith("#")) { return }
  $idx = $line.IndexOf("=")
  if ($idx -le 0) { return }
  $name = $line.Substring(0, $idx).Trim()
  $val = $line.Substring($idx + 1)
  if ($name.Length -eq 0) { return }
  $pairs += [PSCustomObject]@{ Name = $name; Value = $val }
}

if ($pairs.Count -eq 0) {
  Write-Error "Env dosyasında değişken bulunamadı."
  exit 1
}

foreach ($p in $pairs) {
  Write-Host "Vercel env set: $($p.Name) ($Environment)"
  $p.Value | npx.cmd --yes vercel@latest env add $p.Name $Environment --force --sensitive | Out-Host
}

Write-Host "Bitti."
