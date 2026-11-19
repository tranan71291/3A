# Cai 3A CRM v42 vao repo C:\Users\admin\3A (nhanh v42), build thu roi day len GitHub.
# Chay trong PowerShell (mo o thu muc chua file nay):
#   powershell -ExecutionPolicy Bypass -File .\cai-dat-v42.ps1
# Zip mac dinh o Downloads; neu de cho khac: them -Zip "duong\dan\3A-CRM-v42.zip"
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v42.zip",
  [string]$Repo = "C:\Users\admin\3A"
)
$ErrorActionPreference = 'Stop'

function Check($msg) { if ($LASTEXITCODE -ne 0) { Write-Host "LOI: $msg (ma $LASTEXITCODE). Dung lai, chua day gi len GitHub." -ForegroundColor Red; exit 1 } }

if (-not (Test-Path $Zip)) { throw "Khong thay file zip: $Zip" }
if (-not (Test-Path (Join-Path $Repo '.git'))) { throw "Khong thay repo git o: $Repo" }
Set-Location $Repo

# 1. Xem thay doi dang co (src / README chep tay truoc do se duoc ghi de bang ban v42)
Write-Host "Thay doi hien co trong repo:" -ForegroundColor Cyan
git status --short
Check "git status"

# 2. Chuyen sang nhanh v42 (tao moi neu chua co); thay doi chua commit duoc mang theo
git rev-parse --verify --quiet v42 | Out-Null
if ($LASTEXITCODE -eq 0) {
  git checkout v42
  Check "chuyen sang nhanh v42"
} else {
  git checkout -b v42
  Check "tao nhanh v42"
}

# 3. Giai nen vao thu muc tam
$tmp = Join-Path $env:TEMP ("3a-v42-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v42'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }

$hadSingle = git ls-files single-file
Check "git ls-files"

# 4. Thay src/crm; chep de src/app, src/lib; README, SQL v38/v39, script; bo single-file
Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Recurse -Force (Join-Path $src 'src\app\*') (Join-Path $Repo 'src\app')
Copy-Item -Recurse -Force (Join-Path $src 'src\lib\*') (Join-Path $Repo 'src\lib')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
foreach ($f in 'supabase-v38.sql', 'supabase-v39.sql') { Copy-Item -Force (Join-Path $src $f) (Join-Path $Repo $f) }
New-Item -ItemType Directory -Force (Join-Path $Repo 'scripts') | Out-Null
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v42.ps1') (Join-Path $Repo 'scripts\cai-dat-v42.ps1')
if (Test-Path (Join-Path $Repo 'single-file')) { Remove-Item -Recurse -Force (Join-Path $Repo 'single-file') }
Remove-Item -Recurse -Force $tmp

# 5. Cai thu vien va build thu
npm.cmd install
Check "npm install"
npm.cmd run build
Check "npm run build"

# 6. Commit va day len nhanh v42 (chi file cua ban cap nhat; .env.local khong duoc them)
git add -A src README.md supabase-v38.sql supabase-v39.sql scripts/cai-dat-v42.ps1
Check "git add"
if ($hadSingle) {
  git add -A single-file
  Check "git add single-file"
}
git status --short
git commit -m "v42: Cai dat, Bao gia, Hop dong lam lai + tich hop AI (de xuat v42)"
Check "git commit"
git push -u origin v42
Check "git push"

Write-Host "Xong. Mo GitHub tranan71291/3A, tao Pull Request tu nhanh v42 vao main va xem ban Vercel Preview truoc khi gop." -ForegroundColor Green
