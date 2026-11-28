# Cai 3A CRM v61 - Lien he tren don (nguoi lien he, dien thoai, email; dien thoai nguoi nhan rieng), Cai dat > Ban hang (mac dinh khi len don, danh muc nguon don), nguoi lien quan, them nhanh khach 3 the, ra soat toan bo Cai dat. Gom ca v60, v59, v58, v57. Nhanh v61, tao tu v60 (hoac v59 / v58 / v57 / v56) neu nhanh do chua gop vao main.
# KHONG co SQL moi, KHONG co bien moi truong moi. Neu chua chay supabase-v58.sql thi chay truoc (sau v56.2). Bien TAX_LOOKUP_* cua v60 van khong bat buoc.
# Chay trong terminal VS Code:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\cai-dat-v61.ps1"
# Neu thu muc 3A-main khong phai repo git (tai zip tu GitHub) thi script tu clone repo sang Desktop\3A va lam o do.
# Them -BoQuaBuild neu may nay chua co .env.local va build bao thieu bien moi truong (Vercel van build lai).
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v61.zip",
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

# Khong lam mat du lieu: dung lai neu repo dang co thay doi chua commit (tru phan con lai cua lan cai v61 truoc dung giua chung)
$dirty = git status --porcelain
Check "kiem tra trang thai repo"
if ($dirty) {
  $managed = '^(src/|README\.md$|supabase-v5[5-8](\.[123])?\.sql$|env\.local\.example$|scripts/|package\.json$|package-lock\.json$)'
  $paths = $dirty | ForEach-Object { (($_.Substring(3)) -replace '^.* -> ', '').Trim('"') }
  $other = @($paths | Where-Object { $_ -notmatch $managed })
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($other.Count -gt 0 -or $branch -ne 'v61') { Write-Host "LOI: repo dang co thay doi chua commit:" -ForegroundColor Red; $dirty | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }; Write-Host "Commit / cat (git stash) cac thay doi do roi chay lai." -ForegroundColor Yellow; exit 1 }
  Write-Host "Repo con thay doi tu lan cai v61 truoc (chi trong src, README, scripts, package*, nhanh v61): chay tiep va ghi de." -ForegroundColor Yellow
}

git fetch origin
Check "lay ban moi tu GitHub (git fetch)"

git rev-parse --verify --quiet v61 | Out-Null
if ($LASTEXITCODE -eq 0) {
  git checkout v61
  Check "chuyen sang nhanh v61"
  git ls-remote --exit-code --heads origin v61 | Out-Null
  if ($LASTEXITCODE -eq 0) { git merge --ff-only origin/v61; Check "cap nhat nhanh v61 tu GitHub (git merge --ff-only)" }
} else {
  git ls-remote --exit-code --heads origin v61 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    git checkout -b v61 --track origin/v61
    Check "lay nhanh v61 tu GitHub"
  } else {
    # Nhanh v60 (hoac v59, v58, v57, v56) tren GitHub chua gop vao main thi tao v61 tu nhanh do (giu nguyen thay doi truoc)
    $base = 'origin/main'
    foreach ($br in @('v60', 'v59', 'v58', 'v57', 'v56')) {
      git ls-remote --exit-code --heads origin $br | Out-Null
      if ($LASTEXITCODE -eq 0) { git merge-base --is-ancestor "origin/$br" origin/main; if ($LASTEXITCODE -ne 0) { $base = "origin/$br"; Write-Host "Nhanh $br chua gop vao main: tao v61 tu origin/$br." -ForegroundColor Yellow; break } }
    }
    git checkout -b v61 $base
    Check "tao nhanh v61 tu $base"
  }
}

$tmp = Join-Path $env:TEMP ("3a-v61-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v61'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }
foreach ($need in @('src\crm\components\kit\add-name-pop.tsx', 'src\crm\modules\settings\sales-settings.tsx', 'src\crm\components\kit\status-filter.tsx', 'src\crm\components\kit\tax-lookup.tsx', 'src\crm\lib\taxcode.ts', 'src\app\api\tax\lookup\route.ts', 'src\app\api\_lib\tax.ts')) {
  if (-not (Test-Path (Join-Path $src $need))) { throw "Zip khong dung ban v61 moi nhat (thieu $need)" }
}

Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Recurse -Force (Join-Path $src 'src\app\*') (Join-Path $Repo 'src\app')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
Copy-Item -Force (Join-Path $src 'env.local.example') (Join-Path $Repo 'env.local.example')
foreach ($f in @('supabase-v55.1.sql', 'supabase-v55.3.sql', 'supabase-v56.sql', 'supabase-v56.2.sql', 'supabase-v58.sql')) { Copy-Item -Force (Join-Path $src $f) (Join-Path $Repo $f) }
New-Item -ItemType Directory -Force (Join-Path $Repo 'scripts') | Out-Null
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v61.ps1') (Join-Path $Repo 'scripts\cai-dat-v61.ps1')
Remove-Item -Recurse -Force $tmp

npm.cmd install --no-audit --no-fund
Check "npm install"
if ($BoQuaBuild) { Write-Host "Bo qua build thu (Vercel se build)." -ForegroundColor Yellow } else {
  npm.cmd run build
  Check "npm run build (neu bao thieu bien moi truong: chay lai voi -BoQuaBuild)"
}

git add -A src README.md env.local.example supabase-v55.1.sql supabase-v55.3.sql supabase-v56.sql supabase-v56.2.sql supabase-v58.sql package.json package-lock.json scripts/cai-dat-v61.ps1
Check "git add"
git status --short
git commit -m "v61: Lien he tren don (nguoi lien he, dien thoai, email nhan hoa don; dien san tu ho so, sua rieng don, luu vao ho so khi co quyen; dien thoai nguoi nhan tach rieng; email tren don dien san khi Gui email / Yeu cau xuat hoa don) + o Xuat hoa don thue tren hang tieu de + bang chon san pham co anh, phan trang o o tim nhanh va o Ma / Ten tung dong + Cai dat > Ban hang (mac dinh khi len don, danh muc nguon don, nut + tren form) + nguoi lien quan (them / bo, nguoi duoc them thay don) + them nhanh khach 3 the nhieu nguoi lien he + chi tiet don bo ghi chu thua, nhan tai kho ghi ro kho + ra soat toan bo Cai dat (khong tran / cuon ngang 1440px) + sua ngay hom nay theo gio may"
Check "git commit"
git push -u origin v61
Check "git push"
Write-Host "Xong. Khong co SQL moi o v61 (neu chua chay supabase-v58.sql thi chay truoc). Mo Pull Request tu nhanh v61 vao main, xem ban Vercel Preview truoc khi gop." -ForegroundColor Green
