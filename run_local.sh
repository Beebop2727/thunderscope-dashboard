#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  echo "Do not run ThunderScope with sudo; it needs your desktop PipeWire/PulseAudio session." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Run ./install_linux_dependencies.sh first." >&2
  exit 1
fi
if [[ ! -x .venv/bin/python ]]; then
  echo "Creating ThunderScope Python environment..."
  python3 -m venv .venv || { echo "python3-venv is missing. Run ./install_linux_dependencies.sh" >&2; exit 1; }
fi
. .venv/bin/activate
python -m pip install --disable-pip-version-check -q -r requirements.txt
echo "ThunderScope is local-only at http://127.0.0.1:8765"
echo "Host Betty and chatter will use this Linux desktop's default audio output."
HOST=127.0.0.1 PORT=8765 python app.py
