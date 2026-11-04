# 一键发布 / 回滚。在你的电脑上运行（PowerShell）：
#   发布：  powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server 服务器IP
#   回滚：  powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server 服务器IP -Rollback
#   看版本：powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Server 服务器IP -List
#
# 发布流程：本地打包 dist/ → 压缩上传 → 解压到服务器 releases/时间戳/ → 把 current 指过去（瞬间切换，不会出现半新半旧）
# 服务器上保留最近 5 个版本，回滚就是把 current 指回上一个版本。
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$User = 'deploy',
  [switch]$Rollback,
  [switch]$List,
  [string]$SiteDir = '/var/www/zhijian'
)
$ErrorActionPreference = 'Stop'
# 中文要原样传给 ssh、原样显示：PowerShell 5.1 默认会把管道里的文字转成 ASCII
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Set-Location (Split-Path -Parent $PSScriptRoot)
$target = "$User@$Server"
$site = $SiteDir

function Invoke-Remote([string]$script) {
  # 远端脚本统一用 LF 换行交给 bash 执行，避免 Windows 换行符把 bash 搞糊涂
  $script = $script.Replace("`r`n", "`n")
  $script | ssh $target 'bash -s'
  if ($LASTEXITCODE -ne 0) { throw "服务器上执行失败（退出码 $LASTEXITCODE）" }
}

if ($List) {
  Invoke-Remote @'
cd __SITE__/releases
cur=$(basename "$(readlink -f __SITE__/current)")
for r in $(ls -1 | sort); do if [ "$r" = "$cur" ]; then echo "* $r  (当前)"; else echo "  $r"; fi; done
'@.Replace('__SITE__', $site)
  exit 0
}

if ($Rollback) {
  Invoke-Remote @'
set -e
cd __SITE__/releases
cur=$(basename "$(readlink -f __SITE__/current)")
prev=$(ls -1 | sort | grep -B1 -x "$cur" | head -n 1)
if [ -z "$prev" ] || [ "$prev" = "$cur" ]; then echo "没有更早的版本可以回滚（当前：$cur）"; exit 1; fi
ln -sfn "__SITE__/releases/$prev" __SITE__/current
echo "已回滚：$cur → $prev"
'@.Replace('__SITE__', $site)
  exit 0
}

Write-Host '== 1/3 本地打包 ==' -ForegroundColor Cyan
node build.js
if ($LASTEXITCODE -ne 0) { throw '打包失败' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tgz = Join-Path $env:TEMP "zhijian-$stamp.tar.gz"
# 用 Windows 自带的 tar：装了 Git 的机器上 PATH 里可能先找到 GNU tar，它会把 C: 当成远程主机
$tarExe = Join-Path $env:SystemRoot 'System32\tar.exe'
if (-not (Test-Path $tarExe)) { $tarExe = 'tar' }
& $tarExe -czf $tgz -C dist .
if ($LASTEXITCODE -ne 0) { throw '压缩失败' }

Write-Host "== 2/3 上传到 $target ==" -ForegroundColor Cyan
scp -q $tgz "${target}:/tmp/zhijian-$stamp.tar.gz"
if ($LASTEXITCODE -ne 0) { throw '上传失败：先确认  ssh ' + $target + '  能登录' }
Remove-Item $tgz

Write-Host '== 3/3 服务器上切换到新版本 ==' -ForegroundColor Cyan
Invoke-Remote @'
set -e
d=__SITE__/releases/__STAMP__
mkdir -p "$d"
tar -xzf /tmp/zhijian-__STAMP__.tar.gz -C "$d"
rm -f /tmp/zhijian-__STAMP__.tar.gz
test -f "$d/index.html"
ln -sfn "$d" __SITE__/current
cd __SITE__/releases
ls -1 | sort | grep -v '^000-placeholder$' | head -n -5 | xargs -r rm -rf
echo "已上线版本 __STAMP__（服务器保留最近 5 个版本）"
'@.Replace('__SITE__', $site).Replace('__STAMP__', $stamp)

Write-Host "`n完成。打开 http://$Server 查看（看不到更新就按 Ctrl+F5）" -ForegroundColor Green
