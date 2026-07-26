"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/service";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMsg, setPasswordMsg] = useState({ text: "", type: "" });
  const [isSaving, setIsSaving] = useState(false);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword({ ...password, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      setPasswordMsg({ text: "New passwords do not match", type: "error" });
      return;
    }
    
    if (password.newPassword.length < 3) {
      setPasswordMsg({ text: "Password must be at least 3 characters long", type: "error" });
      return;
    }

    setIsSaving(true);
    setPasswordMsg({ text: "", type: "" });

    try {
      const res = await fetch("/api/members/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setPasswordMsg({ text: "Password changed successfully! Redirecting...", type: "success" });
      
      const user = await getAuthenticatedUser();
      
      setTimeout(() => {
        if (user?.role === "chairman") {
          router.replace("/portal/chairman/dashboard");
        } else if (user?.role === "bookkeeper") {
          router.replace("/portal/bookkeeper/dashboard");
        } else {
          router.replace("/portal/member/dashboard");
        }
        router.refresh();
      }, 1500);
      
    } catch (err: any) {
      setPasswordMsg({ text: err.message, type: "error" });
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F1E5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#173626]">Update Your Security</h1>
          <p className="mt-2 text-[#6B7280] text-sm">
            For your security, please change your password from the default one before accessing your dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">
              Current Password (Track_coop123)
            </label>
            <input
              required
              type="password"
              name="currentPassword"
              className="w-full rounded-xl border border-[#DDE8D8] bg-[#F8F6EF] px-4 py-3 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
              value={password.currentPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">
              New Password
            </label>
            <input
              required
              minLength={3}
              type="password"
              name="newPassword"
              className="w-full rounded-xl border border-[#DDE8D8] bg-[#F8F6EF] px-4 py-3 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
              value={password.newPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">
              Confirm New Password
            </label>
            <input
              required
              minLength={3}
              type="password"
              name="confirmPassword"
              className="w-full rounded-xl border border-[#DDE8D8] bg-[#F8F6EF] px-4 py-3 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
              value={password.confirmPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center rounded-xl bg-[#123D2A] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#1B4D37] disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password & Continue"}
            </button>
          </div>

          {passwordMsg.text && (
            <div
              className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${
                passwordMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {passwordMsg.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : null}
              {passwordMsg.text}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
