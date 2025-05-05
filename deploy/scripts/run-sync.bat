@echo off
cd /d %~dp0\..\..
node incremental-sync.js >> sync.log 2>&1 