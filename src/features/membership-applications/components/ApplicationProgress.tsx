import {
  Check,
  ClipboardCheck,
  Handshake,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const steps: { label: string; icon: LucideIcon }[] = [
  { label: "Personal", icon: UserRound },
  { label: "Beneficiaries", icon: UsersRound },
  { label: "Commitments", icon: Handshake },
  { label: "Review", icon: ClipboardCheck },
];

export function ApplicationProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Application progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = index === currentStep;
          const complete = index < currentStep;

          return (
            <li
              key={step.label}
              className={`flex min-w-0 items-center ${
                index < steps.length - 1 ? "flex-1" : ""
              }`}
            >
              <div
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}`}
                className={`flex h-10 shrink-0 items-center overflow-hidden rounded-full border transition-all duration-500 ease-out sm:h-12 ${
                  active
                    ? "w-[132px] justify-start border-[#123D2A] bg-[#123D2A] px-2 text-white shadow-[0_16px_36px_rgba(18,61,42,0.22)] sm:w-[178px] sm:px-3"
                    : complete
                      ? "w-10 justify-center border-[#1F6B43] bg-[#1F6B43] text-white sm:w-12"
                      : "w-10 justify-center border-[#DDE8D8] bg-white text-[#365F4A] shadow-sm sm:w-12"
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-500 sm:size-8 ${
                    active || complete
                      ? "bg-white/16 text-white"
                      : "bg-[#EAF3E8] text-[#1F6B43]"
                  }`}
                >
                  {complete ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Icon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={`min-w-0 whitespace-nowrap text-xs font-black transition-all duration-500 ease-out sm:text-sm ${
                    active ? "ml-1.5 max-w-28 opacity-100 sm:ml-2" : "ml-0 max-w-0 opacity-0"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 ? (
                <div className="mx-1 h-1 min-w-2 flex-1 overflow-hidden rounded-full bg-[#DDE8D8] sm:mx-3 sm:min-w-5">
                  <div
                    className={`h-full rounded-full bg-[#1F6B43] transition-all duration-500 ease-out ${
                      currentStep > index ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
