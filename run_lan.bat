@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating ThunderScope environment...
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -m venv .venv
  ) else (
    python -m venv .venv
  )
)

call ".venv\Scripts\activate.bat"
python -m pip install --disable-pip-version-check -q -r requirements.txt
set HOST=0.0.0.0
set PORT=8765
echo Host Betty alerts and optional RIO/WSO chatter will play through this PC's default audio device.
python app.py
pause
