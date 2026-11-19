# Cài 3A CRM v40 vào repo C:\Users\admin\3A trên nhánh v40, build thử rồi đẩy lên GitHub.
# Chạy trong PowerShell:  powershell -ExecutionPolicy Bypass -File .\cai-dat-v40.ps1 -Zip "$HOME\Downloads\3A-CRM-v40.zip"
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v40.zip",
  [string]$Repo = "C:\Users\admin\3A"
)
$ErrorActionPreference = 'Stop'

function Check($msg) { if ($LASTEXITCODE -ne 0) { Write-Host "LOI: $msg (ma $LASTEXITCODE). Dung lai, chua day gi len GitHub." -ForegroundColor Red; exit 1 } }

if (-not (Test-Path $Zip)) { throw "Khong thay file zip: $Zip" }
if (-not (Test-Path (Join-Path $Repo '.git'))) { throw "Khong thay repo git o: $Repo" }
Set-Location $Repo

# 1. Repo phai sach de khong tron thay doi chua luu
$dirty = git status --porcelain
Check "git status"
if ($dirty) { Write-Host $dirty; throw "Repo con thay doi chua commit. Hay commit hoac stash truoc." }

# 2. Tao nhanh v40 tu nhanh hien tai
git checkout -b v40
Check "tao nhanh v40 (neu nhanh da ton tai: git checkout v40)"

# 3. Giai nen vao thu muc tam
$tmp = Join-Path $env:TEMP ("3a-v40-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v40'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }

$hadSingle = git ls-files single-file
Check "git ls-files"

# 4. Thay src/crm, cap nhat README + script, bo single-file (ban sao thua)
Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v40.ps1') (Join-Path $Repo 'scripts\cai-dat-v40.ps1')
if (Test-Path (Join-Path $Repo 'single-file')) { Remove-Item -Recurse -Force (Join-Path $Repo 'single-file') }
Remove-Item -Recurse -Force $tmp

# 5. Build thu (khong can .env.local de build)
npm.cmd run build
Check "npm run build"

# 6. Commit va day len nhanh v40 (tung lenh rieng)
git add -A src/crm README.md scripts/cai-dat-v40.ps1
Check "git add src/crm"
if ($hadSingle) {
  git add -A single-file
  Check "git add single-file"
}
git status --short
git commit -m "v40: giao dien moi theo de xuat v40, lam lai Bao gia & Hop dong, bo single-file"
Check "git commit"
git push -u origin v40
Check "git push"

Write-Host "Xong. Mo GitHub tranan71291/3A, tao Pull Request tu nhanh v40 va xem ban Vercel Preview truoc khi gop vao main." -ForegroundColor Green
