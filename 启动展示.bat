@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打包页面...
node build.js || (echo 打包失败，请确认已安装 Node.js & pause & exit /b 1)
start "" http://localhost:8080
node deploy\serve.js dist 8080
pause
