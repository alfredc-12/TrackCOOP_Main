"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import QrScanner from "qr-scanner";
import { Camera, QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api-client";

type ScanResult = {
  id: string;
  memberName: string;
  eventTitle: string;
  eventDate: string;
};

type ChairmanAttendanceScannerProps = {
  eventId: string;
  eventTitle: string;
  onRecorded: () => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-coop-control border border-coop-border bg-coop-surface px-4 py-2 font-semibold text-coop-forest transition hover:bg-coop-subtle disabled:cursor-not-allowed disabled:opacity-50";

function getMemberCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed, window.location.origin);
    const queryCode = url.searchParams.get("memberQr") ?? url.searchParams.get("memberCode") ?? url.searchParams.get("member");
    if (queryCode?.trim()) return queryCode.trim();
  } catch {
    // Continue below so a raw member code is still accepted.
  }

  return /^NFFAC-[A-Za-z0-9-]{5,80}$/.test(trimmed) ? trimmed : "";
}

function cameraErrorMessage(reason: unknown) {
  if (reason instanceof DOMException && reason.name === "NotAllowedError") {
    return "Camera access was blocked. Allow camera access for localhost in the browser address bar, then try again.";
  }
  if (reason instanceof DOMException && reason.name === "NotFoundError") {
    return "No camera was found on this device. Use the manual member-code field below.";
  }
  if (reason instanceof DOMException && reason.name === "SecurityError") {
    return "Camera access requires HTTPS or localhost. Use the manual member-code field below.";
  }
  return reason instanceof Error ? reason.message : "Camera access is unavailable. Use the manual member-code field below.";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

export function ChairmanAttendanceScanner({ eventId, eventTitle, onRecorded, open: controlledOpen, onOpenChange }: ChairmanAttendanceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState("");
  const open = controlledOpen ?? internalOpen;

  useEffect(() => {
    QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";
  }, []);

  useEffect(() => () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }, []);

  function stopScanner() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }

  const close = useCallback((force = false) => {
    if (busy && !force) return;
    stopScanner();
    setInternalOpen(false);
    onOpenChange?.(false);
    setCameraState("idle");
    setError("");
    setManualValue("");
    setManualError("");
  }, [busy, onOpenChange]);

  const recordMember = useCallback(async (value: string) => {
    const memberCode = getMemberCode(value);
    if (!memberCode || busy) {
      if (!memberCode) setError("This is not a valid TrackCOOP member QR code.");
      return;
    }

    stopScanner();
    setBusy(true);
    setError("");
    setManualError("");

    try {
      const response = await apiRequest<ScanResult>(`/api/activities/${eventId}/attendance/scan`, {
        method: "POST",
        body: JSON.stringify({ memberCode }),
      });
      toast.success("Attendance recorded successfully.", {
        description: `${response.memberName} · ${response.eventTitle} · ${formatDate(response.eventDate)}`,
      });
      await onRecorded().catch(() => undefined);
      setBusy(false);
      close(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Attendance could not be recorded.";
      setBusy(false);
      setCameraState("error");
      setError(message);
      toast.error("Attendance was not recorded.", { description: message });
    }
  }, [busy, close, eventId, onRecorded]);

  const startScanner = useCallback(async () => {
    if (!open || busy || scannerRef.current || !videoRef.current) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setCameraState("error");
      setError("Camera access requires HTTPS or localhost. Use the manual member-code field below.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setError("This browser does not support camera scanning. Use the manual member-code field below.");
      return;
    }

    const video = videoRef.current;
    const scanner = new QrScanner(
      video,
      (result) => {
        const value = (typeof result === "string" ? result : result.data).trim();
        if (value && scannerRef.current === scanner) void recordMember(value);
      },
      {
        preferredCamera: /Android|iPhone|iPad/i.test(navigator.userAgent) ? "environment" : "user",
        calculateScanRegion: (currentVideo) => {
          const width = currentVideo.videoWidth;
          const height = currentVideo.videoHeight;
          if (!width || !height) return {};
          const downScaledWidth = 800;
          return {
            x: 0,
            y: 0,
            width,
            height,
            downScaledWidth,
            downScaledHeight: Math.max(1, Math.round((downScaledWidth * height) / width)),
          };
        },
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    );
    scannerRef.current = scanner;
    setCameraState("starting");
    setError("");

    try {
      await scanner.start();
      if (scannerRef.current === scanner) setCameraState("scanning");
    } catch (reason: unknown) {
      if (scannerRef.current !== scanner) return;
      stopScanner();
      setCameraState("error");
      setError(cameraErrorMessage(reason));
    }
  }, [busy, open, recordMember]);

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy) return;

    setCameraState("starting");
    setError("");
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true, alsoTryWithoutScanRegion: true });
      await recordMember(result.data);
    } catch {
      setCameraState("error");
      setError("No readable member QR code was found in that image. Try again with the full code visible.");
    }
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void startScanner(), 0);
    return () => window.clearTimeout(timer);
  }, [open, startScanner]);

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setInternalOpen(true);
          onOpenChange?.(true);
        } else {
          close();
        }
      }}
      trigger={controlledOpen === undefined ? <button type="button" className={secondary}><QrCode className="size-4" aria-hidden="true" />Scan member QR</button> : undefined}
      title="Scan member QR"
      description={`Scan the member's personal QR code to record attendance for ${eventTitle}.`}
      maxWidth="max-w-lg"
      mobileFullScreen
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-coop-border bg-[#102D20]">
          <div className="relative aspect-square w-full sm:aspect-video">
            <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Member QR scanner camera preview" />
            {cameraState === "starting" && <div className="absolute inset-0 flex items-center justify-center bg-[#102D20]/90 px-6 text-center text-sm text-white"><span className="inline-flex items-center gap-2"><Camera className="size-4" aria-hidden="true" />Starting camera...</span></div>}
            {(cameraState === "idle" || cameraState === "error") && <div className="absolute inset-0 flex items-center justify-center bg-[#102D20]/90 px-6 text-center text-sm text-white"><span className="inline-flex items-center gap-2"><ScanLine className="size-4" aria-hidden="true" />{cameraState === "error" ? "Camera unavailable" : "Ready to scan"}</span></div>}
          </div>
        </div>

        {cameraState === "scanning" && <p className="text-center text-sm text-coop-secondary">Point the camera at the member&apos;s QR code.</p>}
        {busy && <p role="status" className="rounded-coop-control border border-coop-border bg-coop-workspace p-3 text-sm text-coop-secondary">Saving attendance to the cooperative record...</p>}
        {error && <p role="alert" className="rounded-coop-control border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!busy && cameraState !== "scanning" && <Button type="button" onClick={() => void startScanner()} loading={cameraState === "starting"} loadingLabel="Starting camera...">{cameraState === "error" ? "Try camera again" : "Start camera"}</Button>}
        <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void scanImage(event)} />
        <Button type="button" variant="secondary" disabled={busy} onClick={() => imageInputRef.current?.click()}>Scan QR image</Button>

        <div className="border-t border-coop-border pt-4">
          <label htmlFor={`attendance-member-code-${eventId}`} className="block text-sm font-semibold text-coop-forest">Can&apos;t use the camera?</label>
          <p className="mt-1 text-sm text-coop-muted">Enter the member code shown below the member&apos;s QR code instead.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input id={`attendance-member-code-${eventId}`} type="text" value={manualValue} onChange={(event) => { setManualValue(event.target.value); setManualError(""); }} placeholder="NFFAC-2026-000001" className="min-h-11 min-w-0 flex-1 rounded-coop-control border border-coop-border bg-coop-surface px-3 text-sm text-coop-ink outline-none placeholder:text-coop-muted focus:border-coop-green focus:ring-2 focus:ring-coop-green/20" />
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { if (!getMemberCode(manualValue)) { setManualError("Enter a valid member code."); return; } void recordMember(manualValue); }}>Record attendance</Button>
          </div>
          {manualError && <p role="alert" className="mt-2 text-sm text-red-700">{manualError}</p>}
        </div>

      </div>
    </Modal>
  );
}
