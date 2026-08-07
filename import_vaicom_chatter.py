from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import urllib.request
import wave
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPOSITORY_URL = "https://github.com/Penecruz/VAICOM-Community"
ARCHIVE_URL = f"{REPOSITORY_URL}/archive/refs/heads/master.zip"
THEME_ROOT = "ChatterThemepack/Resources/Audio/Themes/Chatter"
RECOMMENDED_THEMES = ("Navy", "NATO", "RedFlag", "Fallon", "Andersen")
ALL_THEMES = RECOMMENDED_THEMES + ("Afghanistan", "Russia", "WWII")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import VAICOM Community radio-net chatter into ThunderScope."
    )
    parser.add_argument(
        "--source",
        type=Path,
        help="Extracted VAICOM repository folder or downloaded repository ZIP. Downloads master.zip when omitted.",
    )
    parser.add_argument(
        "--theme",
        action="append",
        choices=ALL_THEMES,
        help="Theme to import. Repeat for multiple themes.",
    )
    parser.add_argument(
        "--all-recommended",
        action="store_true",
        help="Import Navy, NATO, RedFlag, Fallon and Andersen.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete an existing destination theme before importing it.",
    )
    return parser.parse_args()


def choose_themes() -> list[str]:
    print("\nVAICOM Community chatter importer")
    print("These are external radio-net recordings, not direct RIO/WSO dialogue.\n")
    print("  1. Navy")
    print("  2. NATO")
    print("  3. Navy + NATO (recommended first test)")
    print("  4. All recommended modern themes")
    print("  5. Select themes manually")
    choice = input("\nChoose 1-5 [3]: ").strip() or "3"
    if choice == "1":
        return ["Navy"]
    if choice == "2":
        return ["NATO"]
    if choice == "4":
        return list(RECOMMENDED_THEMES)
    if choice == "5":
        print("Available: " + ", ".join(ALL_THEMES))
        raw = input("Enter comma-separated theme names: ")
        lookup = {name.lower(): name for name in ALL_THEMES}
        selected = []
        for item in raw.split(","):
            key = item.strip().lower()
            if key in lookup and lookup[key] not in selected:
                selected.append(lookup[key])
        return selected
    return ["Navy", "NATO"]


def download_archive(destination: Path) -> Path:
    print(f"Downloading {ARCHIVE_URL}")
    request = urllib.request.Request(
        ARCHIVE_URL,
        headers={"User-Agent": "ThunderScope-VAICOM-Importer/0.10.1"},
    )
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)
    return destination


def is_pcm_wav(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as wav_file:
            return wav_file.getcomptype() == "NONE" and wav_file.getnframes() > 0
    except (wave.Error, OSError):
        return False


def find_repo_root(source: Path) -> Path:
    candidates = [source, *source.iterdir()] if source.is_dir() else []
    for candidate in candidates:
        if (candidate / "ChatterThemepack" / "Resources" / "Audio" / "Themes" / "Chatter").is_dir():
            return candidate
    raise FileNotFoundError("Could not find the VAICOM ChatterThemepack inside the selected folder.")


def import_from_directory(repo_root: Path, themes: list[str], destination: Path, replace: bool) -> dict[str, int]:
    source_root = repo_root / THEME_ROOT
    counts: dict[str, int] = {}
    for theme in themes:
        source_theme = source_root / theme
        if not source_theme.is_dir():
            print(f"Skipping {theme}: source folder was not found.")
            continue
        target_theme = destination / theme
        if replace and target_theme.exists():
            shutil.rmtree(target_theme)
        target_theme.mkdir(parents=True, exist_ok=True)
        count = 0
        for source_file in sorted(source_theme.glob("*.wav"), key=lambda path: path.name.lower()):
            target_file = target_theme / source_file.name
            shutil.copy2(source_file, target_file)
            if is_pcm_wav(target_file):
                count += 1
            else:
                target_file.unlink(missing_ok=True)
                print(f"  Skipped non-PCM or unreadable WAV: {source_file.name}")
        counts[theme] = count
    licence = repo_root / "LICENCE.md"
    if licence.exists():
        shutil.copy2(licence, destination / "LICENSE-VAICOM-COMMUNITY.md")
    return counts


def import_from_zip(archive: Path, themes: list[str], destination: Path, replace: bool) -> dict[str, int]:
    counts: dict[str, int] = {theme: 0 for theme in themes}
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        for theme in themes:
            target_theme = destination / theme
            if replace and target_theme.exists():
                shutil.rmtree(target_theme)
            target_theme.mkdir(parents=True, exist_ok=True)
            marker = f"/{THEME_ROOT}/{theme}/"
            for member in names:
                if marker not in f"/{member}" or not member.lower().endswith(".wav"):
                    continue
                target_file = target_theme / Path(member).name
                with package.open(member) as source, target_file.open("wb") as output:
                    shutil.copyfileobj(source, output)
                if is_pcm_wav(target_file):
                    counts[theme] += 1
                else:
                    target_file.unlink(missing_ok=True)
                    print(f"  Skipped non-PCM or unreadable WAV: {Path(member).name}")
        licence_member = next((name for name in names if name.endswith("/LICENCE.md")), None)
        if licence_member:
            with package.open(licence_member) as source, (destination / "LICENSE-VAICOM-COMMUNITY.md").open("wb") as output:
                shutil.copyfileobj(source, output)
    return counts


def main() -> int:
    args = parse_args()
    themes = list(RECOMMENDED_THEMES) if args.all_recommended else (args.theme or choose_themes())
    if not themes:
        print("No valid themes selected.")
        return 2
    if "Afghanistan" in themes:
        print("\nWarning: the Afghanistan theme contains real-world combat communications and may be confronting.")
        proceed = input("Continue with that theme? [y/N]: ").strip().lower()
        if proceed not in {"y", "yes"}:
            themes = [theme for theme in themes if theme != "Afghanistan"]
    if not themes:
        print("No themes remain selected.")
        return 2

    base_dir = Path(__file__).resolve().parent
    destination = base_dir / "audio" / "radio" / "vaicom"
    destination.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="thunderscope-vaicom-") as temp_dir:
        source = args.source.resolve() if args.source else download_archive(Path(temp_dir) / "VAICOM-Community-master.zip")
        if source.is_dir():
            counts = import_from_directory(find_repo_root(source), themes, destination, args.replace)
        elif source.is_file() and zipfile.is_zipfile(source):
            counts = import_from_zip(source, themes, destination, args.replace)
        else:
            raise FileNotFoundError("Source must be an extracted VAICOM repository folder or ZIP archive.")

    metadata = {
        "source": REPOSITORY_URL,
        "licence": "MIT License, Copyright (c) 2023 Penecruz",
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "themes": counts,
        "note": "Imported as external radio-net ambience, not direct RIO/WSO dialogue.",
    }
    (destination / "VAICOM-IMPORT.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    total = sum(counts.values())
    print("\nImport complete")
    for theme, count in counts.items():
        print(f"  {theme}: {count} clips")
    print(f"  Total: {total} clips")
    print("\nRestart ThunderScope or reload /settings, select VAICOM radio net, choose a theme, then test a clip.")
    return 0 if total else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        raise SystemExit(130)
    except Exception as exc:  # noqa: BLE001
        print(f"\nImport failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
