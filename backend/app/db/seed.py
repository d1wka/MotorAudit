"""
IEC motor efficiency seed data.

Source: IEC 60034-30-1:2014 Table 1 — minimum efficiency values for 4-pole,
50 Hz induction motors at 100 %, 75 %, and 50 % of rated load.

η_25 (25 % load) is not defined in IEC 60034-30-1; values here are estimates
derived from the standard loss-component model (iron losses dominate at light
load, so efficiency drops noticeably below 50 % load).

All values are expressed as fractions (0–1), not percentages.
"""

from __future__ import annotations
from typing import TypedDict


class MotorRecord(TypedDict):
    id: str
    label: str
    rated_power_kw: float
    poles: int
    ie_class: str
    eta_100: float  # efficiency at 100 % load
    eta_75: float   # efficiency at 75 % load
    eta_50: float   # efficiency at 50 % load
    eta_25: float   # estimated efficiency at 25 % load


MOTORS: list[MotorRecord] = [
    # ── 4 kW ──────────────────────────────────────────────────────────────────
    {"id": "iec-4kw-ie1",  "label": "4 kW IE1",  "rated_power_kw": 4.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.845, "eta_75": 0.831, "eta_50": 0.802, "eta_25": 0.757},
    {"id": "iec-4kw-ie2",  "label": "4 kW IE2",  "rated_power_kw": 4.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.867, "eta_75": 0.857, "eta_50": 0.832, "eta_25": 0.789},
    {"id": "iec-4kw-ie3",  "label": "4 kW IE3",  "rated_power_kw": 4.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.891, "eta_75": 0.885, "eta_50": 0.867, "eta_25": 0.828},
    {"id": "iec-4kw-ie4",  "label": "4 kW IE4",  "rated_power_kw": 4.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.904, "eta_75": 0.901, "eta_50": 0.888, "eta_25": 0.852},

    # ── 7.5 kW ────────────────────────────────────────────────────────────────
    {"id": "iec-7.5kw-ie1", "label": "7.5 kW IE1", "rated_power_kw": 7.5,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.875, "eta_75": 0.866, "eta_50": 0.843, "eta_25": 0.798},
    {"id": "iec-7.5kw-ie2", "label": "7.5 kW IE2", "rated_power_kw": 7.5,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.892, "eta_75": 0.885, "eta_50": 0.867, "eta_25": 0.826},
    {"id": "iec-7.5kw-ie3", "label": "7.5 kW IE3", "rated_power_kw": 7.5,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.912, "eta_75": 0.910, "eta_50": 0.898, "eta_25": 0.860},
    {"id": "iec-7.5kw-ie4", "label": "7.5 kW IE4", "rated_power_kw": 7.5,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.921, "eta_75": 0.920, "eta_50": 0.912, "eta_25": 0.878},

    # ── 11 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-11kw-ie1",  "label": "11 kW IE1",  "rated_power_kw": 11.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.885, "eta_75": 0.878, "eta_50": 0.857, "eta_25": 0.813},
    {"id": "iec-11kw-ie2",  "label": "11 kW IE2",  "rated_power_kw": 11.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.902, "eta_75": 0.897, "eta_50": 0.881, "eta_25": 0.842},
    {"id": "iec-11kw-ie3",  "label": "11 kW IE3",  "rated_power_kw": 11.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.919, "eta_75": 0.918, "eta_50": 0.907, "eta_25": 0.871},
    {"id": "iec-11kw-ie4",  "label": "11 kW IE4",  "rated_power_kw": 11.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.929, "eta_75": 0.929, "eta_50": 0.922, "eta_25": 0.890},

    # ── 15 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-15kw-ie1",  "label": "15 kW IE1",  "rated_power_kw": 15.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.894, "eta_75": 0.888, "eta_50": 0.869, "eta_25": 0.826},
    {"id": "iec-15kw-ie2",  "label": "15 kW IE2",  "rated_power_kw": 15.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.911, "eta_75": 0.907, "eta_50": 0.892, "eta_25": 0.854},
    {"id": "iec-15kw-ie3",  "label": "15 kW IE3",  "rated_power_kw": 15.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.926, "eta_75": 0.926, "eta_50": 0.916, "eta_25": 0.880},
    {"id": "iec-15kw-ie4",  "label": "15 kW IE4",  "rated_power_kw": 15.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.935, "eta_75": 0.936, "eta_50": 0.930, "eta_25": 0.900},

    # ── 22 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-22kw-ie1",  "label": "22 kW IE1",  "rated_power_kw": 22.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.903, "eta_75": 0.899, "eta_50": 0.881, "eta_25": 0.840},
    {"id": "iec-22kw-ie2",  "label": "22 kW IE2",  "rated_power_kw": 22.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.920, "eta_75": 0.917, "eta_50": 0.903, "eta_25": 0.866},
    {"id": "iec-22kw-ie3",  "label": "22 kW IE3",  "rated_power_kw": 22.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.933, "eta_75": 0.934, "eta_50": 0.926, "eta_25": 0.893},
    {"id": "iec-22kw-ie4",  "label": "22 kW IE4",  "rated_power_kw": 22.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.941, "eta_75": 0.942, "eta_50": 0.937, "eta_25": 0.908},

    # ── 37 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-37kw-ie1",  "label": "37 kW IE1",  "rated_power_kw": 37.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.914, "eta_75": 0.910, "eta_50": 0.894, "eta_25": 0.855},
    {"id": "iec-37kw-ie2",  "label": "37 kW IE2",  "rated_power_kw": 37.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.929, "eta_75": 0.927, "eta_50": 0.915, "eta_25": 0.879},
    {"id": "iec-37kw-ie3",  "label": "37 kW IE3",  "rated_power_kw": 37.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.942, "eta_75": 0.944, "eta_50": 0.937, "eta_25": 0.907},
    {"id": "iec-37kw-ie4",  "label": "37 kW IE4",  "rated_power_kw": 37.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.949, "eta_75": 0.951, "eta_50": 0.948, "eta_25": 0.921},

    # ── 55 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-55kw-ie1",  "label": "55 kW IE1",  "rated_power_kw": 55.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.921, "eta_75": 0.917, "eta_50": 0.903, "eta_25": 0.865},
    {"id": "iec-55kw-ie2",  "label": "55 kW IE2",  "rated_power_kw": 55.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.935, "eta_75": 0.933, "eta_50": 0.923, "eta_25": 0.889},
    {"id": "iec-55kw-ie3",  "label": "55 kW IE3",  "rated_power_kw": 55.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.946, "eta_75": 0.949, "eta_50": 0.943, "eta_25": 0.914},
    {"id": "iec-55kw-ie4",  "label": "55 kW IE4",  "rated_power_kw": 55.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.953, "eta_75": 0.956, "eta_50": 0.953, "eta_25": 0.927},

    # ── 75 kW ─────────────────────────────────────────────────────────────────
    {"id": "iec-75kw-ie1",  "label": "75 kW IE1",  "rated_power_kw": 75.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.927, "eta_75": 0.924, "eta_50": 0.910, "eta_25": 0.873},
    {"id": "iec-75kw-ie2",  "label": "75 kW IE2",  "rated_power_kw": 75.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.940, "eta_75": 0.939, "eta_50": 0.929, "eta_25": 0.896},
    {"id": "iec-75kw-ie3",  "label": "75 kW IE3",  "rated_power_kw": 75.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.950, "eta_75": 0.953, "eta_50": 0.948, "eta_25": 0.920},
    {"id": "iec-75kw-ie4",  "label": "75 kW IE4",  "rated_power_kw": 75.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.956, "eta_75": 0.960, "eta_50": 0.957, "eta_25": 0.932},

    # ── 110 kW ────────────────────────────────────────────────────────────────
    {"id": "iec-110kw-ie1", "label": "110 kW IE1", "rated_power_kw": 110.0,
     "poles": 4, "ie_class": "IE1",
     "eta_100": 0.933, "eta_75": 0.931, "eta_50": 0.918, "eta_25": 0.882},
    {"id": "iec-110kw-ie2", "label": "110 kW IE2", "rated_power_kw": 110.0,
     "poles": 4, "ie_class": "IE2",
     "eta_100": 0.945, "eta_75": 0.944, "eta_50": 0.936, "eta_25": 0.905},
    {"id": "iec-110kw-ie3", "label": "110 kW IE3", "rated_power_kw": 110.0,
     "poles": 4, "ie_class": "IE3",
     "eta_100": 0.954, "eta_75": 0.957, "eta_50": 0.952, "eta_25": 0.926},
    {"id": "iec-110kw-ie4", "label": "110 kW IE4", "rated_power_kw": 110.0,
     "poles": 4, "ie_class": "IE4",
     "eta_100": 0.958, "eta_75": 0.963, "eta_50": 0.961, "eta_25": 0.938},
]

# Fast lookup dictionaries
_BY_ID: dict[str, MotorRecord] = {m["id"]: m for m in MOTORS}
_BY_CLASS_POWER: dict[tuple[str, float], MotorRecord] = {
    (m["ie_class"], m["rated_power_kw"]): m for m in MOTORS
}
_POWER_RATINGS = sorted({m["rated_power_kw"] for m in MOTORS})


def get_motor_by_id(motor_id: str) -> MotorRecord | None:
    return _BY_ID.get(motor_id)


def get_all_motors() -> list[MotorRecord]:
    return MOTORS


def nearest_rated_power(kw: float) -> float:
    """Return the closest tabulated power rating to the requested value."""
    return min(_POWER_RATINGS, key=lambda p: abs(p - kw))
