"use client";

import { useState, useEffect } from "react";
import { User, Phone, MapPin, Mail, KeyRound, Save, Loader2, CheckCircle2 } from "lucide-react";

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  
  const [profileMsg, setProfileMsg] = useState({ text: "", type: "" });
  const [passwordMsg, setPasswordMsg] = useState({ text: "", type: "" });

  const [profile, setProfile] = useState({
    contact_number: "",
    email: "",
    barangay: "",
    municipality: "Nasugbu",
    province: "Batangas"
  });

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    // Fetch initial profile data from the dashboard endpoint which has member info
    setIsLoading(true);
    fetch("/api/members/me/dashboard")
      .then(res => res.json())
      .then(data => {
        if (data && data.member) {
          setProfile({
            contact_number: data.member.contact_number || "",
            email: data.member.email || "",
            barangay: data.member.barangay || "",
            municipality: data.member.municipality || "Nasugbu",
            province: data.member.province || "Batangas"
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword({ ...password, [e.target.name]: e.target.value });
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMsg({ text: "", type: "" });
    
    try {
      const res = await fetch("/api/members/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      
      setProfileMsg({ text: "Profile updated successfully!", type: "success" });
    } catch (err: any) {
      setProfileMsg({ text: err.message, type: "error" });
    } finally {
      setIsSavingProfile(false);
      setTimeout(() => setProfileMsg({ text: "", type: "" }), 5000);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      setPasswordMsg({ text: "New passwords do not match", type: "error" });
      return;
    }
    
    setIsSavingPassword(true);
    setPasswordMsg({ text: "", type: "" });
    
    try {
      const res = await fetch("/api/members/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      
      setPasswordMsg({ text: "Password changed successfully!", type: "success" });
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPasswordMsg({ text: err.message, type: "error" });
    } finally {
      setIsSavingPassword(false);
      setTimeout(() => setPasswordMsg({ text: "", type: "" }), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D57]" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Profile Info Section */}
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="rounded-full bg-[#e8f3ec] p-2 text-[#123D2A]">
              <User className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-[#173626]">Personal Information</h2>
          </div>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  name="contact_number"
                  value={profile.contact_number}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                />
              </div>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input 
                  type="email" 
                  name="email"
                  value={profile.email}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Barangay</label>
              <div className="relative mb-3">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  name="barangay"
                  value={profile.barangay}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b6b5a]">Municipality</label>
                  <input 
                    type="text" 
                    name="municipality"
                    value={profile.municipality}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b6b5a]">Province</label>
                  <input 
                    type="text" 
                    name="province"
                    value={profile.province}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isSavingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#123D2A] py-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-70"
              >
                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
              {profileMsg.text && (
                <div className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {profileMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {profileMsg.text}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Security Section */}
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm h-fit">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-[#173626]">Security & Password</h2>
          </div>
          
          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Current Password</label>
              <input 
                type="password" 
                name="currentPassword"
                required
                value={password.currentPassword}
                onChange={handlePasswordChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">New Password</label>
              <input 
                type="password" 
                name="newPassword"
                required
                minLength={6}
                value={password.newPassword}
                onChange={handlePasswordChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Confirm New Password</label>
              <input 
                type="password" 
                name="confirmPassword"
                required
                minLength={6}
                value={password.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isSavingPassword}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white py-3 text-sm font-bold text-[#173626] shadow-sm transition hover:bg-gray-50 disabled:opacity-70"
              >
                {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </button>
              {passwordMsg.text && (
                <div className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {passwordMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {passwordMsg.text}
                </div>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
