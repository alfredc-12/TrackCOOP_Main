"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import {
  CapitalProgressCard,
  type CapitalProgress,
} from "./MembershipProgress";
import { AgriculturalSectorFields } from "./MembershipSelectionFields";
export function ChairmanMembershipProgress({
  applicationId,
  sectors: initialSectors = [],
}: {
  applicationId: string;
  sectors?: string[];
}) {
  const [referral, setReferral] = useState<{
    referrerName: string;
    memberCode: string;
    status: string;
  } | null>(null);
  const [capital, setCapital] = useState<CapitalProgress | null>(null);
  const [sectors, setSectors] = useState(initialSectors);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<{
      capital: CapitalProgress | null;
      referral: {
        referrerName: string;
        memberCode: string;
        status: string;
      } | null;
    }>(`/api/membership-applications/${applicationId}/capital-progress`)
      .then((d) => {
        if (active) {
          setCapital(d.capital);
          setReferral(d.referral);
        }
      })
      .catch(() => {
        if (active) setError("Capital progress is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [applicationId]);
  return (
    <div className="space-y-4">
      {referral && (
        <details className="coop-panel p-4 text-sm">
          <summary className="cursor-pointer font-bold">
            Referral details
          </summary>
          <p className="mt-3">
            {referral.referrerName} · {referral.memberCode} · {referral.status}
          </p>
        </details>
      )}
      {capital && <CapitalProgressCard capital={capital} />}
      <details className="coop-panel p-4">
        <summary className="cursor-pointer font-bold">
          Agricultural sectors
        </summary>
        <div className="mt-4">
          <AgriculturalSectorFields value={sectors} onChange={setSectors} />
          <Button
            className="mt-4"
            loading={saving}
            disabled={!sectors.length}
            onClick={async () => {
              setSaving(true);
              try {
                await apiRequest(
                  `/api/membership-applications/${applicationId}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify({ sector: sectors[0], sectors }),
                  },
                );
                setError("");
              } catch {
                setError("Unable to save sectors.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save sectors
          </Button>
        </div>
      </details>
      {error && (
        <p role="alert" className="text-sm text-coop-danger">
          {error}
        </p>
      )}
    </div>
  );
}
