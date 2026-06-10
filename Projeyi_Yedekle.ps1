$DateStr = Get-Date -Format "yyyy_MM_dd_HH_mm"
$BackupDir = "C:\Users\FatihZebek\Desktop\Dh_Servis\_VERSIONS\Yedek_$DateStr"
$ZipPath = "C:\Users\FatihZebek\Desktop\Dh_Servis\_VERSIONS\Yedek_$DateStr.zip"

Write-Host "Yedekleme basliyor..." -ForegroundColor Cyan

# Klasoru olustur (istege bagli, eger ziplenmemis halini de gormek isterseniz)
# New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
# Copy-Item -Path "src" -Destination "$BackupDir\src" -Recurse
# Copy-Item -Path "package.json" -Destination $BackupDir

# Zip olustur
Compress-Archive -Path "src", "package.json", "index.html", "vite.config.ts" -DestinationPath $ZipPath -Force

Write-Host "Yedekleme tamamlandi! Dosya: $ZipPath" -ForegroundColor Green
Write-Host "Cikmak icin bir tusa basin..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
