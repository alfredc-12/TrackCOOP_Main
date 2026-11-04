"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createPublicRequest } from "@/features/communication/communication-api";
import type { RequestType, RequestPriority } from "@/features/communication/communication-types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";

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
    priority: "Normal" as RequestPriority,
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
        priority: "Normal",
        subject: "",
        message: "",
      });
      setErrors({});
    } catch {
      toast.error("Failed to submit inquiry. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:flex-1 lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Full Name <span className="text-red-500">*</span></span>
            <Input
              name="requesterName"
              aria-label="Full Name"
              value={formData.requesterName}
              onChange={handleChange}
              placeholder="Juan Dela Cruz"
              disabled={isSubmitting}
              className={`h-11 w-full min-w-0 bg-coop-workspace text-base ${errors.requesterName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.requesterName && <p className="mt-1 text-sm text-red-600">{errors.requesterName}</p>}
        </div>
        
        <div className="min-w-0">
          <div className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Email Address <span className="text-red-500">*</span></span>
            <Input
              type="email"
              name="requesterEmail"
              aria-label="Email Address"
              value={formData.requesterEmail}
              onChange={handleChange}
              placeholder="juan@gmail.com"
              disabled={isSubmitting}
              className={`h-11 w-full min-w-0 bg-coop-workspace text-base ${errors.requesterEmail ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.requesterEmail && <p className="mt-1 text-sm text-red-600">{errors.requesterEmail}</p>}
        </div>
        
        <div className="min-w-0">
          <label className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Phone Number <span className="text-red-500">*</span></span>
            <div className={`flex h-11 items-center overflow-hidden rounded-md border bg-coop-workspace transition focus-within:ring-4 focus-within:ring-[#82E6A7]/20 ${errors.requesterPhone ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20" : "border-coop-border focus-within:border-coop-green"}`}>
              <span className="flex h-full items-center justify-center border-r border-coop-border bg-coop-subtle px-3.5 text-sm font-medium text-coop-secondary">
                +63
              </span>
              <input
                type="tel"
                name="requesterPhone"
                value={formData.requesterPhone}
                onChange={handleChange}
                placeholder="9000000000"
                disabled={isSubmitting}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-[#627468] disabled:opacity-50"
              />
            </div>
          </label>
          {errors.requesterPhone && <p className="mt-1 text-sm text-red-600">{errors.requesterPhone}</p>}
        </div>
        
        <div className="min-w-0">
          <label className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Barangay <span className="text-red-500">*</span></span>
            <div className={`flex h-11 items-center overflow-hidden rounded-md border bg-coop-workspace transition focus-within:ring-4 focus-within:ring-[#82E6A7]/20 ${errors.requesterBarangay ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20" : "border-coop-border focus-within:border-coop-green"}`}>
              <span className="flex h-full items-center justify-center border-r border-coop-border bg-coop-subtle px-3.5 text-sm font-medium text-coop-secondary">
                Brgy.
              </span>
              <input
                name="requesterBarangay"
                value={formData.requesterBarangay}
                onChange={handleChange}
                placeholder="1"
                disabled={isSubmitting}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-[#627468] disabled:opacity-50"
              />
            </div>
          </label>
          {errors.requesterBarangay && <p className="mt-1 text-sm text-red-600">{errors.requesterBarangay}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0"><label className="grid gap-1.5 text-sm font-bold text-coop-forest"><span>Priority</span><StyledSelect value={formData.priority} options={["Low", "Normal", "High", "Urgent"]} onChange={(value) => setFormData((current) => ({ ...current, priority: value as RequestPriority }))} disabled={isSubmitting} prefix="Priority" /></label><p className="mt-1 text-xs text-[#526B59]">Choose Urgent only when immediate attention is needed.</p></div>

        <div className="min-w-0">
          <label className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Category <span className="text-red-500">*</span></span>
            <StyledSelect
              value={formData.requestType}
              options={REQUEST_CATEGORIES}
              onChange={(value) => setFormData((current) => ({ ...current, requestType: value as RequestType }))}
              disabled={isSubmitting}
              prefix="Category"
            />
          </label>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <div className="grid gap-1.5 text-sm font-bold text-coop-forest">
            <span>Subject <span className="text-red-500">*</span></span>
            <Input
              name="subject"
              aria-label="Subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="What is this regarding?"
              disabled={isSubmitting}
              className={`h-11 w-full min-w-0 bg-coop-workspace text-base ${errors.subject ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
          </div>
          {errors.subject && <p className="mt-1 text-sm text-red-600">{errors.subject}</p>}
        </div>
      </div>

      <div className="min-w-0 lg:flex lg:flex-col">
        <label className="grid gap-1.5 text-sm font-bold text-coop-forest lg:flex-1 lg:grid-rows-[auto_minmax(0,1fr)]">
          <span>Message <span className="text-red-500">*</span></span>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Type your inquiry here..."
            rows={4}
            disabled={isSubmitting}
            className={`w-full resize-none rounded-md border px-3 py-2.5 text-base outline-none transition focus:border-coop-green focus:ring-4 focus:ring-[#82E6A7]/20 disabled:opacity-50 ${errors.message ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-coop-border bg-coop-workspace"}`}
          />
        </label>
        {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
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
          <div className="mt-4 rounded-lg bg-coop-success-bg p-4 text-center border border-coop-mint">
            <p className="text-sm font-semibold text-coop-green">Your Tracking Code:</p>
            <p className="mt-1 text-2xl font-black text-coop-forest tracking-wider select-all">{createdRequestCode}</p>
            <p className="mt-2 text-xs text-coop-body">Please save this code. You can use it to check the status of your inquiry on our Track page.</p>
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
