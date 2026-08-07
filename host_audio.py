from __future__ import annotations

import asyncio
import json
import math
import platform
import random
import re
import shutil
import subprocess
import time
import wave
from pathlib import Path
from typing import Any

from telemetry_values import extract_g_load


ALERT_DEFINITIONS: dict[str, dict[str, Any]] = {
    "fuel-critical": {"phrase": "Warning. Low fuel.", "priority": 0, "repeat": False},
    "fuel-reserve": {"phrase": "Bingo fuel.", "priority": 1, "repeat": False},
    "joker-fuel": {"phrase": "Joker fuel.", "priority": 2, "repeat": False},
    "g-limit": {"phrase": "Over G.", "priority": 0, "repeat": True},
    "g-caution": {"phrase": "G warning.", "priority": 1, "repeat": True},
    "high-aoa": {"phrase": "A O A.", "priority": 1, "repeat": True},
    "stall": {"phrase": "Stall. Stall.", "priority": 0, "repeat": True},
    "sink-rate": {"phrase": "Sink rate.", "priority": 0, "repeat": True},
    "dont-sink": {"phrase": "Don't sink.", "priority": 0, "repeat": False},
    "positive-rate": {"phrase": "Positive rate.", "priority": 2, "repeat": False},
    "hard-landing": {"phrase": "Hard landing.", "priority": 1, "repeat": False},
    "gear-speed": {"phrase": "Gear overspeed.", "priority": 0, "repeat": True},
    "flap-speed": {"phrase": "Flap overspeed.", "priority": 0, "repeat": True},
    "overspeed": {"phrase": "Overspeed.", "priority": 0, "repeat": True},
    "engine-temperature": {"phrase": "Engine temperature.", "priority": 0, "repeat": True},
    "oil-pressure": {"phrase": "Oil pressure.", "priority": 0, "repeat": True},
    "engine-failure": {"phrase": "Engine failure.", "priority": 0, "repeat": True},
    "engine-mismatch": {"phrase": "Engine warning.", "priority": 0, "repeat": True},
    "check-gear": {"phrase": "Check gear.", "priority": 1, "repeat": True},
    "check-flaps": {"phrase": "Check flaps.", "priority": 1, "repeat": True},
    "check-afterburner": {"phrase": "Check afterburner.", "priority": 1, "repeat": True},
    "energy-low": {"phrase": "Energy low.", "priority": 1, "repeat": True},
    "speedbrake": {"phrase": "Speedbrake.", "priority": 1, "repeat": True},
    "telemetry-stale": {"phrase": "Telemetry lost.", "priority": 1, "repeat": False},
    "telemetry-restored": {"phrase": "Telemetry restored.", "priority": 2, "repeat": False},
    "gear-down": {"phrase": "Gear down.", "priority": 2, "repeat": False},
    "gear-up": {"phrase": "Gear up.", "priority": 2, "repeat": False},
    "flaps-down": {"phrase": "Flaps down.", "priority": 2, "repeat": False},
    "flaps-up": {"phrase": "Flaps up.", "priority": 2, "repeat": False},
    "flaps-combat": {"phrase": "Combat flaps.", "priority": 2, "repeat": False},
    "flaps-takeoff": {"phrase": "Takeoff flaps.", "priority": 2, "repeat": False},
    "flaps-landing": {"phrase": "Landing flaps.", "priority": 2, "repeat": False},
    "airbrake-extended": {"phrase": "Airbrake extended.", "priority": 2, "repeat": False},
    "airbrake-retracted": {"phrase": "Airbrake retracted.", "priority": 2, "repeat": False},
    "mach-one": {"phrase": "Mach one.", "priority": 2, "repeat": False},
    "test": {"phrase": "ThunderScope voice alert test.", "priority": 0, "repeat": False},
}


