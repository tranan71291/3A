# Cai 3A CRM v51 tu may o nha: repo mac dinh C:\Users\<ban>\Desktop\3A-main (nhanh v51), build thu roi day len GitHub.
# Chay trong terminal VS Code:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\cai-dat-v51.ps1"
# Neu thu muc 3A-main khong phai repo git (tai zip tu GitHub) thi script tu clone repo sang Desktop\3A va lam o do.
# Them -BoQuaBuild neu may nay chua co .env.local va build bao thieu bien moi truong (Vercel van build lai).
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v51.zip",
  [string]$Repo = "$HOME\Desktop\3A-main",
  [string]$Url = "https://github.com/tranan71291/3A.git",
  [switch]$BoQuaBuild
)
$ErrorActionPreference = 'Stop'
function Check($msg) { if ($LASTEXITCODE -ne 0) { Write-Host "LOI: $msg (ma $LASTEXITCODE). Dung lai, chua day gi len GitHub." -ForegroundColor Red; exit 1 } }

if (-not (Test-Path $Zip)) { throw "Khong thay file zip: $Zip" }
git --version | Out-Null
Check "chua cai Git (tai o git-scm.com)"

# Chon repo: dung 3A-main neu la repo git, neu khong thi clone ban sach sang Desktop\3A
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

# May moi: can ten / email cho commit (khong tu dien email cua ban)
$gname = git config user.name
$gmail = git config user.email
if (-not $gname -or -not $gmail) { Write-Host "LOI: Git tren may nay chua co ten / email. Chay 2 lenh sau (thay bang thong tin cua ban) roi chay lai script:" -ForegroundColor Red; Write-Host '  git config --global user.name "Ten cua ban"'; Write-Host '  git config --global user.email "email-github-cua-ban"'; exit 1 }

# Khong lam mat du lieu: dung lai neu repo dang co thay doi chua commit
$dirty = git status --porcelain
Check "kiem tra trang thai repo"
if ($dirty) { Write-Host "LOI: repo dang co thay doi chua commit:" -ForegroundColor Red; $dirty | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }; Write-Host "Commit / cat (git stash) cac thay doi do roi chay lai." -ForegroundColor Yellow; exit 1 }

git fetch origin
Check "lay ban moi tu GitHub (git fetch)"

# Nhanh v51: dung lai nhanh co san (local / GitHub), neu chua co thi tao tu main moi nhat
git rev-parse --verify --quiet v51 | Out-Null
if ($LASTEXITCODE -eq 0) {
  git checkout v51
  Check "chuyen sang nhanh v51"
} else {
  git ls-remote --exit-code --heads origin v51 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    git checkout -b v51 --track origin/v51
    Check "lay nhanh v51 tu GitHub"
  } else {
    # Neu nhanh v50 tren GitHub chua gop vao main thi tao v51 tu v50 (khong mat thay doi v50)
    $base = 'origin/main'
    git ls-remote --exit-code --heads origin v50 | Out-Null
    if ($LASTEXITCODE -eq 0) { git merge-base --is-ancestor origin/v50 origin/main; if ($LASTEXITCODE -ne 0) { $base = 'origin/v50'; Write-Host "Nhanh v50 chua gop vao main: tao v51 tu origin/v50." -ForegroundColor Yellow } }
    git checkout -b v51 $base
    Check "tao nhanh v51 tu $base"
  }
}

$tmp = Join-Path $env:TEMP ("3a-v51-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v51'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }

Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Recurse -Force (Join-Path $src 'src\app\*') (Join-Path $Repo 'src\app')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
Copy-Item -Force (Join-Path $src 'env.local.example') (Join-Path $Repo 'env.local.example')
New-Item -ItemType Directory -Force (Join-Path $Repo 'scripts') | Out-Null
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v51.ps1') (Join-Path $Repo 'scripts\cai-dat-v51.ps1')
Remove-Item -Recurse -Force $tmp

npm.cmd install
Check "npm install"
npm.cmd install jspdf html2canvas nodemailer
Check "cai jspdf html2canvas nodemailer"
npm.cmd install -D @types/nodemailer
Check "cai @types/nodemailer"
if ($BoQuaBuild) { Write-Host "Bo qua build thu (Vercel se build)." -ForegroundColor Yellow } else {
  npm.cmd run build
  Check "npm run build (neu bao thieu bien moi truong: chay lai voi -BoQuaBuild)"
}

git add -A src README.md env.local.example package.json package-lock.json scripts/cai-dat-v51.ps1
Check "git add"
git status --short
git commit -m "v51.1: nhom Giam doc cau hinh duoc, xoa don hang theo quyen, bang yeu cau xuat hoa don"
Check "git commit"
git push -u origin v51
Check "git push"
Write-Host "Xong. Tao Pull Request tu nhanh v51 va xem ban Vercel Preview truoc khi gop vao main." -ForegroundColor Green
