import { Check } from "lucide-react";

const steps = [
  { label: "Personal" },
  { label: "Family" },
  { label: "Membership" },
  { label: "Documents" },
  { label: "Review" },
];

export function ApplicationProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Application progress" className="application-stepper p-3 lg:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm lg:hidden">
        <span className="font-bold text-[#123D2A]">{steps[currentStep]?.label}</span>
        <span className="text-[#365F4A]">Step {currentStep + 1} of {steps.length}</span>
      </div>
      <ol className="grid grid-cols-5 gap-1 lg:grid-cols-1 lg:gap-2">
        {steps.map((step, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;

          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${index + 1}: ${step.label}${complete ? ", previous step" : ""}`}
              className={`flex min-w-0 items-center justify-center gap-3 rounded-md border-b-2 px-1 py-2 transition-colors lg:min-h-12 lg:justify-start lg:px-3 ${
                active ? "border-[#1F6B43] bg-[#EAF3E8] text-[#123D2A]" : "border-transparent text-[#365F4A]"
              }`}
            >
              <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${active || complete ? "bg-[#1F6B43] text-white" : "bg-[var(--public-canvas)] text-[#365F4A]"}`}>
                {complete ? <Check className="size-4" /> : index + 1}
              </span>
              <span className={`sr-only min-w-0 text-sm lg:not-sr-only ${active ? "font-bold" : "font-medium"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
