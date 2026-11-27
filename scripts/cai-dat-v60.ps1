# Cai 3A CRM v60 - Tao don hang + Chi tiet don hang bo cuc moi (theo anh da duyet) + Tra cuu ma so thue (tao don, form khach hang, yeu cau xuat hoa don). Gom ca v59, v58, v57. Nhanh v60, tao tu v59 (hoac v58 / v57 / v56) neu nhanh do chua gop vao main.
# KHONG co SQL moi. Bien moi truong moi KHONG bat buoc: TAX_LOOKUP_URL / TAX_LOOKUP_KEY / TAX_LOOKUP_CLIENT_ID / TAX_LOOKUP_RATE_PER_MIN / TAX_LOOKUP_DISABLED (xem env.local.example). Neu chua chay supabase-v58.sql thi chay truoc (sau v56.2).
# Chay trong terminal VS Code:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\cai-dat-v60.ps1"
# Neu thu muc 3A-main khong phai repo git (tai zip tu GitHub) thi script tu clone repo sang Desktop\3A va lam o do.
# Them -BoQuaBuild neu may nay chua co .env.local va build bao thieu bien moi truong (Vercel van build lai).
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v60.zip",
  [string]$Repo = "$HOME\Desktop\3A-main",
  [string]$Url = "https://github.com/tranan71291/3A.git",
  [switch]$BoQuaBuild
)
$ErrorActionPreference = 'Stop'
function Check($msg) { if ($LASTEXITCODE -ne 0) { Write-Host "LOI: $msg (ma $LASTEXITCODE). Dung lai, chua day gi len GitHub." -ForegroundColor Red; exit 1 } }

if (-not (Test-Path $Zip)) { throw "Khong thay file zip: $Zip" }
git --version | Out-Null
Check "chua cai Git (tai o git-scm.com)"

if (-not (Test-Path (Join-Path $Repo '.git'))) {
  Write-Host "$Repo khong phai repo git (ban tai zip). Dung repo o Desktop\3A." -ForegroundColor Yellow
  $Repo = "$HOME\Desktop\3A"
  if (Test-Path $Repo) {
    if (-not (Test-Path (Join-Path $Repo '.git'))) { throw "Thu muc $Repo da co nhung khong phai repo git. Doi ten / xoa thu muc do roi chay lai." }
  } else {
    git clone $Url $Repo
    Check "clone repo tu GitHub (dang nhap GitHub khi duoc hoi)"
  }
}
Set-Location $Repo
Write-Host "Repo: $Repo" -ForegroundColor Cyan

$gname = git config user.name
$gmail = git config user.email
if (-not $gname -or -not $gmail) { Write-Host "LOI: Git tren may nay chua co ten / email. Chay 2 lenh sau (thay bang thong tin cua ban) roi chay lai script:" -ForegroundColor Red; Write-Host '  git config --global user.name "Ten cua ban"'; Write-Host '  git config --global user.email "email-github-cua-ban"'; exit 1 }

# Khong lam mat du lieu: dung lai neu repo dang co thay doi chua commit (tru phan con lai cua lan cai v60 truoc dung giua chung)
$dirty = git status --porcelain
Check "kiem tra trang thai repo"
if ($dirty) {
  $managed = '^(src/|README\.md$|supabase-v5[5-8](\.[123])?\.sql$|env\.local\.example$|scripts/|package\.json$|package-lock\.json$)'
  $paths = $dirty | ForEach-Object { (($_.Substring(3)) -replace '^.* -> ', '').Trim('"') }
  $other = @($paths | Where-Object { $_ -notmatch $managed })
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($other.Count -gt 0 -or $branch -ne 'v60') { Write-Host "LOI: repo dang co thay doi chua commit:" -ForegroundColor Red; $dirty | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }; Write-Host "Commit / cat (git stash) cac thay doi do roi chay lai." -ForegroundColor Yellow; exit 1 }
  Write-Host "Repo con thay doi tu lan cai v60 truoc (chi trong src, README, scripts, package*, nhanh v60): chay tiep va ghi de." -ForegroundColor Yellow
}

git fetch origin
Check "lay ban moi tu GitHub (git fetch)"

