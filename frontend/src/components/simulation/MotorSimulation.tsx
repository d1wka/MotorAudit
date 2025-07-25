"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ─── Motor & Vehicle constants ────────────────────────────────────────────────
const MOTOR_MAX_TORQUE = 300;   // Nm
const MOTOR_MAX_POWER  = 80_000; // W  (80 kW)
const MOTOR_MAX_RPM    = 12_000;
const MOTOR_BASE_RPM   = Math.round((MOTOR_MAX_POWER * 60) / (2 * Math.PI * MOTOR_MAX_TORQUE)); // ~2547

const VEHICLE_MASS   = 1_800;  // kg
const DRAG_CD        = 0.25;
const FRONTAL_AREA   = 2.3;    // m²
const AIR_DENSITY    = 1.225;  // kg/m³
const ROLLING_CR     = 0.012;
const WHEEL_RADIUS   = 0.33;   // m
const GEAR_RATIO     = 7.0;
const BATTERY_KWH    = 60;
const GRAVITY        = 9.81;

// ─── Motor model ──────────────────────────────────────────────────────────────
function motorTorqueAtRpm(rpm: number): number {
  if (rpm < 1) return MOTOR_MAX_TORQUE;
  const rps = rpm / 60;
  return Math.min(MOTOR_MAX_TORQUE, MOTOR_MAX_POWER / (2 * Math.PI * rps));
}

function motorEfficiency(torque: number, rpm: number): number {
  if (rpm < 10 || torque < 0.5) return 0;
  const lf = torque / motorTorqueAtRpm(rpm);
  return 0.88 + 0.07 * Math.exp(-2.5 * (lf - 0.70) ** 2);
}

// Pre-compute torque-speed curve for the Recharts chart (every 100 RPM)
const TORQUE_CURVE = Array.from({ length: MOTOR_MAX_RPM / 100 + 1 }, (_, i) => ({
  rpm: i * 100,
  torque: Math.round(motorTorqueAtRpm(i * 100) * 10) / 10,
}));

// ─── Physics state (kept in a ref for the rAF loop) ──────────────────────────
interface PhysState {
  velocity: number;  // m/s
  motorRpm: number;
  torque: number;    // Nm actually applied
  mechPow: number;   // W
  elecPow: number;   // W
  eta: number;       // 0-1
  soc: number;       // % battery
  distM: number;
  kWh: number;
}

function makeInitState(): PhysState {
  return { velocity: 0, motorRpm: 0, torque: 0, mechPow: 0, elecPow: 0, eta: 0, soc: 100, distM: 0, kWh: 0 };
}

function stepPhysics(s: PhysState, throttle: number, braking: boolean, dt: number): PhysState {
  const v = s.velocity;
  const rpm = (v / (2 * Math.PI * WHEEL_RADIUS)) * GEAR_RATIO * 60;
  const maxT = motorTorqueAtRpm(rpm);
  const torque = maxT * throttle;

  const Ft = (torque * GEAR_RATIO) / WHEEL_RADIUS;
  const Fa = 0.5 * AIR_DENSITY * DRAG_CD * FRONTAL_AREA * v * v;
  const Fr = ROLLING_CR * VEHICLE_MASS * GRAVITY;
  const Fb = braking ? VEHICLE_MASS * 4.5 : 0;

  let Fnet = Ft - Fa - Fr - Fb;
  if (v <= 0.01 && Fnet < 0) Fnet = 0;

  const newV   = Math.max(0, v + (Fnet / VEHICLE_MASS) * dt);
  const newRpm = Math.min(MOTOR_MAX_RPM, (newV / (2 * Math.PI * WHEEL_RADIUS)) * GEAR_RATIO * 60);
  const eta    = motorEfficiency(torque, rpm);
  const mechPow = torque * (rpm / 60) * 2 * Math.PI;
  const elecPow = eta > 0.01 ? mechPow / eta : 0;
  const dKwh    = (elecPow * dt) / 3_600_000;

  return {
    velocity: newV,
    motorRpm: newRpm,
    torque,
    mechPow,
    elecPow,
    eta,
    soc: Math.max(0, s.soc - (dKwh / BATTERY_KWH) * 100),
    distM: s.distM + newV * dt,
    kWh: s.kWh + dKwh,
  };
}