def _number(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def _pick(obj: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return None


def _normalise_key(key: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(key).lower())


def _find_numeric(
    objects: list[dict[str, Any]], exact: tuple[str, ...], aliases: set[str]
) -> tuple[float | None, str | None]:
    for obj in objects:
        for key in exact:
            value = _number(obj.get(key))
            if value is not None:
                return value, key
    for obj in objects:
        for key, raw in obj.items():
            if _normalise_key(key) in aliases:
                value = _number(raw)
                if value is not None:
                    return value, str(key)
    return None, None


def _as_fraction(value: float | None) -> float | None:
    if value is None:
        return None
    magnitude = abs(value)
    if magnitude <= 1.01:
        return max(0.0, min(1.0, value))
    if magnitude <= 100.5:
        return max(0.0, min(1.0, value / 100.0))
    return None


def _profile_for(settings: dict[str, Any], vehicle: str | None) -> dict[str, Any]:
    profile = dict(settings.get("defaults", {}))
    if vehicle:
        profile.update(settings.get("profiles", {}).get(vehicle, {}))
    return profile


class HostAudioService:
    """Serialised host-side audio alerts for the desktop host running ThunderScope."""

    def __init__(self, base_dir: Path, logger: Any) -> None:
        self.base_dir = base_dir
        self.logger = logger
        self.audio_dir = base_dir / "audio"
        self.audio_dir.mkdir(exist_ok=True)
        self.script_path = base_dir / "speak.ps1"
        self.daemon_script_path = base_dir / "speak_daemon.ps1"
        self.queue: asyncio.PriorityQueue[tuple[int, int, str, str, bool]] = asyncio.PriorityQueue()
        self.task: asyncio.Task[Any] | None = None
        self.chatter_task: asyncio.Task[Any] | None = None
        self.chatter_playback_task: asyncio.Task[Any] | None = None
        self._sequence = 0
        self._stop = asyncio.Event()
        self._settings: dict[str, Any] = {}
        self._active_conditions: set[str] = set()
        self._last_announced: dict[str, float] = {}
        self._last_connected_at: float | None = None
        self._last_ias: float | None = None
        self._ever_connected = False
        self._last_spoken: dict[str, Any] | None = None
        self._last_error: str | None = None
        self._voices_cache: list[str] | None = None
        self._audio_inhibited = False
        self._control_confirmed: dict[str, str | None] = {"gear": None, "flaps": None, "airbrake": None}
        self._control_pending: dict[str, tuple[str, float] | None] = {"gear": None, "flaps": None, "airbrake": None}
        self._mach_supersonic: bool | None = None
        self._last_mach: float | None = None
        self._tts_process: asyncio.subprocess.Process | None = None
        self._tts_lock = asyncio.Lock()
        self._chatter_process: asyncio.subprocess.Process | None = None
        self._last_snapshot: dict[str, Any] = {}
        self._last_warning_activity = 0.0
        self._last_chatter: dict[str, Any] | None = None
        self._recent_chatter: list[str] = []
        self._next_chatter_at: float | None = None
        self._urgent_pending = asyncio.Event()
        self._chatter_playing = False
        self._was_connected = False
        self._stale_announced = False
        self._last_vehicle: str | None = None
        self._last_motion_time: float | None = None
        self._last_motion_ias: float | None = None
        self._last_altitude: float | None = None
        self._last_vertical_speed: float | None = None
        self._ias_accel_kmh_s = 0.0
        self._last_stationary_at: float | None = None
        self._takeoff_active_until = 0.0
        self._positive_rate_announced = False
        self._dont_sink_announced = False
        self._approach_since: float | None = None
        self._touchdown_candidate: tuple[float, float, float | None, float] | None = None
        self._oil_pressure_baselines: dict[str, float] = {}
        self._rpm_baselines: dict[str, float] = {}

    @property
    def windows_host(self) -> bool:
        return platform.system().lower() == "windows"

    @property
    def linux_host(self) -> bool:
        return platform.system().lower() == "linux"

    @property
    def supported(self) -> bool:
        return self.windows_host or self.linux_host

    async def start(self, settings: dict[str, Any]) -> None:
        self._settings = settings
        self._stop.clear()
        if self.windows_host and self.daemon_script_path.exists():
            try:
                await self._ensure_tts_daemon()
            except Exception as exc:  # noqa: BLE001 - fallback TTS remains available.
                self._last_error = f"TTS prewarm failed: {exc}"
                self.logger.warning("Host TTS prewarm failed: %s", exc)
        self.task = asyncio.create_task(self._worker(), name="thunderscope-host-audio")
        self.chatter_task = asyncio.create_task(self._chatter_scheduler(), name="thunderscope-radio-chatter")

    async def stop(self) -> None:
        self._stop.set()
        tasks = [task for task in (self.task, self.chatter_task, self.chatter_playback_task) if task]
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        await self._stop_tts_daemon()
        await self._stop_chatter_process()

    def update_settings(self, settings: dict[str, Any]) -> None:
        self._settings = settings
        if not settings.get("audio", {}).get("enabled", True):
            self._active_conditions.clear()
            self._clear_queue()

    def _audio_settings(self) -> dict[str, Any]:
        defaults = {
            "enabled": True,
            "preferCustomWav": True,
            "voice": "",
            "rate": -1,
            "volume": 90,
            "repeatCooldownSeconds": 12.0,
            "minimumGapSeconds": 1.0,
            "suppressWhenStationary": True,
            "stationarySpeedKmh": 0.5,
            "announceControlChanges": True,
            "radioChatterEnabled": False,
            "radioChatterSource": "vaicom",
            "radioChatterVaicomTheme": "Navy",
            "radioChatterContextAware": True,
            "radioChatterOnlyAirborne": True,
            "radioChatterMinSeconds": 45.0,
            "radioChatterMaxSeconds": 120.0,
            "radioChatterQuietAfterWarningSeconds": 10.0,
            "radioChatterMinimumIasKmh": 80.0,
            "radioChatterMixWithWarnings": True,
            "radioChatterVolume": 50,
        }
        defaults.update(self._settings.get("audio", {}))
        return defaults

    def process(self, snapshot: dict[str, Any], settings: dict[str, Any]) -> None:
        self._settings = settings
        self._last_snapshot = snapshot
        audio = self._audio_settings()
        now = float(snapshot.get("timestamp") or time.time())
        connected = bool(snapshot.get("connected"))
        previous_connected = self._was_connected
        vehicle = str(snapshot.get("vehicle") or "") or None
        if vehicle != self._last_vehicle:
            self._reset_aircraft_tracking(vehicle)
        profile = _profile_for(settings, vehicle)
        state = snapshot.get("state", {}) or {}
        ias = _number(_pick(state, "IAS, km/h"))
        if ias is not None:
            self._last_ias = ias

        stationary_limit = max(0.0, float(audio.get("stationarySpeedKmh", 0.5)))
        stationary = connected and ias is not None and ias <= stationary_limit
        inhibit = bool(audio.get("suppressWhenStationary", True) and stationary)
        if inhibit and not self._audio_inhibited:
            self._clear_queue()
            self._active_conditions.clear()
        self._audio_inhibited = inhibit

        allow_audio_event = connected and not inhibit and bool(audio.get("enabled", True))
        allow_control_audio = allow_audio_event and bool(audio.get("announceControlChanges", True))
        for key in self._control_transition_events(snapshot, now, allow_control_audio):
            definition = ALERT_DEFINITIONS[key]
            self.enqueue(key, str(definition["phrase"]), int(definition["priority"]))

        mach_event = self._mach_transition_event(
            snapshot,
            allow_audio_event and profile.get("alertMachOne", True) is not False,
        )
        if mach_event:
            definition = ALERT_DEFINITIONS[mach_event]
            self.enqueue(mach_event, str(definition["phrase"]), int(definition["priority"]))

        for key in self._flight_transition_events(snapshot, profile, now, stationary_limit, allow_audio_event):
            definition = ALERT_DEFINITIONS[key]
            self.enqueue(key, str(definition["phrase"]), int(definition["priority"]))

        if connected and not previous_connected and self._stale_announced:
            if allow_audio_event and profile.get("alertTelemetryRestored", True):
                definition = ALERT_DEFINITIONS["telemetry-restored"]
                self.enqueue("telemetry-restored", str(definition["phrase"]), int(definition["priority"]))
            self._stale_announced = False

        if not audio.get("enabled", True):
            self._active_conditions.clear()
            self._was_connected = connected
            return
        if inhibit:
            self._was_connected = connected
            return

        current: set[str] = set()
        if connected:
            self._ever_connected = True
            self._last_connected_at = now
            current.update(self._evaluate_flight_alerts(snapshot, profile))
        elif self._ever_connected and self._last_connected_at is not None and now - self._last_connected_at >= 2.5:
            last_stationary = self._last_ias is not None and self._last_ias <= stationary_limit
            if profile.get("alertTelemetryStale", True) and not last_stationary:
                current.add("telemetry-stale")
                self._stale_announced = True

        cooldown = max(1.0, float(audio.get("repeatCooldownSeconds", 12.0)))
        for key in current:
            definition = ALERT_DEFINITIONS[key]
            newly_active = key not in self._active_conditions
            due_repeat = bool(definition["repeat"]) and now - self._last_announced.get(key, 0.0) >= cooldown
            if newly_active or due_repeat:
                self.enqueue(key, str(definition["phrase"]), int(definition["priority"]))
                self._last_announced[key] = now

        self._active_conditions = current
        self._was_connected = connected

    def _reset_aircraft_tracking(self, vehicle: str | None) -> None:
        self._last_vehicle = vehicle
        self._oil_pressure_baselines.clear()
        self._rpm_baselines.clear()
        self._last_motion_time = None
        self._last_motion_ias = None
        self._last_altitude = None
        self._last_vertical_speed = None
        self._ias_accel_kmh_s = 0.0
        self._last_stationary_at = None
        self._takeoff_active_until = 0.0
        self._positive_rate_announced = False
        self._dont_sink_announced = False
        self._approach_since = None
        self._touchdown_candidate = None

    def _vertical_speed(self, snapshot: dict[str, Any]) -> float | None:
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        value = _number(_pick(state, "Vy, m/s", "vertical speed, m/s"))
        return value if value is not None else _number(_pick(indicators, "vario", "vertical_speed"))

    def _altitude(self, snapshot: dict[str, Any]) -> float | None:
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        value = _number(_pick(state, "H, m", "height, m", "altitude, m"))
        if value is not None:
            return value
        return _number(_pick(indicators, "altitude_hour", "altitude_10k", "altitude"))

    def _engine_rpms(self, snapshot: dict[str, Any]) -> dict[str, float]:
        values: dict[str, float] = {}
        for obj in (snapshot.get("state", {}) or {}, snapshot.get("indicators", {}) or {}):
            for key, raw in obj.items():
                normalised = _normalise_key(key)
                if not normalised.startswith("rpm") and "enginerpm" not in normalised:
                    continue
                value = _number(raw)
                if value is not None and value >= 0:
                    values[normalised] = value
        return values

    def _throttle_percent(self, snapshot: dict[str, Any]) -> float | None:
        values: list[float] = []
        for obj in (snapshot.get("state", {}) or {}, snapshot.get("indicators", {}) or {}):
            for key, raw in obj.items():
                normalised = _normalise_key(key)
                if "throttle" not in normalised:
                    continue
                value = _number(raw)
                if value is None:
                    continue
                if abs(value) <= 1.01:
                    value *= 100.0
                if -5 <= value <= 200:
                    values.append(value)
        return max(values) if values else None

    def _afterburner_active(self, snapshot: dict[str, Any]) -> bool:
        for obj in (snapshot.get("state", {}) or {}, snapshot.get("indicators", {}) or {}):
            for key, raw in obj.items():
                normalised = _normalise_key(key)
                if "afterburner" not in normalised and normalised not in {"wep", "boost", "throttleboost"}:
                    continue
                if isinstance(raw, bool) and raw:
                    return True
                numeric = _number(raw)
                if numeric is not None and numeric > 0.5:
                    return True
                if isinstance(raw, str) and raw.strip().lower() in {"on", "true", "wep", "afterburner"}:
                    return True
        throttle = self._throttle_percent(snapshot)
        return throttle is not None and throttle > 100.5

    def _temperature_values(self, snapshot: dict[str, Any]) -> dict[str, list[float]]:
        result = {"oil": [], "water": [], "head": []}
        for obj in (snapshot.get("state", {}) or {}, snapshot.get("indicators", {}) or {}):
            for key, raw in obj.items():
                value = _number(raw)
                if value is None:
                    continue
                normalised = _normalise_key(key)
                if "oiltemp" in normalised or ("oil" in normalised and "temp" in normalised):
                    result["oil"].append(value)
                elif any(token in normalised for token in ("watertemp", "coolanttemp")):
                    result["water"].append(value)
                elif any(token in normalised for token in ("headtemp", "cylindertemp", "cylinderheadtemp")):
                    result["head"].append(value)
        return result

    def _oil_pressures(self, snapshot: dict[str, Any]) -> dict[str, float]:
        result: dict[str, float] = {}
        for obj in (snapshot.get("state", {}) or {}, snapshot.get("indicators", {}) or {}):
            for key, raw in obj.items():
                normalised = _normalise_key(key)
                if "oilpressure" not in normalised:
                    continue
                value = _number(raw)
                if value is not None and value >= 0:
                    result[normalised] = value
        return result

    def _flight_transition_events(
        self,
        snapshot: dict[str, Any],
        profile: dict[str, Any],
        now: float,
        stationary_limit: float,
        allow_announce: bool,
    ) -> list[str]:
        if not snapshot.get("connected"):
            self._last_motion_time = None
            return []
        state = snapshot.get("state", {}) or {}
        ias = _number(_pick(state, "IAS, km/h"))
        vertical_speed = self._vertical_speed(snapshot)
        altitude = self._altitude(snapshot)
        if ias is None:
            return []
        events: list[str] = []
        dt = now - self._last_motion_time if self._last_motion_time is not None else None
        if dt is not None and 0.015 <= dt <= 1.5 and self._last_motion_ias is not None:
            raw_accel = (ias - self._last_motion_ias) / dt
            self._ias_accel_kmh_s = self._ias_accel_kmh_s * 0.65 + raw_accel * 0.35

        gear_state, _, flaps_fraction, flaps_state, _ = self._extract_control_states(snapshot)
        if ias <= stationary_limit:
            self._last_stationary_at = now
            self._takeoff_active_until = 0.0
            self._positive_rate_announced = False
            self._dont_sink_announced = False
            self._approach_since = None
            self._touchdown_candidate = None
        else:
            recent_ground = self._last_stationary_at is not None and now - self._last_stationary_at <= 35.0
            positive_threshold = float(profile.get("positiveRateMps", 2.0))
            if recent_ground and vertical_speed is not None and vertical_speed >= positive_threshold and ias >= 65:
                if not self._positive_rate_announced:
                    self._positive_rate_announced = True
                    self._takeoff_active_until = now + float(profile.get("takeoffWarningWindowSeconds", 20.0))
                    if allow_announce and profile.get("alertPositiveRate", True):
                        events.append("positive-rate")
            if self._takeoff_active_until > now and vertical_speed is not None:
                if vertical_speed <= float(profile.get("dontSinkMps", -2.0)) and not self._dont_sink_announced:
                    self._dont_sink_announced = True
                    if allow_announce and profile.get("alertDontSink", True):
                        events.append("dont-sink")

        landing_flaps = flaps_state == "landing" or (flaps_state == "down" and (flaps_fraction or 0) >= 0.45)
        approach_configured = (
            gear_state == "down"
            and landing_flaps
            and ias <= float(profile.get("approachCheckMaxIas", 420.0))
        )
        approach = approach_configured and vertical_speed is not None and vertical_speed <= -0.8
        if approach:
            if self._approach_since is None:
                self._approach_since = now
        elif not approach_configured and self._touchdown_candidate is None:
            self._approach_since = None

        if (
            allow_announce
            and profile.get("alertHardLanding", True)
            and self._approach_since is not None
            and now - self._approach_since >= 1.5
            and self._last_vertical_speed is not None
            and self._last_vertical_speed <= float(profile.get("hardLandingMps", -6.0))
            and vertical_speed is not None
            and vertical_speed >= -0.9
            and self._touchdown_candidate is None
        ):
            self._touchdown_candidate = (now, ias, altitude, self._last_vertical_speed)

        if self._touchdown_candidate is not None:
            started, candidate_ias, candidate_altitude, _ = self._touchdown_candidate
            age = now - started
            if age > 1.5:
                self._touchdown_candidate = None
            elif age >= 0.30 and vertical_speed is not None and abs(vertical_speed) <= 1.2:
                speed_drop = candidate_ias - ias
                altitude_stable = altitude is None or candidate_altitude is None or abs(altitude - candidate_altitude) <= 1.2
                if gear_state == "down" and speed_drop >= 2.0 and altitude_stable:
                    events.append("hard-landing")
                    self._touchdown_candidate = None
                    self._approach_since = None

        self._last_motion_time = now
        self._last_motion_ias = ias
        self._last_altitude = altitude
        self._last_vertical_speed = vertical_speed
        return events

    def _evaluate_flight_alerts(self, snapshot: dict[str, Any], profile: dict[str, Any]) -> set[str]:
        if profile.get("alertsEnabled", True) is False:
            return set()
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        current: set[str] = set()

        ias = _number(_pick(state, "IAS, km/h"))
        if ias is None or ias <= 0:
            return current
        vertical_speed = self._vertical_speed(snapshot)
        derived = snapshot.get("derived", {}) or {}
        g_load = _number(derived.get("g_load"))
        if g_load is None:
            g_load, _ = extract_g_load(state, indicators)
        g_peak_positive = _number(derived.get("g_peak_positive"))
        if g_peak_positive is None:
            g_peak_positive = g_load
        g_warning = bool(derived.get("g_warning"))
        aoa = _number(_pick(state, "AoA, deg"))
        fuel = _number(_pick(state, "Mfuel, kg"))
        if fuel is None:
            fuel = _number(indicators.get("fuel"))
        fuel_capacity = _number(_pick(state, "Mfuel0, kg"))
        fuel_pct = fuel / fuel_capacity * 100 if fuel is not None and fuel_capacity and fuel_capacity > 0 else None

        gear_state, _, flaps_fraction, flaps_state, airbrake_state = self._extract_control_states(snapshot)
        gear_down = gear_state == "down"
        flaps_down = flaps_fraction is not None and flaps_fraction > 0.02
        throttle = self._throttle_percent(snapshot)
        afterburner = self._afterburner_active(snapshot)

        if profile.get("alertLowFuel", True) and fuel_pct is not None:
            if fuel_pct <= float(profile.get("fuelCriticalPct", 15)):
                current.add("fuel-critical")
            elif fuel_pct <= float(profile.get("fuelReservePct", 25)):
                current.add("fuel-reserve")
            elif profile.get("alertJokerFuel", True) and fuel_pct <= float(profile.get("jokerFuelPct", 35)):
                current.add("joker-fuel")

        over_g_active = False
        if profile.get("alertHighG", True):
            high_g = float(profile.get("highG", 8.0))
            low_g = float(profile.get("lowG", -3.0))
            if g_warning or (g_load is not None and (g_load > high_g or g_load < low_g)):
                current.add("g-limit")
                over_g_active = True
        if not over_g_active and profile.get("alertGCaution", True):
            if g_peak_positive is not None and g_peak_positive > float(profile.get("gCaution", 4.0)):
                current.add("g-caution")

        stall_active = self._stall_active(state, indicators, aoa, profile)
        if profile.get("alertStall", True) and stall_active:
            current.add("stall")
        elif profile.get("alertHighAoA", True) and aoa is not None and aoa > float(profile.get("highAoADeg", 18)):
            current.add("high-aoa")

        if profile.get("alertSinkRate", True) and vertical_speed is not None:
            max_ias = float(profile.get("sinkRateMaxIas", 500))
            threshold = float(profile.get("sinkRateWarning", -4.5))
            if ias < max_ias and vertical_speed <= threshold:
                current.add("sink-rate")

        if profile.get("alertGearOverspeed", True) and gear_down and ias > float(profile.get("gearOverspeedKmh", 450)):
            current.add("gear-speed")
        if profile.get("alertFlapOverspeed", True) and flaps_down and ias > float(profile.get("flapOverspeedKmh", 500)):
            current.add("flap-speed")
        if profile.get("alertOverspeed", False) and ias > float(profile.get("overspeedKmh", 1300)):
            current.add("overspeed")

        approach_limit = float(profile.get("approachCheckMaxIas", 420))
        descending_approach = vertical_speed is not None and vertical_speed <= -1.5 and ias <= approach_limit
        landing_flaps = flaps_state == "landing" or (flaps_state == "down" and (flaps_fraction or 0) >= 0.45)
        if profile.get("alertCheckGear", True) and descending_approach and landing_flaps and gear_state != "down":
            current.add("check-gear")
        if profile.get("alertCheckFlaps", True) and descending_approach and gear_down and not flaps_down:
            current.add("check-flaps")
        if profile.get("alertCheckAfterburner", True) and afterburner and fuel_pct is not None:
            if fuel_pct <= float(profile.get("fuelReservePct", 25)):
                current.add("check-afterburner")
        if profile.get("alertSpeedbrake", True) and airbrake_state == "extended" and throttle is not None:
            if throttle >= float(profile.get("speedbrakeThrottlePct", 80)):
                current.add("speedbrake")
        if profile.get("alertEnergyLow", False) and g_load is not None:
            if (
                g_load >= 2.5
                and ias <= float(profile.get("energyLowIasKmh", 350))
                and self._ias_accel_kmh_s <= float(profile.get("energyLowDecelKmhS", -8.0))
                and (vertical_speed is None or vertical_speed <= 1.0)
            ):
                current.add("energy-low")

        temperatures = self._temperature_values(snapshot)
        if profile.get("alertEngineTemperature", True):
            too_hot = (
                any(value >= float(profile.get("engineOilTempWarningC", 120)) for value in temperatures["oil"])
                or any(value >= float(profile.get("engineWaterTempWarningC", 120)) for value in temperatures["water"])
                or any(value >= float(profile.get("engineHeadTempWarningC", 260)) for value in temperatures["head"])
            )
            if too_hot:
                current.add("engine-temperature")

        rpms = self._engine_rpms(snapshot)
        for key, value in rpms.items():
            self._rpm_baselines[key] = max(value, self._rpm_baselines.get(key, 0.0))
        engine_failure = False
        if profile.get("alertEngineFailure", True) and throttle is not None and throttle >= float(profile.get("engineFailureThrottlePct", 55)):
            drop_fraction = max(0.05, min(0.8, float(profile.get("engineFailureDropPct", 20)) / 100.0))
            for key, value in rpms.items():
                baseline = self._rpm_baselines.get(key, 0.0)
                if baseline >= 20 and value <= baseline * drop_fraction:
                    engine_failure = True
                    current.add("engine-failure")
                    break

        pressures = self._oil_pressures(snapshot)
        for key, value in pressures.items():
            self._oil_pressure_baselines[key] = max(value, self._oil_pressure_baselines.get(key, 0.0))
        if profile.get("alertOilPressure", True) and rpms:
            drop_fraction = max(0.05, min(0.9, float(profile.get("oilPressureDropPct", 35)) / 100.0))
            engine_running = any(value >= self._rpm_baselines.get(key, value) * 0.35 for key, value in rpms.items())
            if engine_running:
                for key, value in pressures.items():
                    baseline = self._oil_pressure_baselines.get(key, 0.0)
                    if baseline > 0.2 and value <= baseline * drop_fraction:
                        current.add("oil-pressure")
                        break

        if not engine_failure and profile.get("alertEngineMismatch", True):
            rpm_values = list(rpms.values())
            if len(rpm_values) >= 2 and max(rpm_values) > 0:
                mismatch = (max(rpm_values) - min(rpm_values)) / max(rpm_values) * 100
                if mismatch > float(profile.get("engineMismatchPct", 18)):
                    current.add("engine-mismatch")

        return current

    def _stall_active(
        self,
        state: dict[str, Any],
        indicators: dict[str, Any],
        aoa: float | None,
        profile: dict[str, Any],
    ) -> bool:
        aliases = {
            "stallwarning", "stallwarn", "stalled", "stallindicator",
            "criticalaoawarning", "criticalanglewarning", "buffetwarning",
        }
        for obj in (state, indicators):
            for key, raw in obj.items():
                normalised = _normalise_key(key)
                if normalised not in aliases and normalised != "stall":
                    continue
                if isinstance(raw, bool):
                    if raw:
                        return True
                    continue
                numeric = _number(raw)
                if numeric is not None and 0.0 <= numeric <= 1.01 and numeric >= 0.5:
                    return True
                if isinstance(raw, str) and raw.strip().lower() in {"true", "yes", "on", "stall", "stalled"}:
                    return True
        return aoa is not None and aoa >= float(profile.get("stallAoADeg", 22.0))

    def _mach_transition_event(self, snapshot: dict[str, Any], allow_announce: bool) -> str | None:
        if not snapshot.get("connected"):
            self._mach_supersonic = None
            self._last_mach = None
            return None
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        mach, _ = _find_numeric(
            [state, indicators],
            ("M", "Mach", "mach"),
            {"m", "mach", "machnumber", "machno"},
        )
        if mach is None:
            return None
        self._last_mach = mach
        if self._mach_supersonic is None:
            self._mach_supersonic = mach >= 1.0
            return None
        if not self._mach_supersonic and mach >= 1.0:
            self._mach_supersonic = True
            return "mach-one" if allow_announce else None
        if self._mach_supersonic and mach <= 0.96:
            self._mach_supersonic = False
        return None

    def _extract_control_states(self, snapshot: dict[str, Any]) -> tuple[str | None, float | None, float | None, str | None, str | None]:
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        objects = [state, indicators]

        gear_raw, _ = _find_numeric(
            objects,
            ("gear, %", "gears", "gears1", "landing gear, %"),
            {"gear", "gears", "gears1", "gearpercent", "landinggear", "landinggearpercent"},
        )
        gear_fraction = _as_fraction(gear_raw)
        gear_state: str | None = None
        if gear_fraction is not None:
            if gear_fraction <= 0.08:
                gear_state = "up"
            elif gear_fraction >= 0.92:
                gear_state = "down"

        flaps_raw, flaps_key = _find_numeric(
            objects,
            ("flaps, %", "flaps_lever", "flaps_indicator", "flaps"),
            {"flapspercent", "flapslever", "flapsindicator", "flaps"},
        )
        flaps_fraction = _as_fraction(flaps_raw)
        flaps_state: str | None = None
        if flaps_fraction is not None:
            if flaps_fraction <= 0.02:
                flaps_state = "up"
            else:
                generic_boolean = _normalise_key(flaps_key) == "flaps" and flaps_raw in (1, 100)
                if generic_boolean and "flaps, %" not in state:
                    flaps_state = "down"
                elif flaps_fraction <= 0.34:
                    flaps_state = "combat"
                elif flaps_fraction <= 0.72:
                    flaps_state = "takeoff"
                else:
                    flaps_state = "landing"

        airbrake_raw, _ = _find_numeric(
            objects,
            ("airbrake, %", "airbrake_indicator", "airbrake_lever", "airbrake"),
            {"airbrakepercent", "airbrakeindicator", "airbrakelever", "airbrake"},
        )
        airbrake_fraction = _as_fraction(airbrake_raw)
        airbrake_state: str | None = None
        if airbrake_fraction is not None:
            if airbrake_fraction <= 0.05:
                airbrake_state = "retracted"
            elif airbrake_fraction >= 0.50:
                airbrake_state = "extended"

        return gear_state, gear_fraction, flaps_fraction, flaps_state, airbrake_state

    def _control_transition_events(self, snapshot: dict[str, Any], now: float, allow_announce: bool) -> list[str]:
        gear_state, _, _, flaps_state, airbrake_state = self._extract_control_states(snapshot)
        observed = {"gear": gear_state, "flaps": flaps_state, "airbrake": airbrake_state}
        settle_times = {"gear": 0.25, "flaps": 0.55, "airbrake": 0.20}
        events: list[str] = []

        for control, value in observed.items():
            if value is None:
                self._control_pending[control] = None
                continue
            confirmed = self._control_confirmed[control]
            if confirmed == value:
                self._control_pending[control] = None
                continue
            pending = self._control_pending[control]
            if pending is None or pending[0] != value:
                self._control_pending[control] = (value, now)
                continue
            if now - pending[1] < settle_times[control]:
                continue
            self._control_confirmed[control] = value
            self._control_pending[control] = None
            if confirmed is None or not allow_announce:
                continue
            event_key = {
                ("gear", "down"): "gear-down",
                ("gear", "up"): "gear-up",
                ("flaps", "down"): "flaps-down",
                ("flaps", "up"): "flaps-up",
                ("flaps", "combat"): "flaps-combat",
                ("flaps", "takeoff"): "flaps-takeoff",
                ("flaps", "landing"): "flaps-landing",
                ("airbrake", "extended"): "airbrake-extended",
                ("airbrake", "retracted"): "airbrake-retracted",
            }.get((control, value))
            if event_key:
                events.append(event_key)
        return events

    @property
    def chatter_root(self) -> Path:
        return self.audio_dir / "radio"

    @property
    def vaicom_root(self) -> Path:
        return self.chatter_root / "vaicom"

    def _scan_chatter_clips(self) -> dict[str, list[Path]]:
        """Scan user-supplied internal crew clips grouped by flight phase."""
        categories = ("generic", "takeoff", "cruise", "combat", "landing", "ground")
        clips: dict[str, list[Path]] = {}
        for category in categories:
            folder = self.chatter_root / category
            clips[category] = sorted(
                (path for path in folder.glob("*.wav") if path.is_file()),
                key=lambda path: path.name.lower(),
            ) if folder.exists() else []
        return clips

    def _scan_vaicom_themes(self) -> dict[str, list[Path]]:
        """Scan imported VAICOM radio-net themes without treating them as crew dialogue."""
        themes: dict[str, list[Path]] = {}
        if not self.vaicom_root.exists():
            return themes
        for folder in sorted((path for path in self.vaicom_root.iterdir() if path.is_dir()), key=lambda path: path.name.lower()):
            paths = sorted(
                (path for path in folder.glob("*.wav") if path.is_file()),
                key=lambda path: path.name.lower(),
            )
            if paths:
                themes[folder.name] = paths
        return themes

    def _chatter_context(self, snapshot: dict[str, Any]) -> str | None:
        if not snapshot.get("connected"):
            return None
        state = snapshot.get("state", {}) or {}
        indicators = snapshot.get("indicators", {}) or {}
        ias = _number(_pick(state, "IAS, km/h"))
        if ias is None:
            return None
        vertical_speed = _number(_pick(state, "Vy, m/s"))
        if vertical_speed is None:
            vertical_speed = _number(indicators.get("vario")) or 0.0
        altitude = _number(_pick(state, "H, m", "height, m", "altitude, m"))
        if altitude is None:
            altitude = _number(_pick(indicators, "altitude_hour", "altitude_10k")) or 0.0
        aoa = _number(_pick(state, "AoA, deg")) or 0.0
        derived = snapshot.get("derived", {}) or {}
        g_load = _number(derived.get("g_load"))
        if g_load is None:
            g_load, _ = extract_g_load(state, indicators)
        g_load = g_load or 1.0
        gear_state, _, _, _, _ = self._extract_control_states(snapshot)

        ground_threshold = max(40.0, float(self._audio_settings().get("radioChatterMinimumIasKmh", 80.0)))
        if ias < ground_threshold:
            return "ground"
        if gear_state == "down" and vertical_speed <= -1.0 and ias < 500:
            return "landing"
        if altitude < 1000 and vertical_speed >= 2.5 and ias < 600:
            return "takeoff"
        if abs(g_load) >= 2.8 or aoa >= 10.0:
            return "combat"
        return "cruise"

    def _choose_chatter_clip(self, context: str | None = None) -> tuple[Path, str] | None:
        crew_clips = self._scan_chatter_clips()
        vaicom_themes = self._scan_vaicom_themes()
        audio = self._audio_settings()
        source = str(audio.get("radioChatterSource", "vaicom")).strip().lower()
        if source not in {"crew", "vaicom", "mixed"}:
            source = "crew"
        context = context or self._chatter_context(self._last_snapshot) or "generic"

        crew_candidates: list[tuple[Path, str]] = []
        if not audio.get("radioChatterContextAware", True):
            candidate_categories = [name for name, paths in crew_clips.items() if paths]
        elif context != "generic" and crew_clips.get(context):
            generic_available = bool(crew_clips.get("generic"))
            candidate_categories = [context] if not generic_available or random.random() < 0.75 else ["generic"]
        else:
            candidate_categories = ["generic"]
        for category in candidate_categories:
            crew_candidates.extend((path, f"crew/{category}") for path in crew_clips.get(category, []))
        if not crew_candidates:
            for category, paths in crew_clips.items():
                crew_candidates.extend((path, f"crew/{category}") for path in paths)

        vaicom_candidates: list[tuple[Path, str]] = []
        requested_theme = str(audio.get("radioChatterVaicomTheme", "Navy")).strip()
        selected_theme = next((name for name in vaicom_themes if name.lower() == requested_theme.lower()), None)
        if selected_theme:
            vaicom_candidates = [(path, f"vaicom/{selected_theme}") for path in vaicom_themes[selected_theme]]
        elif vaicom_themes:
            fallback_theme = sorted(vaicom_themes, key=str.lower)[0]
            vaicom_candidates = [(path, f"vaicom/{fallback_theme}") for path in vaicom_themes[fallback_theme]]

        if source == "crew":
            candidates = crew_candidates or vaicom_candidates
        elif source == "vaicom":
            candidates = vaicom_candidates or crew_candidates
        else:
            available_pools = [pool for pool in (crew_candidates, vaicom_candidates) if pool]
            candidates = random.choice(available_pools) if available_pools else []
        if not candidates:
            return None
        recent = set(self._recent_chatter[-3:])
        fresh = [item for item in candidates if str(item[0]) not in recent]
        choice = random.choice(fresh or candidates)
        self._recent_chatter.append(str(choice[0]))
        self._recent_chatter = self._recent_chatter[-6:]
        return choice

    def _random_chatter_delay(self) -> float:
        audio = self._audio_settings()
        minimum = max(5.0, float(audio.get("radioChatterMinSeconds", 45.0)))
        maximum = max(minimum, float(audio.get("radioChatterMaxSeconds", 120.0)))
        return random.uniform(minimum, maximum)

    def _chatter_eligible(self) -> bool:
        audio = self._audio_settings()
        if not audio.get("enabled", True) or not audio.get("radioChatterEnabled", False):
            return False
        snapshot = self._last_snapshot
        if not snapshot.get("connected") or self._audio_inhibited:
            return False
        if self._chatter_playing:
            return False
        mix_with_warnings = bool(audio.get("radioChatterMixWithWarnings", True))
        if not mix_with_warnings:
            if self._active_conditions or self.queue.qsize() > 0:
                return False
            quiet = max(0.0, float(audio.get("radioChatterQuietAfterWarningSeconds", 10.0)))
            if time.time() - self._last_warning_activity < quiet:
                return False
        state = snapshot.get("state", {}) or {}
        ias = _number(_pick(state, "IAS, km/h"))
        if ias is None:
            return False
        context = self._chatter_context(snapshot)
        if context == "ground":
            if audio.get("radioChatterOnlyAirborne", True):
                return False
            if ias <= max(0.0, float(audio.get("stationarySpeedKmh", 0.5))):
                return False
        elif ias < max(0.0, float(audio.get("radioChatterMinimumIasKmh", 80.0))):
            return False
        return True

    async def _chatter_scheduler(self) -> None:
        self._next_chatter_at = time.monotonic() + self._random_chatter_delay()
        while not self._stop.is_set():
            await asyncio.sleep(0.5)
            audio = self._audio_settings()
            if not audio.get("radioChatterEnabled", False):
                self._next_chatter_at = time.monotonic() + self._random_chatter_delay()
                continue
            now = time.monotonic()
            if self._next_chatter_at is None:
                self._next_chatter_at = now + self._random_chatter_delay()
            if now < self._next_chatter_at:
                continue
            if not self._chatter_eligible():
                self._next_chatter_at = now + 3.0
                continue
            selected = self._choose_chatter_clip()
            if selected is None:
                self._next_chatter_at = now + 10.0
                continue
            path, category = selected
            self.enqueue_chatter(path, category)
            self._next_chatter_at = now + self._random_chatter_delay()

    def enqueue_chatter(self, path: Path, category: str, force: bool = False) -> bool:
        audio = self._audio_settings()
        if (not audio.get("enabled", True) or not audio.get("radioChatterEnabled", False) or self._audio_inhibited) and not force:
            return False
        if self.chatter_playback_task and not self.chatter_playback_task.done():
            return False
        self.chatter_playback_task = asyncio.create_task(
            self._play_chatter_clip(path, category, force=force),
            name="thunderscope-chatter-playback",
        )
        return True

    async def test_chatter(self) -> dict[str, Any] | None:
        selected = self._choose_chatter_clip()
        if selected is None:
            return None
        path, category = selected
        self.enqueue_chatter(path, category, force=True)
        return {"file": path.name, "category": category}

    async def _play_chatter_clip(self, path: Path, category: str, force: bool = False) -> bool:
        if not self.supported or not path.exists():
            return False
        try:
            with wave.open(str(path), "rb") as wav_file:
                frame_rate = wav_file.getframerate()
                duration = wav_file.getnframes() / frame_rate if frame_rate else 0.0
        except (wave.Error, OSError) as exc:
            self._last_error = f"Radio clip is not a readable PCM WAV: {path.name} ({exc})"
            return False
        duration = max(0.1, min(duration, 180.0))
        try:
            self._chatter_playing = True
            chatter_volume = int(self._audio_settings().get("radioChatterVolume", 50))
            if self.windows_host:
                player_script = self.base_dir / "play_chatter.ps1"
                if not player_script.exists():
                    self._last_error = f"Missing {player_script.name}"
                    return False
                self._chatter_process = await asyncio.create_subprocess_exec(
                    "powershell.exe", "-Sta", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                    "-File", str(player_script), "-Path", str(path),
                    "-Volume", str(max(0, min(100, chatter_volume))),
                    "-DurationSeconds", f"{duration:.3f}",
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                command = self._linux_wav_command(path, chatter_volume)
                if not command:
                    self._last_error = "No Linux WAV player found. Install pipewire-bin, pulseaudio-utils, ffmpeg, mpv or alsa-utils."
                    return False
                self._chatter_process = await asyncio.create_subprocess_exec(
                    *command,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )

            deadline = time.monotonic() + duration + 0.75
            interrupted = False
            while time.monotonic() < deadline and not self._stop.is_set():
                current_audio = self._audio_settings()
                chatter_disabled = not current_audio.get("enabled", True) or not current_audio.get("radioChatterEnabled", False)
                mix_with_warnings = bool(current_audio.get("radioChatterMixWithWarnings", True))
                warning_should_interrupt = (not mix_with_warnings and self._urgent_pending.is_set())
                if warning_should_interrupt or self._audio_inhibited or (not force and chatter_disabled):
                    interrupted = True
                    break
                if self._chatter_process and self._chatter_process.returncode is not None:
                    break
                await asyncio.sleep(0.04)

            if interrupted:
                await self._stop_chatter_process()
            elif self._chatter_process is not None:
                try:
                    _, stderr = await asyncio.wait_for(self._chatter_process.communicate(), timeout=1.0)
                    if self._chatter_process.returncode not in (0, None):
                        self._last_error = stderr.decode("utf-8", errors="replace").strip() or "Chatter player failed."
                        return False
                except asyncio.TimeoutError:
                    await self._stop_chatter_process()
                finally:
                    self._chatter_process = None

            if interrupted:
                return False
            self._last_chatter = {
                "file": path.name,
                "category": category,
                "timestamp": time.time(),
            }
            return True
        except Exception as exc:  # noqa: BLE001
            self._last_error = f"Radio chatter playback failed: {exc}"
            self.logger.warning("Radio chatter playback failed (%s): %s", path.name, exc)
            return False
        finally:
            if self._chatter_process is not None:
                await self._stop_chatter_process()
            self._chatter_playing = False

    def _refresh_urgent_pending(self) -> None:
        queued = getattr(self.queue, "_queue", [])
        if any(item[0] <= 2 and not str(item[2]).startswith("radio-chatter::") for item in queued):
            self._urgent_pending.set()
        else:
            self._urgent_pending.clear()

    def _clear_queue(self) -> None:
        while True:
            try:
                self.queue.get_nowait()
                self.queue.task_done()
            except asyncio.QueueEmpty:
                break
        self._urgent_pending.clear()

    def enqueue(self, key: str, phrase: str | None = None, priority: int | None = None, force: bool = False) -> bool:
        if (not self._audio_settings().get("enabled", True) or self._audio_inhibited) and not force:
            return False
        definition = ALERT_DEFINITIONS.get(key, ALERT_DEFINITIONS["test"])
        resolved_priority = int(definition["priority"] if priority is None else priority)
        self._sequence += 1
        self.queue.put_nowait((
            resolved_priority,
            self._sequence,
            key,
            phrase or str(definition["phrase"]),
            force,
        ))
        if key != "test":
            self._last_warning_activity = time.time()
        if resolved_priority <= 2:
            self._urgent_pending.set()
        return True

    async def test(self, phrase: str | None = None) -> None:
        self.enqueue("test", phrase or ALERT_DEFINITIONS["test"]["phrase"], 0, force=True)

    async def _worker(self) -> None:
        while not self._stop.is_set():
            priority, sequence, key, phrase, force = await self.queue.get()
            del sequence
            self._refresh_urgent_pending()
            try:
                audio = self._audio_settings()
                if key.startswith("radio-chatter::"):
                    # Chatter has its own playback task from v0.10.2 onward.
                    continue
                if (not audio.get("enabled", True) or self._audio_inhibited) and not force:
                    continue
                if not self.supported:
                    self._last_error = "Host voice alerts require Windows or Linux."
                    continue
                played = False
                if audio.get("preferCustomWav", True):
                    clip = self.audio_dir / f"{key}.wav"
                    if clip.exists():
                        played = await asyncio.to_thread(self._play_wav, clip, int(audio.get("volume", 90)))
                if not played:
                    played = await self._speak_tts(
                        phrase,
                        str(audio.get("voice", "")),
                        int(audio.get("rate", -1)),
                        int(audio.get("volume", 90)),
                    )
                if played:
                    self._last_spoken = {"key": key, "phrase": phrase, "timestamp": time.time()}
                    self._last_error = None
                await asyncio.sleep(max(1.0, float(audio.get("minimumGapSeconds", 1.0))))
            except Exception as exc:  # noqa: BLE001
                self._last_error = f"{type(exc).__name__}: {exc}"
                self.logger.warning("Host audio alert failed: %s", exc)
            finally:
                self.queue.task_done()

    def _linux_wav_command(self, path: Path, volume: int) -> list[str] | None:
        level = max(0, min(100, int(volume)))
        if shutil.which("pw-play"):
            return ["pw-play", f"--volume={level / 100:.3f}", "--latency=120ms", str(path)]
        if shutil.which("paplay"):
            pulse_volume = round(65536 * level / 100)
            return ["paplay", f"--volume={pulse_volume}", str(path)]
        if shutil.which("ffplay"):
            return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", str(level), str(path)]
        if shutil.which("mpv"):
            return ["mpv", "--no-video", "--really-quiet", f"--volume={level}", str(path)]
        if shutil.which("aplay"):
            return ["aplay", "-q", str(path)]
        return None

    def _linux_wav_backend(self) -> str | None:
        for command, label in (
            ("pw-play", "PipeWire pw-play"),
            ("paplay", "PulseAudio/PipeWire paplay"),
            ("ffplay", "FFmpeg ffplay"),
            ("mpv", "mpv"),
            ("aplay", "ALSA aplay"),
        ):
            if shutil.which(command):
                return label
        return None

    def _linux_tts_backend(self) -> str | None:
        if shutil.which("spd-say"):
            return "Speech Dispatcher"
        if shutil.which("espeak-ng"):
            return "eSpeak NG"
        if shutil.which("espeak"):
            return "eSpeak"
        return None

    async def _stop_chatter_process(self) -> None:
        process = self._chatter_process
        self._chatter_process = None
        if process is None or process.returncode is not None:
            return
        try:
            process.terminate()
            await asyncio.wait_for(process.wait(), timeout=0.5)
        except (asyncio.TimeoutError, ProcessLookupError):
            try:
                process.kill()
                await process.wait()
            except ProcessLookupError:
                pass

    def _play_wav(self, path: Path, volume: int) -> bool:
        try:
            if self.windows_host:
                import winsound
                winsound.PlaySound(str(path), winsound.SND_FILENAME)
                return True
            if self.linux_host:
                command = self._linux_wav_command(path, volume)
                if not command:
                    self._last_error = "No Linux WAV player found. Install pipewire-bin, pulseaudio-utils, ffmpeg, mpv or alsa-utils."
                    return False
                result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=180)
                if result.returncode == 0:
                    return True
                self._last_error = result.stderr.strip() or f"{command[0]} exited with code {result.returncode}"
                return False
            return False
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Custom WAV could not be played (%s): %s", path.name, exc)
            self._last_error = f"Custom WAV playback failed: {exc}"
            return False

    async def _ensure_tts_daemon(self) -> asyncio.subprocess.Process | None:
        if not self.windows_host or not self.daemon_script_path.exists():
            return None
        if self._tts_process is not None and self._tts_process.returncode is None:
            return self._tts_process
        self._tts_process = await asyncio.create_subprocess_exec(
            "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", str(self.daemon_script_path),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        if not self._tts_process.stdout:
            await self._stop_tts_daemon()
            return None
        ready = await asyncio.wait_for(self._tts_process.stdout.readline(), timeout=8.0)
        if ready.decode("utf-8", errors="replace").strip() != "READY":
            await self._stop_tts_daemon()
            return None
        return self._tts_process

    async def _stop_tts_daemon(self) -> None:
        process = self._tts_process
        self._tts_process = None
        if process is None or process.returncode is not None:
            return
        try:
            if process.stdin:
                process.stdin.close()
            await asyncio.wait_for(process.wait(), timeout=1.0)
        except (asyncio.TimeoutError, ProcessLookupError):
            process.kill()
            await process.wait()

    async def _speak_tts(self, text: str, voice: str, rate: int, volume: int) -> bool:
        if self.linux_host:
            return await self._speak_tts_linux(text, voice, rate, volume)
        async with self._tts_lock:
            try:
                process = await self._ensure_tts_daemon()
                if process and process.stdin and process.stdout:
                    payload = json.dumps({
                        "text": text,
                        "voice": voice,
                        "rate": max(-10, min(10, rate)),
                        "volume": max(0, min(100, volume)),
                    }, separators=(",", ":"))
                    process.stdin.write((payload + "\n").encode("utf-8"))
                    await process.stdin.drain()
                    response = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
                    message = response.decode("utf-8", errors="replace").strip()
                    if message == "OK":
                        return True
                    self._last_error = message or "The persistent TTS process closed unexpectedly."
                    await self._stop_tts_daemon()
            except Exception as exc:  # noqa: BLE001
                self._last_error = f"Persistent TTS failed: {exc}"
                await self._stop_tts_daemon()

            if not self.script_path.exists():
                self._last_error = f"Missing {self.script_path.name}"
                return False
            process = await asyncio.create_subprocess_exec(
                "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                "-File", str(self.script_path), "-Text", text, "-Voice", voice,
                "-Rate", str(max(-10, min(10, rate))),
                "-Volume", str(max(0, min(100, volume))),
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await process.communicate()
            if process.returncode == 0:
                return True
            message = stderr.decode("utf-8", errors="replace").strip()
            self._last_error = message or f"PowerShell exited with code {process.returncode}"
            return False

    async def _speak_tts_linux(self, text: str, voice: str, rate: int, volume: int) -> bool:
        async with self._tts_lock:
            backend = self._linux_tts_backend()
            if backend == "Speech Dispatcher" and not voice.startswith("espeak:"):
                command = [
                    "spd-say", "--wait", "--priority=important",
                    f"--rate={max(-100, min(100, int(rate) * 10))}",
                    f"--volume={max(-100, min(100, int(volume) * 2 - 100))}",
                ]
                if voice.startswith("spd:"):
                    command.append(f"--voice-type={voice.split(':', 1)[1]}")
                elif voice.startswith("spd-voice:"):
                    command.append(f"--synthesis-voice={voice.split(':', 1)[1]}")
                command.append(text)
            else:
                executable = "espeak-ng" if shutil.which("espeak-ng") else ("espeak" if shutil.which("espeak") else None)
                if executable is None:
                    self._last_error = "No Linux TTS engine found. Install speech-dispatcher or espeak-ng."
                    return False
                speed = max(80, min(320, 175 + int(rate) * 12))
                amplitude = max(0, min(200, int(volume) * 2))
                command = [executable, "-s", str(speed), "-a", str(amplitude)]
                if voice.startswith("espeak:"):
                    command.extend(["-v", voice.split(':', 1)[1]])
                command.append(text)
            try:
                process = await asyncio.create_subprocess_exec(
                    *command,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
                if process.returncode == 0:
                    return True
                self._last_error = stderr.decode("utf-8", errors="replace").strip() or f"{command[0]} exited with code {process.returncode}"
                return False
            except Exception as exc:  # noqa: BLE001
                self._last_error = f"Linux TTS failed: {exc}"
                return False

    def list_voices(self, refresh: bool = False) -> list[str]:
        if self._voices_cache is not None and not refresh:
            return self._voices_cache
        if not self.supported:
            self._voices_cache = []
            return []
        if self.linux_host:
            voices: list[str] = []
            if shutil.which("spd-say"):
                voices.extend([
                    "spd:male1", "spd:male2", "spd:male3",
                    "spd:female1", "spd:female2", "spd:female3",
                    "spd:child_male", "spd:child_female",
                ])
            executable = "espeak-ng" if shutil.which("espeak-ng") else ("espeak" if shutil.which("espeak") else None)
            if executable:
                try:
                    result = subprocess.run(
                        [executable, "--voices=en"],
                        check=False, capture_output=True, text=True, timeout=8,
                    )
                    for line in result.stdout.splitlines()[1:]:
                        parts = line.split()
                        if len(parts) >= 4:
                            candidate = f"espeak:{parts[3]}"
                            if candidate not in voices:
                                voices.append(candidate)
                except Exception as exc:  # noqa: BLE001
                    self._last_error = f"Linux voice discovery failed: {exc}"
            self._voices_cache = voices
            return voices
        command = (
            "Add-Type -AssemblyName System.Speech; "
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }"
        )
        try:
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                check=False, capture_output=True, text=True, timeout=8,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            self._voices_cache = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        except Exception as exc:  # noqa: BLE001
            self._last_error = f"Voice discovery failed: {exc}"
            self._voices_cache = []
        return self._voices_cache

    def clip_status(self) -> dict[str, bool]:
        return {key: (self.audio_dir / f"{key}.wav").exists() for key in ALERT_DEFINITIONS if key != "test"}

    def clip_durations(self) -> dict[str, float | None]:
        durations: dict[str, float | None] = {}
        for key in ALERT_DEFINITIONS:
            if key == "test":
                continue
            path = self.audio_dir / f"{key}.wav"
            if not path.exists():
                durations[key] = None
                continue
            try:
                with wave.open(str(path), "rb") as wav_file:
                    rate = wav_file.getframerate()
                    durations[key] = round(wav_file.getnframes() / rate, 3) if rate else None
            except (wave.Error, OSError):
                durations[key] = None
        return durations

    def status(self) -> dict[str, Any]:
        audio = self._audio_settings()
        chatter_clips = self._scan_chatter_clips()
        chatter_counts = {category: len(paths) for category, paths in chatter_clips.items()}
        vaicom_themes = self._scan_vaicom_themes()
        vaicom_counts = {theme: len(paths) for theme, paths in vaicom_themes.items()}
        return {
            "supported": self.supported,
            "platform": platform.platform(),
            "enabled": bool(audio.get("enabled", True)),
            "inhibited_stationary": self._audio_inhibited,
            "backend": (
                "Persistent Windows SAPI + WAV override" if self.windows_host else
                f"Linux: {self._linux_tts_backend() or 'no TTS'} + {self._linux_wav_backend() or 'no WAV player'}" if self.linux_host else
                "Unavailable on this host"
            ),
            "wav_backend": self._linux_wav_backend() if self.linux_host else ("winsound alerts + WPF chatter channel" if self.windows_host else None),
            "tts_backend": self._linux_tts_backend() if self.linux_host else ("Windows SAPI" if self.windows_host else None),
            "voice": audio.get("voice", ""),
            "queue_depth": self.queue.qsize(),
            "last_spoken": self._last_spoken,
            "last_error": self._last_error,
            "controls": dict(self._control_confirmed),
            "mach": self._last_mach,
            "tts_daemon_ready": (
                bool(self._tts_process and self._tts_process.returncode is None) if self.windows_host
                else bool(self._linux_tts_backend()) if self.linux_host
                else False
            ),
            "clips": self.clip_status(),
            "clip_durations": self.clip_durations(),
            "radio_chatter": {
                "enabled": bool(audio.get("radioChatterEnabled", False)),
                "playing": self._chatter_playing,
                "context": self._chatter_context(self._last_snapshot),
                "source": str(audio.get("radioChatterSource", "vaicom")),
                "selected_vaicom_theme": str(audio.get("radioChatterVaicomTheme", "Navy")),
                "mix_with_warnings": bool(audio.get("radioChatterMixWithWarnings", True)),
                "volume": int(audio.get("radioChatterVolume", 50)),
                "total_clips": sum(chatter_counts.values()) + sum(vaicom_counts.values()),
                "crew_total_clips": sum(chatter_counts.values()),
                "categories": chatter_counts,
                "vaicom_total_clips": sum(vaicom_counts.values()),
                "vaicom_themes": vaicom_counts,
                "last_played": self._last_chatter,
                "next_in_seconds": max(0.0, self._next_chatter_at - time.monotonic()) if self._next_chatter_at else None,
            },
        }
