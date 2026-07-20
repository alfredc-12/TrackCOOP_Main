import { Check } from "lucide-react";

const steps = ["Requester Info", "Rental Details", "Review & Submit"] as const;

export function RentalInquiryStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Rental inquiry progress" className="mb-8">
      <ol className="flex items-start">
        {steps.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const complete = step < currentStep;
          const active = step === currentStep;

          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center text-center ${
                index === 0 ? "items-start text-left" : index === steps.length - 1 ? "items-end text-right" : ""
              }`}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-[17px] h-0.5 w-full ${
                    step <= currentStep ? "bg-[#169447]" : "bg-[#d9e1dc]"
                  }`}
                />
              )}

              <span className="relative z-10 flex items-center gap-2 bg-[#f8f5eb] px-1 sm:px-2">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold transition-colors ${
                    complete
                      ? "bg-[#13a34a] text-white"
                      : active
                        ? "bg-[#08753a] text-white ring-4 ring-[#08753a]/10"
                        : "border-2 border-[#cfd9d2] bg-white text-[#829087]"
                  }`}
                >
                  {complete ? <Check className="size-5" strokeWidth={3} aria-hidden="true" /> : step}
                </span>
                <span
                  className={`hidden whitespace-nowrap text-sm font-semibold sm:block ${
                    active ? "text-[#10231a]" : complete ? "text-[#537062]" : "text-[#929d96]"
                  }`}
                >
                  {label}
                </span>
              </span>

              <span
                className={`mt-2 text-xs font-semibold sm:hidden ${active ? "text-[#123d2a]" : "text-[#829087]"}`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