git rev-parse --verify --quiet v60 | Out-Null
if ($LASTEXITCODE -eq 0) {
  git checkout v60
  Check "chuyen sang nhanh v60"
  git ls-remote --exit-code --heads origin v60 | Out-Null
  if ($LASTEXITCODE -eq 0) { git merge --ff-only origin/v60; Check "cap nhat nhanh v60 tu GitHub (git merge --ff-only)" }
} else {
  git ls-remote --exit-code --heads origin v60 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    git checkout -b v60 --track origin/v60
    Check "lay nhanh v60 tu GitHub"
  } else {
    # Nhanh v59 (hoac v58, v57, v56) tren GitHub chua gop vao main thi tao v60 tu nhanh do (giu nguyen thay doi truoc)
    $base = 'origin/main'
    foreach ($br in @('v59', 'v58', 'v57', 'v56')) {
      git ls-remote --exit-code --heads origin $br | Out-Null
      if ($LASTEXITCODE -eq 0) { git merge-base --is-ancestor "origin/$br" origin/main; if ($LASTEXITCODE -ne 0) { $base = "origin/$br"; Write-Host "Nhanh $br chua gop vao main: tao v60 tu origin/$br." -ForegroundColor Yellow; break } }
    }
    git checkout -b v60 $base
    Check "tao nhanh v60 tu $base"
  }
}

$tmp = Join-Path $env:TEMP ("3a-v60-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v60'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }
foreach ($need in @('src\crm\components\kit\status-filter.tsx', 'src\crm\components\kit\tax-lookup.tsx', 'src\crm\lib\taxcode.ts', 'src\app\api\tax\lookup\route.ts', 'src\app\api\_lib\tax.ts')) {
  if (-not (Test-Path (Join-Path $src $need))) { throw "Zip khong dung ban v60 moi nhat (thieu $need)" }
}

Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Recurse -Force (Join-Path $src 'src\app\*') (Join-Path $Repo 'src\app')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
Copy-Item -Force (Join-Path $src 'env.local.example') (Join-Path $Repo 'env.local.example')
foreach ($f in @('supabase-v55.1.sql', 'supabase-v55.3.sql', 'supabase-v56.sql', 'supabase-v56.2.sql', 'supabase-v58.sql')) { Copy-Item -Force (Join-Path $src $f) (Join-Path $Repo $f) }
New-Item -ItemType Directory -Force (Join-Path $Repo 'scripts') | Out-Null
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v60.ps1') (Join-Path $Repo 'scripts\cai-dat-v60.ps1')
Remove-Item -Recurse -Force $tmp

npm.cmd install --no-audit --no-fund
Check "npm install"
if ($BoQuaBuild) { Write-Host "Bo qua build thu (Vercel se build)." -ForegroundColor Yellow } else {
  npm.cmd run build
  Check "npm run build (neu bao thieu bien moi truong: chay lai voi -BoQuaBuild)"
}

git add -A src README.md env.local.example supabase-v55.1.sql supabase-v55.3.sql supabase-v56.sql supabase-v56.2.sql supabase-v58.sql package.json package-lock.json scripts/cai-dat-v60.ps1
Check "git add"
git status --short
git commit -m "v60: Tao don hang bo cuc moi (bo tieu de, 2 cot Thong tin khach hang / Thong tin don hang, bang San pham, Thong tin giao hang + khung Thong tin thanh toan, khach le ghi MST, tai lieu chon truoc khi luu; sua phi van chuyen khi doi lai Tai quay) + Chi tiet don hang moi trang thai (phieu DON HANG BAN ke o nhan dam, bang hang gon 1440px, dong tong, quy trinh tung buoc kem nguoi co quyen duyet, nguoi lien quan, tai lieu lien quan, lich su thanh toan, gui email PDF / mailto, nut Tu choi) + Tra cuu ma so thue qua may chu /api/tax/lookup (MST 10, 10-3, so dinh danh 12 so; tao don, form khach hang, yeu cau xuat hoa don theo loai nguoi mua)"
Check "git commit"
git push -u origin v60
Check "git push"
Write-Host "Xong. Khong co SQL moi o v60 (neu chua chay supabase-v58.sql thi chay truoc). Tra cuu ma so thue chay ngay voi nguon mac dinh (VietQR); muon doi nguon thi them bien TAX_LOOKUP_* tren Vercel. Mo Pull Request tu nhanh v60 vao main, xem ban Vercel Preview truoc khi gop." -ForegroundColor Green
