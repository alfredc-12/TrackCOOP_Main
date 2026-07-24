"use client";

import type { FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import type { MembershipApplicationFormValues } from "./MembershipApplicationForm";

type CommitmentReviewProps = {
  register: UseFormRegister<MembershipApplicationFormValues>;
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

export function CommitmentReview({ register, errors }: CommitmentReviewProps) {
  return (
    <div className="space-y-4">
      <div className="border border-[#DDE8D8] bg-[#EAF3E8] p-4 text-sm leading-6 text-[#365F4A]">
        The cooperative caps validated share capital at PHP 15,000. Annual interest
        rate and required share count are not shown until officially configured.
      </div>

      {commitments.map((item) => (
        <label
          key={item.name}
          className="flex gap-3 border border-[#DDE8D8] bg-white p-4 text-sm font-semibold leading-6 text-[#123D2A]"
        >
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#1F6B43]"
            {...register(item.name)}
          />
          <span>
            {item.text}
            {errors[item.name] ? (
              <span className="mt-1 block text-xs text-red-700">
                {errors[item.name]?.message}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ReviewSummary({ watch }: Pick<CommitmentReviewProps, "watch">) {
  const values = watch();
  const beneficiaries = values.beneficiaries.filter((item) => item.fullName?.trim());

  return (
    <div className="grid gap-5">
      <section className="border border-[#DDE8D8] bg-white p-5">
        <h3 className="text-lg font-bold text-[#123D2A]">Applicant</h3>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <SummaryItem label="Name" value={values.fullName} />
          <SummaryItem label="Membership type" value={values.requestedMembershipType} />
          <SummaryItem label="Email" value={values.email || "Not provided"} />
          <SummaryItem label="Contact" value={values.contactNumber} />
          <SummaryItem label="Address" value={values.currentAddress} />
          <SummaryItem label="Barangay" value={values.barangay || "Not provided"} />
        </dl>
      </section>

      <section className="border border-[#DDE8D8] bg-white p-5">
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