// ─── Canvas: Motor cross-section ─────────────────────────────────────────────
function drawMotor(
  ctx: CanvasRenderingContext2D,
  size: number,
  motorAngle: number,
  rpm: number,
) {
  const cx = size / 2, cy = size / 2;
  const R = size * 0.43;
  const rotorR = R * 0.60;
  const statorInner = R * 0.74;

  ctx.clearRect(0, 0, size, size);

  // Housing ring (cooling fins)
  ctx.fillStyle = "#0d1a2d";
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let f = 0; f < 20; f++) {
    const fa = (f / 20) * Math.PI * 2;
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(fa) * (R + size * 0.02), cy + Math.sin(fa) * (R + size * 0.02));
    ctx.lineTo(cx + Math.cos(fa) * (R + size * 0.07), cy + Math.sin(fa) * (R + size * 0.07));
    ctx.stroke();
  }

  // Stator yoke
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // Air gap
  ctx.fillStyle = "#060b14";
  ctx.beginPath();
  ctx.arc(cx, cy, statorInner - 1, 0, Math.PI * 2);
  ctx.fill();

  // 3-phase electrical angle (2 pole pairs for 4-pole)
  const ea = motorAngle * 2;
  const phA =  Math.sin(ea);
  const phB =  Math.sin(ea - 2.094);
  const phC =  Math.sin(ea - 4.189);
  const phases = [phA, -phB, phC, -phA, phB, -phC, phA, -phB, phC, -phA, phB, -phC];
  const hues   = [210,  0,  120,  210,  0,  120,  210,  0,  120,  210,  0,  120];

  const halfW = Math.PI / 12 * 0.72;
  for (let i = 0; i < 12; i++) {
    const sc = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const intensity = Math.max(0, phases[i]);
    const l = 10 + intensity * 52;
    ctx.fillStyle = `hsl(${hues[i]}, 90%, ${l}%)`;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1.5, sc - halfW, sc + halfW);
    ctx.arc(cx, cy, statorInner, sc + halfW, sc - halfW, true);
    ctx.closePath();
    ctx.fill();
  }

  // Rotor (rotating)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(motorAngle);

  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, rotorR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4 pole pieces (N-S-N-S at 0,90,180,270)
  const poleHalf = 0.58; // radians
  const poleColors = ["#1d4ed8", "#b91c1c", "#1d4ed8", "#b91c1c"];
  const poleLabels = ["N", "S", "N", "S"];

  for (let p = 0; p < 4; p++) {
    ctx.save();
    ctx.rotate(p * Math.PI / 2);
    ctx.fillStyle = poleColors[p];
    ctx.beginPath();
    ctx.arc(0, 0, rotorR * 0.95, -Math.PI / 2 - poleHalf, -Math.PI / 2 + poleHalf);
    ctx.arc(0, 0, rotorR * 0.38, -Math.PI / 2 + poleHalf, -Math.PI / 2 - poleHalf, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `bold ${Math.round(rotorR * 0.19)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(poleLabels[p], 0, -rotorR * 0.66);
    ctx.restore();
  }

  // Center disc
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(0, 0, rotorR * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Shaft
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.arc(0, 0, rotorR * 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // RPM tag
  const tagH = size * 0.09;
  ctx.fillStyle = "rgba(6, 11, 20, 0.82)";
  const tagY = cy + R + size * 0.05;
  ctx.beginPath();
  ctx.rect(cx - 44, tagY - tagH / 2, 88, tagH);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = `${Math.round(size * 0.055)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(rpm).toLocaleString()} RPM`, cx, tagY);
}

// ─── Canvas: Car scene ────────────────────────────────────────────────────────
function drawCar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  velocity: number,
  roadOffset: number,
  wheelAngle: number,
) {
  ctx.clearRect(0, 0, w, h);

  // ── Sky ────────────────────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.56);
  sky.addColorStop(0, "#020617");
  sky.addColorStop(1, "#0f172a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.56);

  // Stars
  const STARS = [42,14, 115,28, 198,9, 290,42, 365,18, 438,33, 510,11, 576,47, 80,38, 250,7, 320,52, 160,22];
  ctx.fillStyle = "rgba(255,255,255,0.70)";
  for (let i = 0; i < STARS.length; i += 2) {
    ctx.beginPath();
    ctx.arc(STARS[i], STARS[i + 1], STARS[i] % 3 === 0 ? 1.3 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  const gnd = ctx.createLinearGradient(0, h * 0.56, 0, h);
  gnd.addColorStop(0, "#14201a");
  gnd.addColorStop(1, "#080f0a");
  ctx.fillStyle = gnd;
  ctx.fillRect(0, h * 0.56, w, h * 0.44);

  // ── Road ───────────────────────────────────────────────────────────────────
  const roadY = h * 0.58;
  const roadH = h * 0.35;

  const roadGrd = ctx.createLinearGradient(0, roadY, 0, roadY + roadH);
  roadGrd.addColorStop(0, "#1c2732");
  roadGrd.addColorStop(1, "#0e1520");
  ctx.fillStyle = roadGrd;
  ctx.fillRect(0, roadY, w, roadH);

  // Amber borders
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, roadY); ctx.lineTo(w, roadY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, roadY + roadH); ctx.lineTo(w, roadY + roadH); ctx.stroke();

  // Solid white lane edges (inside the amber)
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, roadY + roadH * 0.25); ctx.lineTo(w, roadY + roadH * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, roadY + roadH * 0.75); ctx.lineTo(w, roadY + roadH * 0.75); ctx.stroke();

  // Center dashes — positive offset = pattern slides LEFT = car moves RIGHT ✓
  const dash = 38, gap = 24, period = dash + gap;
  ctx.strokeStyle = "rgba(255,255,255,0.50)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([dash, gap]);
  ctx.lineDashOffset = roadOffset % period;
  ctx.beginPath(); ctx.moveTo(0, roadY + roadH / 2); ctx.lineTo(w, roadY + roadH / 2); ctx.stroke();
  ctx.setLineDash([]);

  // Road surface glare strip (wet road shine)
  const glare = ctx.createLinearGradient(0, roadY, 0, roadY + roadH);
  glare.addColorStop(0,   "rgba(255,255,255,0.03)");
  glare.addColorStop(0.3, "rgba(255,255,255,0.06)");
  glare.addColorStop(0.6, "rgba(255,255,255,0.02)");
  glare.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(0, roadY, w, roadH);

  // Speed streaks (trail behind car, appear on the left)
  const speedA = Math.min(0.60, Math.max(0, (velocity - 10) / 30));
  if (speedA > 0) {
    const streakEndX = w * 0.32;
    for (const frac of [0.12, 0.27, 0.44, 0.59, 0.73, 0.86, 0.94]) {
      const len = Math.min(90, velocity * 2.2);
      ctx.strokeStyle = `rgba(147,197,253,${speedA * 0.48})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(streakEndX - len, roadY + roadH * frac);
      ctx.lineTo(streakEndX, roadY + roadH * frac);
      ctx.stroke();
    }
  }

  // ── Car geometry ───────────────────────────────────────────────────────────
  // Car faces RIGHT: front = right side, rear = left side
  const wR    = 23;                         // wheel radius px
  const wheelY = roadY + roadH * 0.62;      // wheel centre Y
  const RL    = w * 0.34;                   // rear-left edge of car
  const cW    = Math.min(218, w * 0.38);    // car body width
  const cH    = Math.round(cW * 0.295);     // body height (low & sporty)
  const botY  = wheelY - wR * 0.30;         // body bottom Y (sill)
  const topY  = botY - cH;                  // roof peak Y

  // Wheel x positions
  const rearWX  = RL + cW * 0.20;
  const frontWX = RL + cW * 0.82;

  // ── Ground shadow ──────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(RL + cW * 0.50, wheelY + wR + 6, cW * 0.47, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Body ───────────────────────────────────────────────────────────────────
  // Profile (facing right): rear on left, front on right
  // Key X fractions along cW from RL:
  //   0.00 = rearmost bumper
  //   0.10 = trunk base
  //   0.28 = rear glass base / C-pillar bottom
  //   0.34 = rear glass top  / C-pillar top  (joins roof)
  //   0.68 = A-pillar top    (start of windshield)
  //   0.88 = A-pillar base   (hood/cowl)
  //   0.97 = hood end
  //   1.00 = front corner

  const R = RL; // alias
  const bp = new Path2D();

  // Rear bottom corner
  bp.moveTo(R + cW * 0.02,  botY);
  // Rear bumper (rounded bottom-left)
  bp.quadraticCurveTo(R,             botY,          R,             botY - cH * 0.10);
  // Rear quarter panel going up
  bp.quadraticCurveTo(R - cW * 0.01, botY - cH * 0.38, R + cW * 0.05, botY - cH * 0.54);
  // Trunk lid peak
  bp.quadraticCurveTo(R + cW * 0.08, topY + cH * 0.26, R + cW * 0.14, topY + cH * 0.24);
  // Rear glass slope (C-pillar)
  bp.lineTo(R + cW * 0.34, topY + cH * 0.02);
  // Roof (flat top)
  bp.lineTo(R + cW * 0.70, topY);
  // Windshield slope (A-pillar — steeper/sportier)
  bp.lineTo(R + cW * 0.90, topY + cH * 0.26);
  // Hood line
  bp.quadraticCurveTo(R + cW * 0.96, topY + cH * 0.32, R + cW * 1.00, topY + cH * 0.35);
  // Front corner (rounded)
  bp.quadraticCurveTo(R + cW * 1.025, topY + cH * 0.38, R + cW * 1.02, botY - cH * 0.12);
  // Front bumper down
  bp.quadraticCurveTo(R + cW * 1.02, botY, R + cW * 0.98, botY);
  // Sill (floor)
  bp.lineTo(R + cW * 0.02, botY);
  bp.closePath();

  // Metallic blue-silver paint
  const bodyGrd = ctx.createLinearGradient(R, topY, R, botY);
  bodyGrd.addColorStop(0,    "#d4e8ff");   // specular highlight at roof
  bodyGrd.addColorStop(0.08, "#7ab8f5");   // upper gleam
  bodyGrd.addColorStop(0.28, "#3b82f6");   // mid blue
  bodyGrd.addColorStop(0.58, "#1d4ed8");   // lower body
  bodyGrd.addColorStop(0.82, "#1e3a8a");   // sill shadow
  bodyGrd.addColorStop(1,    "#172554");   // rocker
  ctx.fillStyle = bodyGrd;
  ctx.fill(bp);

  // Body outline
  ctx.strokeStyle = "#1e3a8a";
  ctx.lineWidth = 1.5;
  ctx.stroke(bp);

  // Shoulder crease highlight (specular reflection line)
  ctx.strokeStyle = "rgba(200,230,255,0.30)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(R + cW * 0.06, botY - cH * 0.44);
  ctx.bezierCurveTo(
    R + cW * 0.28, botY - cH * 0.52,
    R + cW * 0.65, botY - cH * 0.50,
    R + cW * 0.96, botY - cH * 0.36,
  );
  ctx.stroke();

  // ── Glass area ─────────────────────────────────────────────────────────────
  // Rear window
  const rwPath = new Path2D();
  rwPath.moveTo(R + cW * 0.15, botY - cH * 0.52);
  rwPath.lineTo(R + cW * 0.34, topY + cH * 0.05);
  rwPath.lineTo(R + cW * 0.46, topY + cH * 0.05);
  rwPath.lineTo(R + cW * 0.46, botY - cH * 0.50);
  rwPath.closePath();
  ctx.fillStyle = "rgba(172,220,255,0.15)";
  ctx.fill(rwPath);
  ctx.strokeStyle = "rgba(100,170,255,0.40)";
  ctx.lineWidth = 1;
  ctx.stroke(rwPath);

  // Front window (windshield)
  const fwPath = new Path2D();
  fwPath.moveTo(R + cW * 0.48, botY - cH * 0.48);
  fwPath.lineTo(R + cW * 0.70, topY + cH * 0.04);
  fwPath.lineTo(R + cW * 0.88, topY + cH * 0.04);
  fwPath.lineTo(R + cW * 0.89, topY + cH * 0.26);
  fwPath.closePath();
  ctx.fillStyle = "rgba(172,220,255,0.15)";
  ctx.fill(fwPath);
  ctx.strokeStyle = "rgba(100,170,255,0.40)";
  ctx.lineWidth = 1;
  ctx.stroke(fwPath);

  // ── Side mirror (visible because car faces right, mirror on far/driver side) ─
  const mirX = R + cW * 0.22;
  const mirY = topY + cH * 0.24;
  ctx.fillStyle = "#2563eb";
  ctx.strokeStyle = "#1e3a8a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mirX,               mirY);
  ctx.lineTo(mirX - cW * 0.035,  mirY + cH * 0.10);
  ctx.lineTo(mirX + cW * 0.022,  mirY + cH * 0.10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // ── LED light strips ───────────────────────────────────────────────────────
  const moving = velocity > 0.3;
  const frontX = R + cW * 1.015;

  // Front DRL (vertical strip on right side)
  ctx.lineCap = "round";
  ctx.strokeStyle = moving ? "#fef9c3" : "rgba(200,200,100,0.3)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(frontX, topY + cH * 0.30);
  ctx.lineTo(frontX, topY + cH * 0.58);
  ctx.stroke();

  // Front lower accent line
  ctx.strokeStyle = moving ? "rgba(254,249,195,0.55)" : "rgba(100,100,50,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frontX - cW * 0.08, topY + cH * 0.58);
  ctx.lineTo(frontX,             topY + cH * 0.58);
  ctx.stroke();

  // Headlight beam
  if (moving) {
    const beam = ctx.createLinearGradient(frontX, 0, frontX + cW * 0.95, 0);
    beam.addColorStop(0, "rgba(254,249,195,0.24)");
    beam.addColorStop(1, "rgba(254,249,195,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(frontX, topY + cH * 0.26);
    ctx.lineTo(frontX + cW * 0.95, topY + cH * 0.06);
    ctx.lineTo(frontX + cW * 0.95, topY + cH * 0.70);
    ctx.lineTo(frontX, topY + cH * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  // Rear taillight LED strip (left edge, red)
  const rearEdgeX = R + cW * 0.005;
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rearEdgeX, botY - cH * 0.55);
  ctx.lineTo(rearEdgeX, botY - cH * 0.16);
  ctx.stroke();

  // Rear lower LED accent
  ctx.strokeStyle = "rgba(239,68,68,0.50)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rearEdgeX,               botY - cH * 0.16);
  ctx.lineTo(rearEdgeX + cW * 0.08,  botY - cH * 0.16);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Taillight glow
  const tlGrd = ctx.createRadialGradient(rearEdgeX, botY - cH * 0.36, 0, rearEdgeX, botY - cH * 0.36, cW * 0.15);
  tlGrd.addColorStop(0, "rgba(239,68,68,0.32)");
  tlGrd.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = tlGrd;
  ctx.beginPath();
  ctx.arc(rearEdgeX, botY - cH * 0.36, cW * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // ── Wheels ─────────────────────────────────────────────────────────────────
  for (const wx of [rearWX, frontWX]) {
    // Wheel arch shadow (clipped upper half ellipse)
    ctx.save();
    ctx.beginPath();
    ctx.arc(wx, wheelY, wR + 4, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.restore();

    // Tyre
    ctx.fillStyle = "#0a0e15";
    ctx.beginPath(); ctx.arc(wx, wheelY, wR, 0, Math.PI * 2); ctx.fill();

    // Tyre sidewall bead ring
    ctx.strokeStyle = "#1e2a3a";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(wx, wheelY, wR - 2, 0, Math.PI * 2); ctx.stroke();

    // Alloy rim (silver)
    const rimR = wR * 0.70;
    const rimGrd = ctx.createRadialGradient(wx - wR * 0.18, wheelY - wR * 0.18, 1, wx, wheelY, rimR);
    rimGrd.addColorStop(0,   "#e2e8f0");
    rimGrd.addColorStop(0.45, "#94a3b8");
    rimGrd.addColorStop(0.85, "#475569");
    rimGrd.addColorStop(1,   "#1e293b");
    ctx.fillStyle = rimGrd;
    ctx.beginPath(); ctx.arc(wx, wheelY, rimR, 0, Math.PI * 2); ctx.fill();

    // 10 spokes
    for (let s = 0; s < 10; s++) {
      const sa = wheelAngle + (s / 10) * Math.PI * 2;
      const cos = Math.cos(sa), sin = Math.sin(sa);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx + cos * rimR * 0.15, wheelY + sin * rimR * 0.15);
      ctx.lineTo(wx + cos * rimR * 0.90, wheelY + sin * rimR * 0.90);
      ctx.stroke();
    }

    // Brake caliper (red, peeking through spokes)
    ctx.save();
    ctx.beginPath(); ctx.arc(wx, wheelY, rimR + 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(wx - rimR * 0.30, wheelY - rimR * 0.55, rimR * 0.24, rimR * 0.44);
    ctx.restore();

    // Centre cap
    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.arc(wx, wheelY, wR * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath(); ctx.arc(wx, wheelY, wR * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  // ── Wheel arch trims (dark inset ring over body) ───────────────────────────
  for (const wx of [rearWX, frontWX]) {
    ctx.strokeStyle = "rgba(15,23,42,0.70)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wx, wheelY, wR + 4, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  // ── Speedometer ────────────────────────────────────────────────────────────
  drawSpeedometer(ctx, 50, h - 50, 43, velocity * 3.6);
}

function drawSpeedometer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  kmh: number,
) {
  const startA = Math.PI * 0.75;
  const endA   = Math.PI * 2.25;
  const frac   = Math.min(1, kmh / 220);
  const needle = startA + frac * (endA - startA);

  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.fill();

  // Track
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, r, startA, endA); ctx.stroke();

  // Colored arc
  const h = Math.round(210 - frac * 180);
  ctx.strokeStyle = `hsl(${h},85%,56%)`;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, r, startA, needle); ctx.stroke();

  // Needle
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * (r - 7), cy + Math.sin(needle) * (r - 7));
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = `bold ${Math.round(r * 0.32)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.round(kmh).toString(), cx, cy + r * 0.28);

  ctx.font = `${Math.round(r * 0.20)}px system-ui, sans-serif`;
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("km/h", cx, cy + r * 0.54);
}

// ─── Display state (updated ~10 Hz) ──────────────────────────────────────────
interface DisplayState {
  speedKmh: number;
  rpm: number;
  torqueNm: number;
  powerKw: number;
  etaPct: number;
  soc: number;
  distKm: number;
  kWh: number;
}

function toDisplay(p: PhysState): DisplayState {
  return {
    speedKmh: p.velocity * 3.6,
    rpm:      p.motorRpm,
    torqueNm: p.torque,
    powerKw:  p.elecPow / 1000,
    etaPct:   p.eta * 100,
    soc:      p.soc,
    distKm:   p.distM / 1000,
    kWh:      p.kWh,
  };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400">{label} RPM</p>
      <p className="text-white font-mono font-semibold">{payload[0].value.toFixed(1)} Nm</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MotorSimulation() {
  const carCanvasRef   = useRef<HTMLCanvasElement>(null);
  const motorCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);

  // Refs for physics (avoid closure staleness)
  const physRef      = useRef<PhysState>(makeInitState());
  const throttleRef  = useRef(0);
  const brakingRef   = useRef(false);
  const motorAngle   = useRef(0); // radians
  const roadOffset   = useRef(0); // pixels
  const wheelAngle   = useRef(0); // radians
  const frameCount   = useRef(0);
  const lastTime     = useRef<number | null>(null);

  // React state (updated at ~10Hz for metrics + chart)
  const [display, setDisplay] = useState<DisplayState>(toDisplay(makeInitState()));
  const [throttle, setThrottle]  = useState(0);  // for slider UI
  const [braking, setBraking]    = useState(false);
  const [running, setRunning]    = useState(false);

  const tick = useCallback((time: number) => {
    const dt = lastTime.current !== null ? Math.min((time - lastTime.current) / 1000, 0.033) : 0.016;
    lastTime.current = time;

    // Physics step
    const next = stepPhysics(physRef.current, throttleRef.current, brakingRef.current, dt);
    physRef.current = next;

    // Kinematics for animation
    const omegaMotor = (next.motorRpm / 60) * 2 * Math.PI; // rad/s
    motorAngle.current += omegaMotor * dt;
    const omegaWheel = next.velocity / WHEEL_RADIUS; // rad/s
    wheelAngle.current += omegaWheel * dt;
    roadOffset.current += next.velocity * 8 * dt; // px/s scaling

    // Draw motor canvas
    const mCvs = motorCanvasRef.current;
    if (mCvs) {
      const mCtx = mCvs.getContext("2d");
      if (mCtx) drawMotor(mCtx, mCvs.width, motorAngle.current, next.motorRpm);
    }

    // Draw car canvas
    const cCvs = carCanvasRef.current;
    if (cCvs) {
      const cCtx = cCvs.getContext("2d");
      if (cCtx) drawCar(cCtx, cCvs.width, cCvs.height, next.velocity, roadOffset.current, wheelAngle.current);
    }

    // Update React state every 6 frames (~10Hz)
    frameCount.current++;
    if (frameCount.current % 6 === 0) {
      setDisplay(toDisplay(next));
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Start / stop loop
  useEffect(() => {
    if (running) {
      lastTime.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, tick]);

  // Draw initial static frames
  useEffect(() => {
    const mCvs = motorCanvasRef.current;
    if (mCvs) {
      const mCtx = mCvs.getContext("2d");
      if (mCtx) drawMotor(mCtx, mCvs.width, 0, 0);
    }
    const cCvs = carCanvasRef.current;
    if (cCvs) {
      const cCtx = cCvs.getContext("2d");
      if (cCtx) drawCar(cCtx, cCvs.width, cCvs.height, 0, 0, 0);
    }
  }, []);

  const handleThrottle = (v: number) => {
    setThrottle(v);
    throttleRef.current = v / 100;
  };

  const handleBrake = (down: boolean) => {
    setBraking(down);
    brakingRef.current = down;
  };

  const handleReset = () => {
    physRef.current   = makeInitState();
    motorAngle.current = 0;
    roadOffset.current = 0;
    wheelAngle.current = 0;
    frameCount.current = 0;
    setDisplay(toDisplay(makeInitState()));
    setThrottle(0);
    throttleRef.current = 0;
    setBraking(false);
    brakingRef.current = false;
    setRunning(false);
  };

  // Find closest data point for the ReferenceDot
  const dotRpm = Math.round(display.rpm / 100) * 100;
  const dotTorque = Math.round(motorTorqueAtRpm(display.rpm) * display.torqueNm / Math.max(display.torqueNm, 1) * 10) / 10;
  const showDot = display.rpm > 50 && display.torqueNm > 0.5;

  const socColor = display.soc > 50 ? "#22c55e" : display.soc > 20 ? "#f59e0b" : "#ef4444";

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">EV Motor Simulation</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            4-pole PMSM &mdash; {(MOTOR_MAX_POWER / 1000).toFixed(0)} kW / {MOTOR_MAX_TORQUE} Nm &mdash; {BATTERY_KWH} kWh battery
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-400">
            <div>Dist: <span className="text-white font-mono">{display.distKm.toFixed(2)} km</span></div>
            <div>Used: <span className="text-white font-mono">{display.kWh.toFixed(3)} kWh</span></div>
          </div>
          <button
            onClick={() => setRunning((r) => !r)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              running
                ? "bg-amber-500 hover:bg-amber-400 text-black"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-[1fr_1.6fr_1fr] gap-4 p-4 min-h-0">
        {/* Left: Motor cross-section */}
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex flex-col items-center">
            <p className="text-xs font-semibold text-slate-400 mb-2 self-start">Motor Cross-Section</p>
            <canvas
              ref={motorCanvasRef}
              width={240}
              height={240}
              className="w-full max-w-[240px] aspect-square"
            />
          </div>

          {/* Phase legend */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-400 mb-2">3-Phase Winding</p>
            <div className="space-y-1.5">
              {[["Phase A", "#3b82f6"], ["Phase B", "#ef4444"], ["Phase C", "#22c55e"]].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-300">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pole pairs</span>
                <span className="text-slate-200 font-mono">2</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Base speed</span>
                <span className="text-slate-200 font-mono">{MOTOR_BASE_RPM} RPM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Gear ratio</span>
                <span className="text-slate-200 font-mono">{GEAR_RATIO}:1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Car + Controls */}
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <canvas
              ref={carCanvasRef}
              width={560}
              height={240}
              className="w-full"
              style={{ aspectRatio: "560/240" }}
            />
          </div>

          {/* Controls */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">Throttle</label>
                <span className="text-xs font-mono text-blue-400">{throttle}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={throttle}
                onChange={(e) => handleThrottle(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${throttle}%, #374151 ${throttle}%)`,
                }}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onPointerDown={() => handleBrake(true)}
                onPointerUp={() => handleBrake(false)}
                onPointerLeave={() => handleBrake(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold select-none transition-colors ${
                  braking
                    ? "bg-red-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {braking ? "Braking..." : "Hold to Brake"}
              </button>
              <button
                onClick={() => handleThrottle(0)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                Lift Off
              </button>
            </div>
          </div>

          {/* Battery bar */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Battery SOC</span>
              <span className="font-mono" style={{ color: socColor }}>{display.soc.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{ width: `${display.soc}%`, backgroundColor: socColor }}
              />
            </div>
          </div>
        </div>

        {/* Right: Torque-speed chart */}
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex-1">
            <p className="text-xs font-semibold text-slate-400 mb-3">
              Torque-Speed Envelope
              {showDot && (
                <span className="ml-2 text-red-400 font-mono">
                  {display.torqueNm.toFixed(0)} Nm @ {Math.round(display.rpm)} RPM
                </span>
              )}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={TORQUE_CURVE} margin={{ top: 6, right: 8, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="tqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2a78d6" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#2a78d6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4a" />
                <XAxis
                  dataKey="rpm"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                  label={{ value: "Speed (RPM)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 10 }}
                  domain={[0, MOTOR_MAX_RPM]}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  label={{ value: "Nm", angle: -90, position: "insideLeft", offset: 12, fill: "#64748b", fontSize: 10 }}
                  domain={[0, MOTOR_MAX_TORQUE + 20]}
                />
                <Tooltip content={<ChartTooltip />} />
                {/* Field-weakening boundary */}
                <ReferenceLine
                  x={MOTOR_BASE_RPM}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: "FW", position: "top", fill: "#f59e0b", fontSize: 9 }}
                />
                <Area
                  type="monotone"
                  dataKey="torque"
                  stroke="#2a78d6"
                  strokeWidth={2}
                  fill="url(#tqGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#2a78d6" }}
                />
                {showDot && (
                  <ReferenceDot
                    x={dotRpm}
                    y={display.torqueNm}
                    r={6}
                    fill="#e34948"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Motor operating metrics */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400">Operating Point</p>
            {[
              ["Motor speed", `${Math.round(display.rpm).toLocaleString()} RPM`],
              ["Applied torque", `${display.torqueNm.toFixed(1)} Nm`],
              ["Shaft power", `${(display.powerKw * (display.etaPct / 100)).toFixed(2)} kW`],
              ["Elec. input", `${display.powerKw.toFixed(2)} kW`],
              ["Efficiency", `${display.etaPct.toFixed(1)} %`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-slate-400">{k}</span>
                <span className="text-slate-200 font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom metrics strip */}
      <div className="shrink-0 border-t border-slate-700 px-4 py-3">
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Vehicle speed",  value: `${display.speedKmh.toFixed(1)} km/h` },
            { label: "Motor RPM",      value: `${Math.round(display.rpm).toLocaleString()}` },
            { label: "Torque",         value: `${display.torqueNm.toFixed(1)} Nm` },
            { label: "Electric power", value: `${display.powerKw.toFixed(2)} kW` },
            { label: "Motor efficiency", value: `${display.etaPct.toFixed(1)} %` },
            { label: "Battery",        value: `${display.soc.toFixed(1)} %` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
