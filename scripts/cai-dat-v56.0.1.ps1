# Cai 3A CRM v56.0.1 (ban va: tao anh dung mo hinh OpenAI moi gpt-image-2.5-flare / sunburst, Cai dat kiem tra mo hinh that, man Hinh anh gon lai; cung nhanh v56). Chay duoc ca khi chua cai v56 (zip chua toan bo code).
# Chay trong terminal VS Code:  powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\cai-dat-v56.0.1.ps1"
# Neu thu muc 3A-main khong phai repo git (tai zip tu GitHub) thi script tu clone repo sang Desktop\3A va lam o do.
# Them -BoQuaBuild neu may nay chua co .env.local va build bao thieu bien moi truong (Vercel van build lai).
param(
  [string]$Zip = "$HOME\Downloads\3A-CRM-v56.0.1.zip",
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
if ($dirty) {
  # Lan cai truoc dung giua chung (vd. loi npm) da chep code moi vao repo: neu thay doi chi nam trong cac thu muc script quan ly va dang o nhanh v56 thi cho chay tiep
  $managed = '^(src/|README\.md$|supabase-v5[56](\.[13])?\.sql$|env\.local\.example$|scripts/|package\.json$|package-lock\.json$)'
  $paths = $dirty | ForEach-Object { (($_.Substring(3)) -replace '^.* -> ', '').Trim('"') }
  $other = @($paths | Where-Object { $_ -notmatch $managed })
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($other.Count -gt 0 -or $branch -ne 'v56') { Write-Host "LOI: repo dang co thay doi chua commit:" -ForegroundColor Red; $dirty | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }; Write-Host "Commit / cat (git stash) cac thay doi do roi chay lai." -ForegroundColor Yellow; exit 1 }
  Write-Host "Repo con thay doi tu lan cai truoc (chi trong src, README, scripts, package*, nhanh v56): chay tiep va ghi de bang ban v56.0.1." -ForegroundColor Yellow
}

git fetch origin
Check "lay ban moi tu GitHub (git fetch)"

# Nhanh v56: dung lai nhanh co san (local / GitHub), neu chua co thi tao moi
git rev-parse --verify --quiet v56 | Out-Null
if ($LASTEXITCODE -eq 0) {
  git checkout v56
  Check "chuyen sang nhanh v56"
  git ls-remote --exit-code --heads origin v56 | Out-Null
  if ($LASTEXITCODE -eq 0) { git merge --ff-only origin/v56; Check "cap nhat nhanh v56 tu GitHub (git merge --ff-only)" }
} else {
  git ls-remote --exit-code --heads origin v56 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    git checkout -b v56 --track origin/v56
    Check "lay nhanh v56 tu GitHub"
  } else {
    # Neu nhanh v55 tren GitHub chua gop vao main thi tao v56 tu v55 (khong mat thay doi v55.x)
    $base = 'origin/main'
    git ls-remote --exit-code --heads origin v55 | Out-Null
    if ($LASTEXITCODE -eq 0) { git merge-base --is-ancestor origin/v55 origin/main; if ($LASTEXITCODE -ne 0) { $base = 'origin/v55'; Write-Host "Nhanh v55 chua gop vao main: tao v56 tu origin/v55." -ForegroundColor Yellow } }
    git checkout -b v56 $base
    Check "tao nhanh v56 tu $base"
  }
}

$tmp = Join-Path $env:TEMP ("3a-v5601-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp '3A-CRM-v56.0.1'
if (-not (Test-Path (Join-Path $src 'src\crm\app\App.tsx'))) { throw "Zip khong dung cau truc (thieu src\crm\app\App.tsx)" }

Remove-Item -Recurse -Force (Join-Path $Repo 'src\crm')
Copy-Item -Recurse (Join-Path $src 'src\crm') (Join-Path $Repo 'src\crm')
Copy-Item -Recurse -Force (Join-Path $src 'src\app\*') (Join-Path $Repo 'src\app')
Copy-Item -Force (Join-Path $src 'README.md') (Join-Path $Repo 'README.md')
Copy-Item -Force (Join-Path $src 'env.local.example') (Join-Path $Repo 'env.local.example')
foreach ($f in @('supabase-v55.1.sql', 'supabase-v55.3.sql', 'supabase-v56.sql')) { Copy-Item -Force (Join-Path $src $f) (Join-Path $Repo $f) }
New-Item -ItemType Directory -Force (Join-Path $Repo 'scripts') | Out-Null
Copy-Item -Force (Join-Path $src 'scripts\cai-dat-v56.0.1.ps1') (Join-Path $Repo 'scripts\cai-dat-v56.0.1.ps1')
Remove-Item -Recurse -Force $tmp

# Neu dang chay "npm run dev" thi tat truoc (Ctrl+C), tranh loi khoa file node_modules tren Windows
npm.cmd install --no-audit --no-fund
Check "npm install"
# Chi cai them goi con thieu trong package.json (ban truoc da cai thi bo qua)
function NeedPkgs([string[]]$names) {
  $pkg = Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json
  $have = @()
  if ($pkg.dependencies) { $have += $pkg.dependencies.PSObject.Properties.Name }
  if ($pkg.devDependencies) { $have += $pkg.devDependencies.PSObject.Properties.Name }
  return @($names | Where-Object { $have -notcontains $_ })
}
$need = NeedPkgs @('jspdf', 'html2canvas', 'nodemailer')
if ($need.Count -gt 0) {
  Write-Host ("Cai them: " + ($need -join ', ')) -ForegroundColor Cyan
  npm.cmd install @need --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Host "Thu lai voi --legacy-peer-deps" -ForegroundColor Yellow; npm.cmd install @need --no-audit --no-fund --legacy-peer-deps }
  Check ("cai " + ($need -join ' ') + " (gui lai cac dong 'npm error' o tren)")
} else { Write-Host "jspdf, html2canvas, nodemailer da co: bo qua." -ForegroundColor Green }
$needD = NeedPkgs @('@types/nodemailer')
if ($needD.Count -gt 0) {
  npm.cmd install -D @needD --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { npm.cmd install -D @needD --no-audit --no-fund --legacy-peer-deps }
  Check "cai @types/nodemailer (gui lai cac dong 'npm error' o tren)"
}
if ($BoQuaBuild) { Write-Host "Bo qua build thu (Vercel se build)." -ForegroundColor Yellow } else {
  npm.cmd run build
  Check "npm run build (neu bao thieu bien moi truong: chay lai voi -BoQuaBuild)"
}

git add -A src README.md env.local.example supabase-v55.1.sql supabase-v55.3.sql supabase-v56.sql package.json package-lock.json scripts/cai-dat-v56.0.1.ps1
Check "git add"
git status --short
git commit -m "v56.0.1: tao anh dung gpt-image-2.5-flare (mac dinh) va gpt-image-2.5-sunburst (chi tiet cao), tu doi ten mo hinh da ngung, Cai dat kiem tra mo hinh that, loi tieng Viet, man Hinh anh 2 cot gon"
Check "git commit"
git push -u origin v56
Check "git push"
Write-Host "Xong. Mo Pull Request tu nhanh v56 vao main, xem ban Vercel Preview truoc khi gop." -ForegroundColor Green
