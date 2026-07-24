"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { MembershipDraft } from "./membership-api";

type DraftContextValue = {
  draft: MembershipDraft | null;
  files: File[];
  documentTypes: string[];
  setApplicationDraft: (
    draft: MembershipDraft,
    files: File[],
    documentTypes: string[],
  ) => void;
  clearDraft: () => void;
};

const STORAGE_KEY = "trackcoop-membership-application-draft";
const DraftContext = createContext<DraftContextValue | null>(null);

export function MembershipDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<MembershipDraft | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as MembershipDraft;
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [files, setFiles] = useState<File[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);

  const value = useMemo<DraftContextValue>(
    () => ({
      draft,
      files,
      documentTypes,
      setApplicationDraft(nextDraft, nextFiles, nextDocumentTypes) {
        setDraft(nextDraft);
        setFiles(nextFiles);
        setDocumentTypes(nextDocumentTypes);
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
      },
      clearDraft() {
        setDraft(null);
        setFiles([]);
        setDocumentTypes([]);
        window.sessionStorage.removeItem(STORAGE_KEY);
      },
    }),
    [documentTypes, draft, files],
  );

  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  );
}

export function useMembershipDraft() {
  const value = useContext(DraftContext);
  if (!value) {
    throw new Error(
      "useMembershipDraft must be used within MembershipDraftProvider",
    );
  }
  return value;
}
