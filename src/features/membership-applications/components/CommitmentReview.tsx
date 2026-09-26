"use client";

import type { FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { MembershipApplicationFormValues } from "./MembershipApplicationForm";

type CommitmentReviewProps = {
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
};

const commitments = [
  {
    name: "orientationCommitmentAccepted",
    text: "I agree to attend and complete the required orientation or seminar.",
  },
  {
    name: "membershipFeeCommitmentAccepted",
    text: "I agree to pay the configured PHP 200 associate membership fee.",
  },
  {
    name: "shareSubscriptionCommitmentAccepted",
    text: "I agree to comply with the membership and share-subscription agreement.",
  },
  {
    name: "initialShareCapitalAcknowledged",
    text: "When pursuing True Member status, I acknowledge the configured PHP 1,500 initial share-capital amount.",
  },
  {
    name: "trueMemberRequirementAcknowledged",
    text: "I acknowledge the PHP 3,000 True Member requirement and the 12-month completion period.",
  },
  {
    name: "bylawsAgreementAccepted",
    text: "I agree to follow the Articles of Cooperation, Bylaws, membership agreement, rules, and lawful cooperative policies.",
  },
  {
    name: "patronageRefundAcknowledged",
    text: "I acknowledge the cooperative patronage-refund and share-capital provisions.",
  },
  {
    name: "privacyConsentAccepted",
    text: "I consent to the collection and processing of my information for membership review and cooperative records.",
  },
] as const;

export function CommitmentReview({ setValue, watch, errors }: CommitmentReviewProps) {
  const values = watch();
  const allAccepted = commitments.every((item) => values[item.name]);

  function setAllAccepted(accepted: boolean) {
    commitments.forEach((item) => {
      setValue(item.name, accepted, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#DDE8D8] bg-[#EAF3E8] p-4 text-sm leading-6 text-[#365F4A] shadow-sm">
        The cooperative caps validated share capital at PHP 15,000. Annual interest
        rate and required share count are not shown until officially configured.
      </div>

      <div className="rounded-2xl border border-[#DDE8D8] bg-white p-5 text-sm leading-6 text-[#123D2A] shadow-sm">
        <label className="flex cursor-pointer gap-3 rounded-xl border border-[#1F6B43]/40 bg-[#FFFAF2] px-4 py-3 font-semibold transition hover:border-[#1F6B43]">
          <input
            type="checkbox"
            checked={allAccepted}
            onChange={(event) => setAllAccepted(event.target.checked)}
            className="mt-1 size-4 accent-[#1F6B43]"
            aria-label="Agree to all membership commitments"
          />
          <span>
            I agree to all membership commitments, fees, cooperative policies, share-capital requirements, and privacy terms listed above.
            {Object.values(errors).some(Boolean) ? (
              <span className="mt-1 block text-xs font-normal text-red-700">
                Please accept all commitments before continuing.
              </span>
            ) : null}
          </span>
        </label>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 font-semibold marker:text-[#1F6B43]">
          {commitments.map((item) => <li key={item.name}>{item.text}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function ReviewSummary({ watch }: Pick<CommitmentReviewProps, "watch">) {
  const values = watch();
  const beneficiaries = values.beneficiaries.filter((item) => item.fullName?.trim());
  const fullName = [values.firstName, values.middleName, values.lastName, values.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#123D2A]">Applicant</h3>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <SummaryItem label="Name" value={fullName} />
          <SummaryItem label="Membership type" value={values.requestedMembershipType} />
          <SummaryItem label="Email" value={values.email || "Not provided"} />
          <SummaryItem label="Contact" value={values.contactNumber} />
          <SummaryItem label="Address" value={values.currentAddress} />
          <SummaryItem label="Barangay" value={values.barangay || "Not provided"} />
        </dl>
      </section>

      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#123D2A]">Beneficiaries</h3>
        {beneficiaries.length ? (
          <ul className="mt-3 space-y-2 text-sm text-[#365F4A]">
            {beneficiaries.map((beneficiary, index) => (
              <li key={`${beneficiary.fullName}-${index}`}>
                {beneficiary.fullName} - {beneficiary.relationship || "Beneficiary"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#365F4A]">No beneficiaries listed.</p>
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[#123D2A]">{label}</dt>
      <dd className="mt-1 text-[#365F4A]">{value || "Not provided"}</dd>
    </div>
  );
}
