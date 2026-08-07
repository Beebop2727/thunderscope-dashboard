#!/usr/bin/env bash
set -euo pipefail
if command -v apt-get >/dev/null 2>&1; then
  echo "Installing ThunderScope Linux dependencies for Debian/Ubuntu..."
  sudo apt-get update
  sudo apt-get install -y python3 python3-venv python3-pip pipewire-bin speech-dispatcher espeak-ng
  echo
  echo "Installed. Log into your normal desktop session and run ./run_lan.sh (without sudo)."
elif command -v dnf >/dev/null 2>&1; then
  echo "Fedora detected. Installing common dependencies..."
  sudo dnf install -y python3 python3-pip pipewire-utils speech-dispatcher espeak-ng
elif command -v pacman >/dev/null 2>&1; then
  echo "Arch detected. Installing common dependencies..."
  sudo pacman -S --needed python python-pip pipewire speech-dispatcher espeak-ng
else
  echo "Unsupported package manager. Install: Python 3 venv, a WAV player (pw-play/paplay/ffplay/mpv/aplay), and TTS (spd-say or espeak-ng)." >&2
  exit 1
fi
