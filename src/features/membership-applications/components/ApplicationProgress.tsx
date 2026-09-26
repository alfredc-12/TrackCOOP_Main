import {
  Check,
  ClipboardCheck,
  FileText,
  Handshake,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const steps: { label: string; icon: LucideIcon }[] = [
  { label: "Personal", icon: UserRound },
  { label: "Family", icon: UsersRound },
  { label: "Membership", icon: Handshake },
  { label: "Documents", icon: FileText },
  { label: "Review", icon: ClipboardCheck },
];

export function ApplicationProgress({ currentStep }: { currentStep: number }) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0.08 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <nav aria-label="Application progress" className="w-full rounded-[1.5rem] border border-[#DDE8D8] bg-white p-3 shadow-sm">
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = index === currentStep;
          const complete = index < currentStep;

          return (
            <motion.li
              key={step.label}
              layout
              transition={transition}
              className="min-w-0"
            >
              <motion.div
                layout
                transition={transition}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}`}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 transition-all duration-300 ease-out ${
                  active
                    ? "border-[#123D2A] bg-[#123D2A] text-white shadow-[0_16px_36px_rgba(18,61,42,0.20)]"
                    : complete
                      ? "border-[#1F6B43] bg-[#EAF3E8] text-[#123D2A]"
                      : "border-[#E7EEE5] bg-[#FFFAF2] text-[#365F4A]"
                }`}
              >
                <motion.span
                  layout
                  transition={transition}
                  className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                    active || complete
                      ? active
                        ? "bg-white/16 text-white"
                        : "bg-[#1F6B43] text-white"
                      : "bg-white text-[#1F6B43]"
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {complete ? (
                      <motion.span
                        key="complete"
                        initial={{ opacity: 0, scale: 0.86 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.86 }}
                        transition={{ duration: prefersReducedMotion ? 0.05 : 0.14 }}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon"
                        initial={{ opacity: 0, scale: 0.86 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.86 }}
                        transition={{ duration: prefersReducedMotion ? 0.05 : 0.14 }}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
                <span className="min-w-0">
                  <span className={`block text-[0.62rem] font-black uppercase tracking-[0.16em] ${active ? "text-[#F6D46F]" : "text-[#6C7A70]"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-black">
                    {step.label}
                  </span>
                </span>
              </motion.div>
            </motion.li>
          );
        })}
      </ol>
    </nav>
  );
}
