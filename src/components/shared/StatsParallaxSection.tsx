"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  CalendarCheck,
  LucideIcon,
  Sprout,
  UsersRound,
  Waves,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { PublicLandingStats } from "@/features/landing-public/types";

// ─── Data ────────────────────────────────────────────────────────────────────
const statDefinitions: {
  key: keyof PublicLandingStats;
  suffix: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "activeFarmerMembers", suffix: "", label: "Active Farmer Members", icon: UsersRound },
  { key: "farmCommunitiesReached", suffix: "", label: "Farm Communities Reached", icon: Sprout },
  { key: "fisheryMembers", suffix: "", label: "Fishery Members", icon: Waves },
  { key: "annualPrograms", suffix: "", label: "Programs This Year", icon: CalendarCheck },
];

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({
  target,
  suffix,
  isActive,
}: {
  target: number;
  suffix: string;
  isActive: boolean;
}) {
  const ref   = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  // Drive the count-up once the section is in view
  useEffect(() => {
    if (!isActive) return;
    const controls = animate(count, target, {
      duration: reducedMotion ? 0 : 2.4,
      ease: [0.16, 1, 0.3, 1], // expo-out — fast start, slow finish
    });
    return controls.stop;
  }, [isActive, count, target, reducedMotion]);

  // Write directly to the DOM span to avoid re-renders on every frame
  useEffect(() => {
    return count.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent =
          `${Math.round(v).toLocaleString("en")}${suffix}`;
      }
    });
  }, [count, suffix]);

  return (
    <span ref={ref} aria-label={`${target.toLocaleString("en")}${suffix}`}>
      {`0${suffix}`}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatItem({
  stat,
  index,
  isActive,
}: {
  stat: (typeof statDefinitions)[number] & { value: number | null };
  index: number;
  isActive: boolean;
}) {
  const Icon = stat.icon;
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={isActive ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : index * 0.12, ease: "easeOut" }}
      className="public-stat flex flex-col items-center gap-4 text-center"
    >
      {/* Glass icon ring */}
      <div className="public-stat-icon grid size-16 place-items-center rounded-full border border-white/25 bg-white/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-md">
        <Icon className="size-7 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
      </div>

      {/* Animated number */}
      <p className="public-stat-value font-black leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] [font-size:clamp(2.8rem,5vw,4.5rem)]" aria-live="polite">
        {stat.value === null ? (
          <span aria-label="Statistic unavailable">—</span>
        ) : (
          <AnimatedNumber target={stat.value} suffix={stat.suffix} isActive={isActive} />
        )}
      </p>

      {/* Label */}
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
        {stat.label}
      </p>
    </motion.div>
  );
}

// ─── Dividers between stats ───────────────────────────────────────────────────
function Divider() {
  return (
    <div className="hidden h-20 w-px bg-white/15 lg:block" aria-hidden="true" />
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function StatsParallaxSection({ stats }: { stats: PublicLandingStats | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView   = useInView(sectionRef, { once: true, amount: 0.25 });
  const reducedMotion = useReducedMotion();

  return (
    <section
      ref={sectionRef}
      aria-label="Cooperative statistics"
      className={[
        "relative min-h-[480px]",
        // Parallax: bg-fixed keeps the image stationary on scroll (desktop).
        // iOS doesn't support bg-fixed; it gracefully falls back to bg-scroll.
        "bg-fixed bg-center bg-cover bg-no-repeat",
      ].join(" ")}
      style={{ backgroundImage: "url('/images/stats/underlay.jpg')" }}
    >
      {/* Dark tinted overlay — keeps text legible over the image */}
      <div className="absolute inset-0 z-0 bg-[#052F22]/62" />

      {/* Subtle texture grain for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[480px] max-w-7xl flex-col items-center justify-center gap-16 px-6 py-20 sm:px-8">
        {/* Section title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.45em] text-[#F2C94C] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            Numbers
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="flex w-full flex-col items-center gap-12 sm:grid sm:grid-cols-2 sm:gap-16 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-0">
          {statDefinitions.map((definition, i) => (
            <div key={definition.key} className="flex items-center gap-0 lg:flex-1 lg:justify-center">
              <StatItem
                stat={{ ...definition, value: stats?.[definition.key] ?? null }}
                index={i}
                isActive={isInView}
              />
              {i < statDefinitions.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
