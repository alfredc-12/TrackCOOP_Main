"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import type { InquiryDraft, RentalInquiry, RentalService, UserRole } from "../_types/rental";
import { adaptTrackCoopRole } from "../_lib/rentalPermissions";
import { rentalRepository, rentalRepositoryMode } from "../_lib/rentalRepository";

const DRAFT_KEY = "trackcoop-rental-inquiry-draft";
const RESULT_KEY = "trackcoop-rental-inquiry-result";
const ROLE_KEY = "trackcoop-rental-demo-role";

interface RentalContextValue {
  services: RentalService[];
  loading: boolean;
  error?: string;
  mode: "api" | "demo";
  role: UserRole;
  setRole: (role: UserRole) => void;
  refreshServices: () => Promise<void>;
  saveInquiryDraft: (draft: InquiryDraft) => void;
  getInquiryDraft: () => InquiryDraft | undefined;
  clearInquiryDraft: () => void;
  submitInquiry: (draft: InquiryDraft, member?: boolean) => Promise<RentalInquiry>;
  getLastInquiry: () => RentalInquiry | undefined;
}

const RentalContext = createContext<RentalContextValue | undefined>(undefined);

export function RentalProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<RentalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [role, setRoleState] = useState<UserRole>("Public");

  const refreshServices = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setServices(await rentalRepository.getRentalServices());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rental services could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshServices(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshServices]);

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((user) => {
        if (active) setRoleState(adaptTrackCoopRole(user?.role));
      })
      .catch(() => {
        if (active) setRoleState("Public");
      });

    return () => {
      active = false;
    };
  }, []);

  const setRole = useCallback((nextRole: UserRole) => {
    setRoleState(nextRole);
    window.sessionStorage.setItem(ROLE_KEY, nextRole);
  }, []);

  const value = useMemo<RentalContextValue>(() => ({
    services,
    loading,
    error,
    mode: rentalRepositoryMode,
    role,
    setRole,
    refreshServices,
    saveInquiryDraft: (draft) => window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)),
    getInquiryDraft: () => {
      const value = window.sessionStorage.getItem(DRAFT_KEY);
      return value ? JSON.parse(value) as InquiryDraft : undefined;
    },
    clearInquiryDraft: () => window.sessionStorage.removeItem(DRAFT_KEY),
    submitInquiry: async (draft, member = false) => {
      const result = member
        ? await rentalRepository.submitMemberRentalRequest(draft)
        : await rentalRepository.submitPublicRentalInquiry(draft);
      window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
      window.sessionStorage.removeItem(DRAFT_KEY);
      return result;
    },
    getLastInquiry: () => {
      const result = window.sessionStorage.getItem(RESULT_KEY);
      return result ? JSON.parse(result) as RentalInquiry : undefined;
    },
  }), [error, loading, refreshServices, role, services, setRole]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental() {
  const value = useContext(RentalContext);
  if (!value) throw new Error("useRental must be used within RentalProvider.");
  return value;
}
