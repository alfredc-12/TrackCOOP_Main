const steps = [
  "Personal",
  "Beneficiaries",
  "Commitments",
  "Review",
] as const;

export function ApplicationProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Application progress" className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;
        return (
          <div
            key={step}
            className={`border px-4 py-3 text-sm font-semibold ${
              active
                ? "border-[#123D2A] bg-[#123D2A] text-white"
                : complete
                  ? "border-[#1F6B43] bg-[#EAF3E8] text-[#123D2A]"
                  : "border-[#DDE8D8] bg-white text-[#365F4A]"
            }`}
          >
            <span className="block text-xs uppercase tracking-[0.18em] opacity-75">
              Step {index + 1}
            </span>
            {step}
          </div>
        );
      })}
    </nav>
  );
}
