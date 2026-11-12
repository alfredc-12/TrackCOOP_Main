"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type MemberAttendanceQrProps = {
  memberCode: string;
  memberName?: string;
};

const actionButton = "group flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-[#F1F7EF] focus-visible:outline-2 focus-visible:outline-[#2F7D57] disabled:cursor-not-allowed disabled:opacity-50";

export function MemberAttendanceQr({ memberCode, memberName }: MemberAttendanceQrProps) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!memberCode) return;

    void QRCode.toDataURL(memberCode, {
      width: 320,
      margin: 2,
      color: { dark: "#123D2A", light: "#FFFFFF" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [memberCode]);

  async function copyCode() {
    if (!memberCode) return;
    try {
      await navigator.clipboard.writeText(memberCode);
      setCopied(true);
      toast.success("Member code copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Member code could not be copied.");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={(
        <button type="button" className={actionButton} disabled={!memberCode}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF6EE] text-[#2F7D57]"><QrCode className="size-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#173626]">Show my attendance QR</span><span className="block text-xs text-[#6B7280]">Let the Chairman scan your code</span></span>
        </button>
      )}
      title="My attendance QR"
      description="Show this personal code to the Chairman when your attendance is recorded."
      maxWidth="max-w-md"
      mobileFullScreen
    >
      <div className="space-y-4 text-center">
        <div className="rounded-2xl border border-coop-border bg-coop-workspace p-4">
          {qrDataUrl ? (
            // QR data is generated at runtime, so Next Image cannot optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`Attendance QR code for ${memberName || "member"}`} className="mx-auto size-64 max-w-full rounded-coop-control border border-coop-border bg-white p-3" />
          ) : <p role="status" className="p-16 text-sm text-coop-muted">Preparing your QR code...</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coop-green">Member code</p>
          <p className="mt-1 break-all text-xl font-black tracking-wide text-coop-forest">{memberCode || "Loading..."}</p>
          {memberName && <p className="mt-1 text-sm text-coop-muted">{memberName}</p>}
        </div>
        <p className="rounded-coop-control border border-coop-border bg-coop-workspace p-3 text-left text-sm leading-6 text-coop-secondary">The Chairman scans this QR from the event attendance workspace. The system checks that your member profile is approved and prevents duplicate attendance.</p>
        <Button type="button" variant="secondary" onClick={() => void copyCode()} disabled={!memberCode}>{copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "Copied" : "Copy member code"}</Button>
      </div>
    </Modal>
  );
}
