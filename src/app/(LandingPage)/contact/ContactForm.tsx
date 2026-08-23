"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { createPublicRequest } from "@/features/communication/communication-api";
import type { RequestType } from "@/features/communication/communication-types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { Modal } from "@/components/ui/Modal";

const REQUEST_CATEGORIES: RequestType[] = [
  "General",
  "Membership",
  "Payment",
  "Share Capital",
  "Rental",
  "Product/POS",
  "Document",
];

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdRequestCode, setCreatedRequestCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "", // Store only the digits after +63
    requesterBarangay: "", // Store only the name/number after Brgy. 
    requestType: "General" as RequestType,
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    // Name
    if (!formData.requesterName.trim()) {
      newErrors.requesterName = "Name is required.";
    } else if (/\d/.test(formData.requesterName)) {
      newErrors.requesterName = "Name cannot contain numbers.";
    }
    
    // Email
    if (!formData.requesterEmail.trim()) {
      newErrors.requesterEmail = "Email address is required.";
    } else if (!formData.requesterEmail.toLowerCase().endsWith("@gmail.com")) {
      newErrors.requesterEmail = "Please enter a valid @gmail.com address.";
    }

    // Phone
    if (!formData.requesterPhone) {
      newErrors.requesterPhone = "Phone number is required.";
    } else if (!formData.requesterPhone.startsWith("9")) {
      newErrors.requesterPhone = "Must start with 9";
    } else if (formData.requesterPhone.replace(/\s+/g, "").length !== 10) {
      newErrors.requesterPhone = "Must be exactly 10 digits (e.g. 9000000000).";
    }
    
    // Barangay
    if (!formData.requesterBarangay.trim()) {
      newErrors.requesterBarangay = "Barangay is required.";
    }
    
    // Subject
    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required.";
    }

    // Message
    if (!formData.message.trim()) {
      newErrors.message = "Message is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    let { value } = e.target;
    
    if (name === "requesterName") {
      value = value.replace(/[0-9]/g, "");
    }
    
    if (name === "requesterPhone") {
      value = value.replace(/\D/g, "");
      if (value.length > 10) return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error("Please fix the errors in the form before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const req = await createPublicRequest({
        ...formData,
        requesterName: formData.requesterName || undefined,
        requesterEmail: formData.requesterEmail || undefined,
        requesterPhone: formData.requesterPhone ? `+63${formData.requesterPhone}` : undefined,
        requesterBarangay: formData.requesterBarangay ? `Brgy. ${formData.requesterBarangay.trim()}` : undefined,
        subject: formData.subject || undefined,
        consent: true,
      });

      setCreatedRequestCode(req.referenceCode);
      setIsSuccessModalOpen(true);
      
      setFormData({
        requesterName: "",
        requesterEmail: "",
        requesterPhone: "",
        requesterBarangay: "",
        requestType: "General",
        subject: "",
        message: "",
      });
      setErrors({});
    } catch (error) {
      toast.error("Failed to submit inquiry. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="relative pb-5">
          <div className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Full Name <span className="text-red-500">*</span></span>
            <Input
              name="requesterName"
              value={formData.requesterName}
              onChange={handleChange}
              placeholder="Juan Dela Cruz"
              disabled={isSubmitting}
              className={`h-11 bg-[#F7F8F3] ${errors.requesterName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.requesterName && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.requesterName}</p>}
        </div>
        
        <div className="relative pb-5">
          <div className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Email Address <span className="text-red-500">*</span></span>
            <Input
              type="email"
              name="requesterEmail"
              value={formData.requesterEmail}
              onChange={handleChange}
              placeholder="juan@gmail.com"
              disabled={isSubmitting}
              className={`h-11 bg-[#F7F8F3] ${errors.requesterEmail ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.requesterEmail && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.requesterEmail}</p>}
        </div>
        
        <div className="relative pb-5">
          <label className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Phone Number <span className="text-red-500">*</span></span>
            <div className={`flex h-11 items-center overflow-hidden rounded-md border bg-[#F7F8F3] transition focus-within:ring-4 focus-within:ring-[#82E6A7]/20 ${errors.requesterPhone ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20" : "border-[#CAD8CB] focus-within:border-[#1F6B43]"}`}>
              <span className="flex h-full items-center justify-center border-r border-[#CAD8CB] bg-[#EEF2EC] px-3.5 text-sm font-medium text-[#365F4A]">
                +63
              </span>
              <input
                type="tel"
                name="requesterPhone"
                value={formData.requesterPhone}
                onChange={handleChange}
                placeholder="9000000000"
                disabled={isSubmitting}
                className="h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-black/40 disabled:opacity-50"
              />
            </div>
          </label>
          {errors.requesterPhone && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.requesterPhone}</p>}
        </div>
        
        <div className="relative pb-5">
          <label className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Barangay <span className="text-red-500">*</span></span>
            <div className={`flex h-11 items-center overflow-hidden rounded-md border bg-[#F7F8F3] transition focus-within:ring-4 focus-within:ring-[#82E6A7]/20 ${errors.requesterBarangay ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20" : "border-[#CAD8CB] focus-within:border-[#1F6B43]"}`}>
              <span className="flex h-full items-center justify-center border-r border-[#CAD8CB] bg-[#EEF2EC] px-3.5 text-sm font-medium text-[#365F4A]">
                Brgy.
              </span>
              <input
                name="requesterBarangay"
                value={formData.requesterBarangay}
                onChange={handleChange}
                placeholder="1"
                disabled={isSubmitting}
                className="h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-black/40 disabled:opacity-50"
              />
            </div>
          </label>
          {errors.requesterBarangay && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.requesterBarangay}</p>}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="relative pb-5">
          <label className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Category <span className="text-red-500">*</span></span>
            <select
              name="requestType"
              value={formData.requestType}
              onChange={handleChange}
              disabled={isSubmitting}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            >
              {REQUEST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative pb-5">
          <div className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
            <span>Subject <span className="text-red-500">*</span></span>
            <Input
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="What is this regarding?"
              disabled={isSubmitting}
              className={`h-11 bg-[#F7F8F3] ${errors.subject ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.subject && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.subject}</p>}
        </div>
      </div>

      <div className="relative pb-5">
        <label className="grid gap-1.5 text-sm font-bold text-[#123D2A]">
          <span>Message <span className="text-red-500">*</span></span>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Type your inquiry here..."
            rows={4}
            disabled={isSubmitting}
            className={`w-full resize-none rounded-md border px-3 py-2.5 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20 disabled:opacity-50 ${errors.message ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-[#CAD8CB] bg-[#F7F8F3]"}`}
          />
        </label>
        {errors.message && <p className="absolute bottom-0 left-0 text-[11px] text-red-500">{errors.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-base sm:w-auto sm:place-self-end sm:px-8">
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Submitting...
          </span>
        ) : (
          "Submit Inquiry"
        )}
      </Button>

      <Modal
        title="Inquiry Submitted!"
        description="Your inquiry has been submitted successfully! Our administration team will review it and get back to you soon."
        trigger={<span className="hidden" />}
        open={isSuccessModalOpen}
        onOpenChange={(open) => {
          setIsSuccessModalOpen(open);
          if (!open) setCreatedRequestCode(null);
        }}
      >
        {createdRequestCode && (
          <div className="mt-4 rounded-lg bg-[#E3F7E7] p-4 text-center border border-[#82E6A7]">
            <p className="text-sm font-semibold text-[#1F6B43]">Your Tracking Code:</p>
            <p className="mt-1 text-2xl font-black text-[#123D2A] tracking-wider select-all">{createdRequestCode}</p>
            <p className="mt-2 text-xs text-[#294B39]">Please save this code. You can use it to check the status of your inquiry on our Track page.</p>
          </div>
        )}
        <div className="flex justify-end pt-4 gap-3">
          <Button type="button" variant="secondary" onClick={() => window.open(`/track?code=${createdRequestCode}`, '_blank')}>
            Track Request
          </Button>
          <Button type="button" onClick={() => setIsSuccessModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </form>
  );
}
