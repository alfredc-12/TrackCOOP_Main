"use client";

import { motion } from "motion/react";

/**
 * FieldDivider — 3-layer animated SVG wave transition
 *
 * ViewBox: 0 0 1440 130
 * All three waves are filled shapes (y=0 → wave edge).
 * They stack with different depths & phases so all 3 colors are visible.
 *
 * Depth order (back → front):
 *   #c8e8a8  light green  — deepest droop (y 90–126), 2 cycles, peaks at x=0,720,1440
 *   #6dba7a  mid green    — medium droop  (y 66–100), 2 cycles, peaks at x=360,1080  (half-period offset)
 *   #1F6B43  dark green   — shallowest    (y 42–76),  3 cycles, wider peaks           (different rhythm)
 *
 * Each wave animates by swapping its peaks ↔ troughs over time.
 * The three have different durations so they drift in/out of phase naturally.
 */

// ── Light green (back) ──────────────────────────────────────────────────────
// 2 cycles · period=720px · peaks at x=0,720,1440 (y=90) · troughs at x=360,1080 (y=126)
const LA =
  "M0,0 L0,90 C90,90 270,126 360,126 C450,126 630,90 720,90 C810,90 990,126 1080,126 C1170,126 1350,90 1440,90 L1440,0 Z";
const LB =
  "M0,0 L0,126 C90,126 270,90 360,90 C450,90 630,126 720,126 C810,126 990,90 1080,90 C1170,90 1350,126 1440,126 L1440,0 Z";

// ── Medium green (middle) ───────────────────────────────────────────────────
// 2 cycles · period=720px · troughs at x=0,720,1440 (y=100) · peaks at x=360,1080 (y=66)
// Half-period offset from light wave → peaks and troughs never align
const MA =
  "M0,0 L0,100 C90,100 270,66 360,66 C450,66 630,100 720,100 C810,100 990,66 1080,66 C1170,66 1350,100 1440,100 L1440,0 Z";
const MB =
  "M0,0 L0,66 C90,66 270,100 360,100 C450,100 630,66 720,66 C810,66 990,100 1080,100 C1170,100 1350,66 1440,66 L1440,0 Z";

// ── Dark green (front) ──────────────────────────────────────────────────────
// 3 cycles · period=480px · peaks at x=0,480,960,1440 (y=42) · troughs at x=240,720,1200 (y=76)
// Different cycle count = different rhythm from the other two layers
const DA =
  "M0,0 L0,42 C60,42 180,76 240,76 C300,76 420,42 480,42 C540,42 660,76 720,76 C780,76 900,42 960,42 C1020,42 1140,76 1200,76 C1260,76 1380,42 1440,42 L1440,0 Z";
const DB =
  "M0,0 L0,76 C60,76 180,42 240,42 C300,42 420,76 480,76 C540,76 660,42 720,42 C780,42 900,76 960,76 C1020,76 1140,42 1200,42 C1260,42 1380,76 1440,76 L1440,0 Z";

export default function FieldDivider() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0 h-[130px] w-full sm:h-[150px] lg:h-[170px]"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 130"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Light green — back layer, deepest droop */}
        <motion.g
          animate={{ x: [0, -28, 0], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path fill="#c8e8a8" d={LA} />
          <path fill="#c8e8a8" d={LB} opacity="0.38" transform="translate(1440 0)" />
        </motion.g>

        {/* Medium green — middle layer */}
        <motion.g
          animate={{ x: [0, 34, 0], opacity: [0.95, 0.86, 0.95] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <path fill="#6dba7a" d={MA} />
          <path fill="#6dba7a" d={MB} opacity="0.32" transform="translate(-1440 0)" />
        </motion.g>

        {/* Dark green — front layer, shallowest, different cycle count */}
        <motion.g
          animate={{ x: [0, -18, 0], opacity: [1, 0.92, 1] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
        >
          <path fill="#1F6B43" d={DA} />
          <path fill="#1F6B43" d={DB} opacity="0.26" transform="translate(1440 0)" />
        </motion.g>
      </svg>
    </div>
  );
}
