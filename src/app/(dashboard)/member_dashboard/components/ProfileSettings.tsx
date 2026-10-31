"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { User, KeyRound, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { expressFetch } from "@/lib/express-api";
import { LivelihoodFields } from "@/features/member-livelihoods/LivelihoodFields";
import { isValidPlantingDate, type MemberLivelihood } from "@/features/member-livelihoods/livelihoods";
import { OccupationCheckboxes } from "@/features/membership/OccupationCheckboxes";

type Profile = {
  contact_number: string;
  email: string;
  barangay: string;
  municipality: string;
  province: string;
  occupation: string;
  livelihoods: MemberLivelihood[];
};
type Password = { currentPassword: string; newPassword: string; confirmPassword: string };
type Notice = { text: string; type: "success" | "error" } | null;
const emptyProfile: Profile = { contact_number: "", email: "", barangay: "", municipality: "", province: "", occupation: "", livelihoods: [] };
const emptyPassword: Password = { currentPassword: "", newPassword: "", confirmPassword: "" };
const inputClass = "min-h-11 w-full rounded-xl border border-[#DDE8D8] bg-white px-3 text-sm text-[#173626] outline-none transition focus:border-[#2F7D57] focus:ring-2 focus:ring-[#2F7D57]/15 disabled:bg-gray-50";

