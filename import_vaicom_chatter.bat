@echo off
setlocal
cd /d "%~dp0"
title ThunderScope VAICOM Chatter Importer

echo ThunderScope - VAICOM Community chatter importer
echo ------------------------------------------------
echo This imports external radio-net ambience, not direct RIO/WSO dialogue.
echo.

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" import_vaicom_chatter.py %*
) else where py >nul 2>nul (
  py -3 import_vaicom_chatter.py %*
) else where python >nul 2>nul (
  python import_vaicom_chatter.py %*
) else (
  echo Python was not found. Start ThunderScope once or install Python 3.11+.
  pause
  exit /b 1
)

echo.
pause
