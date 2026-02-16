param(
  [Parameter(Mandatory=$true)][string]$BootstrapToken,
  [Parameter(Mandatory=$false)][string]$BaseUrl = "https://traegettransferio9a.vercel.app"
)

$headers = @{ "X-Bootstrap-Token" = $BootstrapToken }

Write-Host "Bootstrap status..."
try {
  $st = Invoke-WebRequest -UseBasicParsing "$BaseUrl/api/admin/bootstrap/status" -Headers $headers
  Write-Host $st.Content
} catch {
  Write-Host $_.Exception.Message
}

Write-Host "Running bootstrap..."
$res = Invoke-WebRequest -UseBasicParsing "$BaseUrl/api/admin/bootstrap" -Method POST -Headers $headers
Write-Host $res.Content

Write-Host "Done."