export function ProfileSettings({ initialSection, onSaved }: { initialSection?: string; onSaved?: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Notice>(null);
  const [passwordMsg, setPasswordMsg] = useState<Notice>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [password, setPassword] = useState<Password>(emptyPassword);
  const [occupationError, setOccupationError] = useState("");
  const [livelihoodError, setLivelihoodError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof Password, string>>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Partial<Record<keyof Password, boolean>>>({});

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await expressFetch("/api/members/me/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We could not load your profile.");
      setProfile({ ...(Object.fromEntries(Object.keys(emptyProfile).filter((key) => key !== "livelihoods").map((key) => [key, data[key] ?? ""])) as Omit<Profile, "livelihoods">), livelihoods: Array.isArray(data.livelihoods) ? data.livelihoods : [] });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not load your profile.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (initialSection === "livelihoods" && !isLoading && !loadError) {
      const section = document.getElementById("my-livelihoods");
      section?.scrollIntoView({ block: "start" });
      section?.focus({ preventScroll: true });
    }
  }, [initialSection, isLoading, loadError]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileMsg(null);
    if (!profile.occupation.trim() || profile.occupation.trim().length > 190) {
      setOccupationError(!profile.occupation.trim() ? "Choose at least one occupation or enter another job." : "Keep all occupations within 190 characters.");
      return;
    }
    setOccupationError("");
    if (profile.livelihoods.length > 20 || new Set(profile.livelihoods.map((item) => item.activity.trim().toLowerCase())).size !== profile.livelihoods.length || profile.livelihoods.some((item) => !item.activity.trim() || item.activity.trim().length > 80 || (item.plantingDate && !isValidPlantingDate(item.plantingDate)))) {
      setLivelihoodError("Check your activity names and sowing dates. Dates cannot be in the future.");
      return;
    }
    setLivelihoodError("");
    setIsSavingProfile(true);
    try {
      const res = await expressFetch("/api/members/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We could not save your changes. Please try again.");
      setProfileMsg({ text: "Your profile changes have been saved.", type: "success" });
      onSaved?.();
    } catch (error) {
      setProfileMsg({ text: error instanceof Error ? error.message : "We could not save your changes. Please try again.", type: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMsg(null);
    if (password.newPassword !== password.confirmPassword) {
      setPasswordErrors({ confirmPassword: "The new passwords do not match." });
      return;
    }
    setPasswordErrors({});
    setIsSavingPassword(true);
    try {
      const res = await expressFetch("/api/members/me/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "Incorrect current password") {
          setPasswordErrors({ currentPassword: "Your current password is incorrect." });
          return;
        }
        throw new Error(data.error || "We could not change your password. Please try again.");
      }
      setPasswordMsg({ text: "Your password has been changed.", type: "success" });
      setPassword(emptyPassword);
      setVisiblePasswords({});
    } catch (error) {
      setPasswordMsg({ text: error instanceof Error ? error.message : "We could not change your password. Please try again.", type: "error" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <section aria-labelledby="my-profile-heading" className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F7D57]">My account</p>
        <h1 id="my-profile-heading" className="mt-1 text-2xl font-bold text-[#173626]">My Profile</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Keep your contact details and occupations up to date.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="personal-information-heading" className="min-w-0 rounded-2xl border border-[#DDE8D8] bg-white p-4 shadow-sm sm:p-5">
          <h2 id="personal-information-heading" className="mb-4 flex items-center gap-2 text-lg font-bold text-[#173626]"><User className="size-5 text-[#2F7D57]" aria-hidden="true" />Personal Information</h2>
          {isLoading ? <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#52705D]"><Loader2 className="size-5 animate-spin" />Loading your profile…</p> : loadError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{loadError}</p><button type="button" onClick={() => void loadProfile()} className="mt-2 min-h-11 rounded-lg px-2 font-bold underline">Try again</button></div> : (
            <form onSubmit={saveProfile}>
              <fieldset disabled={isSavingProfile} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([['contact_number', 'Contact Number', 'tel'], ['email', 'Email Address', 'email']] as const).map(([name, label, type]) => <ProfileField key={name} name={name} label={label} type={type} value={profile[name]} onChange={(value) => { setProfile({ ...profile, [name]: value }); setProfileMsg(null); }} />)}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([['barangay', 'Barangay'], ['municipality', 'Municipality'], ['province', 'Province']] as const).map(([name, label]) => <ProfileField key={name} name={name} label={label} value={profile[name]} onChange={(value) => { setProfile({ ...profile, [name]: value }); setProfileMsg(null); }} />)}
                </div>
                <div className="border-t border-[#EDF2EA] pt-4">
                  <OccupationCheckboxes compact value={profile.occupation} error={occupationError} onChange={(value) => { setProfile({ ...profile, occupation: value }); setOccupationError(""); setProfileMsg(null); }} />
                </div>
                <LivelihoodFields value={profile.livelihoods} occupation={profile.occupation} error={livelihoodError} onChange={(value) => { setProfile({ ...profile, livelihoods: value }); setLivelihoodError(""); setProfileMsg(null); }} />
                <button type="submit" aria-busy={isSavingProfile} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60">{isSavingProfile ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{isSavingProfile ? "Saving…" : "Save Changes"}</button>
              </fieldset>
              <Feedback notice={profileMsg} />
            </form>
          )}
        </section>
        <section aria-labelledby="password-heading" className="min-w-0 rounded-2xl border border-[#DDE8D8] bg-white p-4 shadow-sm sm:p-5">
          <h2 id="password-heading" className="flex items-center gap-2 text-lg font-bold text-[#173626]"><KeyRound className="size-5 text-[#2F7D57]" aria-hidden="true" />Security & Password</h2>
          <p id="password-guidance" className="mt-2 text-sm leading-5 text-[#6B7280]">Use at least 6 characters for your new password. Keep it private.</p>
          <form onSubmit={savePassword} className="mt-4">
            <fieldset disabled={isSavingPassword} className="space-y-4">
              {([['currentPassword', 'Current Password'], ['newPassword', 'New Password'], ['confirmPassword', 'Confirm New Password']] as const).map(([name, label]) => (
                <div key={name}>
                  <label htmlFor={name} className="mb-1 block text-sm font-semibold text-[#365F4A]">{label}</label>
                  <div className="relative">
                    <input id={name} name={name} type={visiblePasswords[name] ? "text" : "password"} required minLength={name === 'currentPassword' ? undefined : 6} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} value={password[name]} onChange={(event) => { setPassword({ ...password, [name]: event.target.value }); setPasswordErrors({}); setPasswordMsg(null); }} aria-invalid={Boolean(passwordErrors[name])} aria-describedby={passwordErrors[name] ? `${name}-error` : name === 'newPassword' ? 'password-guidance' : undefined} className={`${inputClass} pr-12`} />
                    <button type="button" aria-label={`${visiblePasswords[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={Boolean(visiblePasswords[name])} onClick={() => setVisiblePasswords({ ...visiblePasswords, [name]: !visiblePasswords[name] })} className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-xl text-[#52705D] hover:bg-[#EDF6EE]">{visiblePasswords[name] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                  </div>
                  {passwordErrors[name] && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-red-700">{passwordErrors[name]}</p>}
                </div>
              ))}
              <button type="submit" aria-busy={isSavingPassword} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#CAD8CB] bg-[#F4F8F0] px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EAF3E8] disabled:opacity-60">{isSavingPassword && <Loader2 className="size-4 animate-spin" />}{isSavingPassword ? "Updating…" : "Update Password"}</button>
            </fieldset>
            <Feedback notice={passwordMsg} />
          </form>
        </section>
      </div>
    </section>
  );
}

function ProfileField({ name, label, type = "text", value, onChange }: { name: string; label: string; type?: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={`profile-${name}`} className="mb-1 block text-sm font-semibold text-[#365F4A]">{label}</label><input id={`profile-${name}`} name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={name === 'contact_number' ? 40 : name === 'email' ? 190 : 120} className={inputClass} /></div>;
}

function Feedback({ notice }: { notice: Notice }) {
  return notice && <p role={notice.type === 'success' ? 'status' : 'alert'} className={`mt-3 rounded-xl border p-3 text-sm ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{notice.text}</p>;
}
