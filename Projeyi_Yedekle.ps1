$DateStr = Get-Date -Format "yyyy_MM_dd_HH_mm"
$VersionsDir = "D:\Dh_Servis\_VERSIONS"
if (!(Test-Path $VersionsDir)) {
    New-Item -ItemType Directory -Force -Path $VersionsDir | Out-Null
}
$ZipPath = "D:\Dh_Servis\_VERSIONS\Yedek_$DateStr.zip"

Write-Host "Yedekleme basliyor..." -ForegroundColor Cyan

Compress-Archive -Path "src", "public", "scripts", "sunucu", ".agents", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "firebase.json", "firestore.rules", "firestore.indexes.json", "index.html", "sap_list.xlsx" -DestinationPath $ZipPath -Force

$fileInfo = Get-Item $ZipPath
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

Write-Host "Yedekleme tamamlandi! Dosya: $ZipPath ($sizeMB MB)" -ForegroundColor Green

