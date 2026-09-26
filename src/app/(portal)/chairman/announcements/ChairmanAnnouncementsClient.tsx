"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Edit, FileText, Filter, Globe, GripVertical, MapPin, Megaphone, Plus, Printer, Search, ShieldCheck, Sprout, Trash2, UploadCloud, Users, X } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState, FormDialog, ConfirmDialog, StatCard } from "@/components/portal/PortalPrimitives";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { resolveUploadUrl } from "@/lib/upload-url";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-gray-100 rounded-md"></div> });
import {
  BusyLabel,
  Field,
  fieldClass,
  errorFieldClass,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/records/components/RecordsUi";

const ANNOUNCEMENT_SECTORS = [
  "Rice",
  "Corn",
  "Fishery",
  "Livestock",
  "High-value crops (gulayan)",
] as const;

const AUDIENCE_OPTIONS = [
  "Public",
  "All Members",
  "Associate Members",
  "True Members",
  "Barangay",
  "Sector",
  "Selected Users",
] as const;

type AnnouncementPhotoDraft = {
  id: string;
  name: string;
  src: string;
  file?: File;
  path?: string;
};

type ComboOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectedMember = {
  userId: string;
  fullName: string;
};

function getAudienceBadge(type: string) {
  switch (type) {
    case "Public": return "bg-[#E3F7E7] text-[#1F6B43] border-[#1F6B43]/20";
    case "All Members": return "bg-[#E0F2FE] text-[#0369A1] border-[#0369A1]/20";
    case "Associate Members": return "bg-[#FFF4D7] text-[#8A6200] border-[#D8A011]/25";
    case "True Members": return "bg-[#EAF3E8] text-[#123D2A] border-[#1F6B43]/20";
    case "Barangay": return "bg-[#F7F8F3] text-[#365F4A] border-[#CAD8CB]";
    case "Sector": return "bg-[#E7F2E4] text-[#1F6B43] border-[#B6D7B9]";
    case "Selected Users": return "bg-[#FCE7F3] text-[#BE185D] border-[#BE185D]/20";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getAudienceLabel(type: string) {
  if (type === "Selected Users") return "Specific Member";
  return type;
}

function stripHtml(html: string) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date;
}

function startOfMonth() {
  const date = startOfToday();
  date.setDate(1);
  return date;
}

function getAnnouncementTime(announcement: any) {
  const date = new Date(announcement.createdAt ?? announcement.postedAt ?? announcement.updatedAt);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function getAnnouncementImages(announcement: any): string[] {
  if (Array.isArray(announcement.images) && announcement.images.length > 0) return announcement.images;
  return announcement.featuredImagePath ? [announcement.featuredImagePath] : [];
}

function toImageSrc(path: string) {
  return resolveUploadUrl(path);
}

function getFileName(path: string) {
  return path.split(/[\\/]/).pop() || "Announcement photo";
}

function revokePhotoDrafts(drafts: AnnouncementPhotoDraft[]) {
  drafts.forEach((draft) => {
    if (draft.file) URL.revokeObjectURL(draft.src);
  });
}

function makePhotoDraft(file: File): AnnouncementPhotoDraft {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${file.name}-${file.lastModified}-${Date.now()}`;

  return {
    id,
    name: file.name,
    src: URL.createObjectURL(file),
    file,
  };
}

function getExistingPhotoDrafts(announcement: any): AnnouncementPhotoDraft[] {
  return getAnnouncementImages(announcement).map((path, index) => ({
    id: `existing-${index}-${path}`,
    name: getFileName(path),
    src: toImageSrc(path),
    path,
  }));
}

function getExistingAudienceValues(announcement: any) {
  if (Array.isArray(announcement.audienceTargets) && announcement.audienceTargets.length > 0) {
    return announcement.audienceTargets
      .filter((target: any) => target?.targetType === announcement.audienceType)
      .map((target: any) => String(target.targetValue ?? "").trim())
      .filter(Boolean);
  }

  return typeof announcement.audienceValue === "string" && announcement.audienceValue.trim()
    ? announcement.audienceValue.split(",").map((value: string) => value.trim()).filter(Boolean)
    : [];
}

function ComboSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select option",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`group inline-flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43]/55 hover:bg-[#FBFCF8] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
          disabled={options.length === 0}
          aria-label={ariaLabel}
        >
          <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-[#365F4A] transition group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-[90] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-2 shadow-2xl shadow-[#123D2A]/14"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              disabled={option.disabled}
              onSelect={(event) => {
                event.preventDefault();
                if (!option.disabled) onChange(option.value);
              }}
              className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition ${
                option.value === value
                  ? "bg-[#EAF3E8] text-[#123D2A]"
                  : "text-[#365F4A] hover:bg-[#EAF3E8] hover:text-[#123D2A] focus:bg-[#EAF3E8] focus:text-[#123D2A]"
              } data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {option.value === value ? <span className="size-1.5 shrink-0 rounded-full bg-[#1F6B43]" aria-hidden="true" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MultiTargetPicker({
  options,
  selectedValues,
  onToggle,
  onRemove,
  emptyLabel,
  disabled,
}: {
  options: ComboOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onRemove: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const selectedOptions = selectedValues
    .map((value) => options.find((option) => option.value === value) ?? { value, label: value })
    .filter((option) => option.value);

  return (
    <div className="grid gap-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-2 py-1.5">
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option) => (
            <span key={option.value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#123D2A] shadow-sm">
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                onClick={() => onRemove(option.value)}
                className="grid size-4 shrink-0 place-items-center rounded-full text-[#6C7A70] transition hover:bg-[#EEF2EC] hover:text-[#9A392A]"
                aria-label={`Remove ${option.label}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))
        ) : (
          <span className="px-1 text-xs font-semibold text-[#6C7A70]">{emptyLabel}</span>
        )}
      </div>
      <div className="grid max-h-28 gap-1 overflow-y-auto pr-1 custom-scrollbar">
        {options.map((option) => {
          const selected = selectedValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled || option.disabled}
              onClick={() => onToggle(option.value)}
              className={`flex min-h-9 items-center justify-between gap-2 rounded-md border px-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "border-[#1F6B43] bg-[#EAF3E8] text-[#123D2A]"
                  : "border-[#CAD8CB] bg-white text-[#365F4A] hover:border-[#1F6B43]/50 hover:bg-[#FBFCF8]"
              }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {selected ? <Check className="size-3.5 shrink-0 text-[#1F6B43]" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChairmanAnnouncementsClient() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [audienceType, setAudienceType] = useState("Public");
  const [audienceValues, setAudienceValues] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [photoDrafts, setPhotoDrafts] = useState<AnnouncementPhotoDraft[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [isPhotoDropActive, setIsPhotoDropActive] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoDraftsRef = useRef<AnnouncementPhotoDraft[]>([]);

  const [ackListModalOpen, setAckListModalOpen] = useState(false);
  const [ackSearch, setAckSearch] = useState("");
  const [ackPage, setAckPage] = useState(1);
  const [ackList, setAckList] = useState<{ userId: string; fullName: string; acknowledgedAt: string }[]>([]);
  const [isFetchingAckList, setIsFetchingAckList] = useState(false);
  const [ackListError, setAckListError] = useState(false);
  const [ackAnnouncementId, setAckAnnouncementId] = useState<string | null>(null);
  
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [barangayOptions, setBarangayOptions] = useState<string[]>([]);
  const [isFetchingBarangays, setIsFetchingBarangays] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [isFetchingAnnouncements, setIsFetchingAnnouncements] = useState(true);
  const [announcementLoadError, setAnnouncementLoadError] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState("All");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [deletedModalOpen, setDeletedModalOpen] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState("");
  const [deletedPage, setDeletedPage] = useState(1);
  const [restoreDeletedModal, setRestoreDeletedModal] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [viewingAnnouncement, setViewingAnnouncement] = useState<any | null>(null);

  useEffect(() => {
    photoDraftsRef.current = photoDrafts;
  }, [photoDrafts]);

  useEffect(() => {
    return () => revokePhotoDrafts(photoDraftsRef.current);
  }, []);

  const fetchAnnouncements = () => {
    setIsFetchingAnnouncements(true);
    setAnnouncementLoadError(false);
    apiRequest<any[]>("/api/announcements")
      .then((data) => setAnnouncementsList(data || []))
      .catch((err) => {
        console.error(err);
        setAnnouncementLoadError(true);
        toast.error("Failed to load announcements.");
      })
      .finally(() => setIsFetchingAnnouncements(false));
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (audienceType === "Selected Users" && members.length === 0 && !isFetchingMembers) {
      setIsFetchingMembers(true);
      apiRequest<any[]>("/api/members?pageSize=100")
        .then((data) => setMembers(data || []))
        .catch(console.error)
        .finally(() => setIsFetchingMembers(false));
    }
  }, [audienceType, members.length, isFetchingMembers]);

  useEffect(() => {
    if (audienceType !== "Barangay" || barangayOptions.length > 0 || isFetchingBarangays) return;

    setIsFetchingBarangays(true);
    apiRequest<{ barangay: string; total: number }[]>("/api/members/distribution/barangay")
      .then((data) => {
        const options = [...new Set(
          (data || [])
            .map((item) => item.barangay?.trim())
            .filter((barangay): barangay is string => Boolean(barangay) && barangay !== "Unspecified")
        )].sort((a, b) => a.localeCompare(b));
        setBarangayOptions(options);
      })
      .catch((error) => {
        console.error("Failed to load barangays:", error);
        toast.error("Failed to load barangay options.");
      })
      .finally(() => setIsFetchingBarangays(false));
  }, [audienceType, barangayOptions.length, isFetchingBarangays]);

  const selectedMemberIds = new Set(selectedMembers.map((member) => String(member.userId)));
  const filteredMembers = members.filter((m) =>
    m.userId && !selectedMemberIds.has(String(m.userId)) && m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleAudienceValue = (value: string) => {
    if (!value) return;
    setAudienceValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
    setFormErrors(prev => ({ ...prev, audienceValue: "" }));
  };

  const removeAudienceValue = (value: string) => {
    setAudienceValues((current) => current.filter((item) => item !== value));
  };

  const addSelectedMember = (member: SelectedMember) => {
    setSelectedMembers((current) =>
      current.some((item) => String(item.userId) === String(member.userId)) ? current : [...current, member]
    );
    setMemberSearch("");
    setFormErrors(prev => ({ ...prev, audience: "" }));
  };

  const removeSelectedMember = (userId: string) => {
    setSelectedMembers((current) => current.filter((member) => String(member.userId) !== String(userId)));
  };

  const replacePhotoDrafts = (drafts: AnnouncementPhotoDraft[]) => {
    revokePhotoDrafts(photoDrafts);
    setPhotoDrafts(drafts);
    setActivePhotoIndex(drafts.length > 0 ? 0 : 0);
  };

  const addPhotoFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setFormErrors(prev => ({ ...prev, imageFile: "Please choose image files only." }));
      return;
    }

    const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setFormErrors(prev => ({ ...prev, imageFile: "Each image must be smaller than 5MB." }));
      return;
    }

    const newDrafts = files.map(makePhotoDraft);
    setFormErrors(prev => ({ ...prev, imageFile: "" }));
    setPhotoDrafts((current) => {
      if (current.length === 0) setActivePhotoIndex(0);
      return [...current, ...newDrafts];
    });
  };

  const removePhotoDraft = (id: string) => {
    setPhotoDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id);
      const removed = current.find((draft) => draft.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.src);
      setActivePhotoIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));
      return next;
    });
  };

  const movePhotoDraft = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setPhotoDrafts((current) => {
      if (fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setActivePhotoIndex(toIndex);
      return next;
    });
  };

  const showPreviousPhoto = () => {
    setActivePhotoIndex((index) => photoDrafts.length > 0 ? (index - 1 + photoDrafts.length) % photoDrafts.length : 0);
  };

  const showNextPhoto = () => {
    setActivePhotoIndex((index) => photoDrafts.length > 0 ? (index + 1) % photoDrafts.length : 0);
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setExcerpt("");
    setAudienceType("Public");
    setAudienceValues([]);
    setSelectedMembers([]);
    setMemberSearch("");
    setEditingId(null);
    replacePhotoDrafts([]);
    setFormErrors({});
  };

  const handleEdit = (ann: any) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setMessage(ann.message);
    setExcerpt(ann.excerpt || "");
    setAudienceType(ann.audienceType);
    setAudienceValues(["Barangay", "Sector"].includes(ann.audienceType) ? getExistingAudienceValues(ann) : []);
    setSelectedMembers([]);
    if (ann.audienceType === "Selected Users") {
      setMemberSearch("");
      setMembers([]);
    }
    replacePhotoDrafts(getExistingPhotoDrafts(ann));
    setFormErrors({});
    setModalOpen(true);
  };

  const openAckList = async (id: string) => {
    setAckListModalOpen(true);
    setIsFetchingAckList(true);
    setAckListError(false);
    setAckAnnouncementId(id);
    try {
      const data = await apiRequest<{ userId: string; fullName: string; acknowledgedAt: string }[]>(`/api/announcements/${id}/acknowledgments`);
      setAckList(data || []);
    } catch (error) {
      console.error("Failed to fetch acknowledgments:", error);
      setAckListError(true);
      toast.error("Failed to load acknowledgments.");
    } finally {
      setIsFetchingAckList(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleDelete = async () => {
    if (!deletingId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/announcements/${deletingId}/archive`, {
        method: "POST"
      });
      setDeletingId(null);
      fetchAnnouncements();
      toast.success("Announcement archived successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to archive announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: Record<string, string> = {};
    const plainMessage = stripHtml(message).trim();
    if (title.trim().length < 3) errors.title = "Title must be at least 3 characters long.";
    if (title.trim().length > 120) errors.title = "Title must not exceed 120 characters.";
    if (plainMessage.length < 10) errors.message = "Message must be at least 10 characters long.";
    if (plainMessage.length > 8000) errors.message = "Message must not exceed 8,000 characters.";
    if (excerpt.trim().length > 240) errors.excerpt = "Excerpt must not exceed 240 characters.";
    if (audienceType === "Selected Users" && selectedMembers.length === 0) {
      errors.audience = "Please select at least one member.";
    }
    if (audienceType === "Sector" && audienceValues.length === 0) {
      errors.audienceValue = "Please choose at least one sector.";
    }
    if (audienceType === "Sector" && audienceValues.some((value) => !ANNOUNCEMENT_SECTORS.includes(value as (typeof ANNOUNCEMENT_SECTORS)[number]))) {
      errors.audienceValue = "Please remove invalid sector selections.";
    }
    if (audienceType === "Barangay" && audienceValues.length === 0) {
      errors.audienceValue = "Please choose at least one barangay.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setFormErrors({});
    setModalOpen(false);
    setConfirmSubmitModalOpen(true);
  };

  const executeSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newPhotoDrafts = photoDrafts.filter((draft): draft is AnnouncementPhotoDraft & { file: File } => Boolean(draft.file));
      const uploadedImagePathsById = new Map<string, string>();
      if (newPhotoDrafts.length > 0) {
        const formData = new FormData();
        for (const draft of newPhotoDrafts) {
          formData.append("images", draft.file);
        }

        const uploadRes = await apiRequest<{ url: string; urls?: string[] }>("/api/announcements/upload-image", {
          method: "POST",
          body: formData,
        });
        const uploadedImagePaths = uploadRes.urls?.length ? uploadRes.urls : [uploadRes.url];
        newPhotoDrafts.forEach((draft, index) => {
          if (uploadedImagePaths[index]) uploadedImagePathsById.set(draft.id, uploadedImagePaths[index]);
        });
      }

      const orderedImagePaths = photoDrafts
        .map((draft) => draft.path ?? uploadedImagePathsById.get(draft.id))
        .filter((path): path is string => Boolean(path));

      const url = editingId ? `/api/announcements/${editingId}` : "/api/announcements";
      const method = editingId ? "PATCH" : "POST";
      const targetAudienceValues = ["Barangay", "Sector"].includes(audienceType) ? audienceValues : [];

      const payload: any = {
        title,
        message,
        excerpt: excerpt || null,
        audienceType,
        audienceValue: null,
        audienceTargets: targetAudienceValues,
        announcementStatus: "Published",
        ...(audienceType === "Selected Users" && selectedMembers.length > 0 ? {
          recipientUserIds: selectedMembers.map((member) => String(member.userId)),
          audienceValue: selectedMembers.length === 1
            ? `User: ${selectedMembers[0].fullName}`
            : `${selectedMembers.length} selected members`
        } : {})
      };

      if (editingId || orderedImagePaths.length > 0) {
        payload.images = orderedImagePaths;
        payload.featuredImagePath = orderedImagePaths[0] ?? null;
      }

      await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });

      setConfirmSubmitModalOpen(false);
      setModalOpen(false);
      resetForm();
      fetchAnnouncements();
      toast.success(editingId ? "Announcement successfully updated!" : "Announcement successfully published!");
      router.refresh();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to save announcement.";
      setFormErrors({ form: message || "Unable to save announcement. Please try again." });
      setConfirmSubmitModalOpen(false);
      setModalOpen(true);
      toast.error("Unable to save announcement. Please review the form and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRestore = (id: string) => {
    setRestoreDeletedModal(true);
    setDeletedModalOpen(false);
    setRestoringId(id);
  };

  const executeRestore = () => {
    if (!restoringId) return;
    setIsSubmitting(true);
    apiRequest(`/api/announcements/${restoringId}/publish`, { method: "POST" })
      .then(() => {
        toast.success("Announcement restored successfully.");
        fetchAnnouncements();
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to restore announcement.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setRestoringId(null);
        if (restoreDeletedModal) {
          setTimeout(() => setDeletedModalOpen(true), 50);
          setRestoreDeletedModal(false);
        }
      });
  };

  const activePhoto = photoDrafts[activePhotoIndex] ?? null;
  const audienceOptions: ComboOption[] = AUDIENCE_OPTIONS.map((option) => ({
    value: option,
    label: option === "Public" ? "Public (Everyone)" : getAudienceLabel(option),
  }));
  const audienceFilterOptions: ComboOption[] = [
    { value: "All", label: "All audiences" },
    ...AUDIENCE_OPTIONS.map((option) => ({ value: option, label: getAudienceLabel(option) })),
  ];
  const sectorOptions: ComboOption[] = ANNOUNCEMENT_SECTORS.map((sector) => ({ value: sector, label: sector }));
  const barangaySelectOptions: ComboOption[] = isFetchingBarangays
    ? [{ value: "", label: "Loading barangays...", disabled: true }]
    : barangayOptions.length > 0
      ? barangayOptions.map((barangay) => ({ value: barangay, label: barangay }))
      : [{ value: "", label: "No barangays found", disabled: true }];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        description="Publish, target, and archive cooperative announcements for members."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setDeletedSearch("");
                setDeletedPage(1);
                setDeletedModalOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              View Deleted
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Announcement
            </button>
          </div>
        }
      />

      <FormDialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
        title={
          <span className="inline-flex min-w-0 items-center gap-2 text-lg sm:text-xl">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#EAF3E8] text-[#1F6B43]">
              <Megaphone className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate">{editingId ? "Edit Announcement" : "Create New Announcement"}</span>
          </span>
        }
        contentClassName="w-[min(76rem,calc(100vw-2rem))] p-3 sm:p-4"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-3 grid gap-4 lg:h-[calc(100vh-8.5rem)] lg:max-h-[44rem] lg:grid-cols-[minmax(20rem,0.9fr)_minmax(25rem,1.1fr)] lg:overflow-hidden">
          {formErrors.form ? (
            <div role="alert" aria-live="assertive" className="lg:col-span-2 rounded-md border border-[#FFB4B4] bg-[#FFF1F1] px-3 py-2 text-sm font-semibold text-[#9A392A]">
              {formErrors.form}
            </div>
          ) : null}
          <section className="relative min-h-[25rem] min-w-0 overflow-hidden rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] lg:min-h-0">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addPhotoFiles(event.target.files ?? []);
                event.target.value = "";
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => photoInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") photoInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedPhotoId) return;
                setIsPhotoDropActive(true);
              }}
              onDragLeave={() => setIsPhotoDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsPhotoDropActive(false);
                if (draggedPhotoId) {
                  setDraggedPhotoId(null);
                  return;
                }
                addPhotoFiles(event.dataTransfer.files);
              }}
              className={`absolute inset-0 overflow-hidden outline-none transition focus:ring-2 focus:ring-inset focus:ring-[#1F6B43]/20 ${
                isPhotoDropActive ? "bg-[#EAF3E8]" : "bg-white"
              }`}
            >
              {activePhoto ? (
                <>
                  <img src={activePhoto.src} alt={activePhoto.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061B11]/76 via-[#123D2A]/8 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/88 px-3 py-1.5 text-xs font-black text-[#123D2A] shadow-sm">
                    {activePhotoIndex + 1} / {photoDrafts.length}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      photoInputRef.current?.click();
                    }}
                    className="absolute right-4 top-4 inline-flex h-9 items-center gap-2 rounded-full bg-white/88 px-3 text-xs font-black text-[#123D2A] shadow-sm transition hover:bg-white"
                  >
                    <UploadCloud className="size-4" aria-hidden="true" />
                    Add photos
                  </button>
                  {photoDrafts.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          showPreviousPhoto();
                        }}
                        className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-[#061B11]/55 text-white backdrop-blur transition hover:bg-[#123D2A]"
                        aria-label="View previous photo"
                      >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          showNextPhoto();
                        }}
                        className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-[#061B11]/55 text-white backdrop-blur transition hover:bg-[#123D2A]"
                        aria-label="View next photo"
                      >
                        <ChevronRight className="size-5" aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="absolute inset-4 grid place-items-center rounded-xl border border-dashed border-[#B8CAB9] p-6 text-center">
                  <div className="max-w-xs">
                    <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                      <UploadCloud className="size-7" aria-hidden="true" />
                    </div>
                    <p className="mt-5 text-base font-black text-[#123D2A]">Drop announcement photos here</p>
                    <p className="mt-1 text-sm leading-6 text-[#5D6D63]">or click to choose files from your computer.</p>
                    <p className="mt-3 inline-flex rounded-full bg-[#F7F8F3] px-3 py-1 text-xs font-black text-[#365F4A]">PNG, JPG, or WebP up to 5MB each</p>
                  </div>
                </div>
              )}

              {photoDrafts.length > 0 ? (
                <div
                  className="absolute inset-x-4 bottom-4 z-20 flex max-h-32 flex-row-reverse items-end gap-2 overflow-x-auto rounded-xl border border-white/20 bg-[#061B11]/42 p-2 shadow-[0_12px_34px_rgba(6,27,17,0.28)] backdrop-blur"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {photoDrafts.map((photo, index) => (
                    <div
                      key={photo.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => setActivePhotoIndex(index)}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" || event.key === " ") setActivePhotoIndex(index);
                      }}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", photo.id);
                        setDraggedPhotoId(photo.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const fromIndex = photoDrafts.findIndex((draft) => draft.id === draggedPhotoId);
                        movePhotoDraft(fromIndex, index);
                        setDraggedPhotoId(null);
                      }}
                      onDragEnd={(event) => {
                        event.stopPropagation();
                        setDraggedPhotoId(null);
                      }}
                      className={`group relative shrink-0 cursor-grab overflow-hidden rounded-md border bg-[#EEF2EC] shadow-sm outline-none transition active:cursor-grabbing ${
                        index === 0 ? "h-24 w-28 border-[#F4C542]" : "h-16 w-16 border-white/45"
                      } ${activePhotoIndex === index ? "ring-2 ring-[#F4C542]" : ""}`}
                      aria-label={`View photo ${index + 1}`}
                    >
                      <img src={photo.src} alt={photo.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#061B11]/66 px-1.5 py-1 text-[10px] font-black text-white">
                        <GripVertical className="size-3" aria-hidden="true" />
                        <span>{index === 0 ? "Cover" : index + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removePhotoDraft(photo.id);
                        }}
                        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-[#061B11]/70 text-white opacity-0 transition hover:bg-[#9A392A] group-hover:opacity-100"
                        aria-label={`Remove ${photo.name}`}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {formErrors.imageFile ? (
              <p className="absolute inset-x-4 bottom-4 z-30 rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#FF4D4F] shadow-sm">
                {formErrors.imageFile}
              </p>
            ) : null}
          </section>

          <section className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
            <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                <span className="grid size-8 place-items-center rounded-md bg-[#EAF3E8] text-[#1F6B43]">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                Content
              </div>
              <Field label="Title" required error={formErrors.title}>
                <input
                  type="text"
                  name="title"
                  className={formErrors.title ? errorFieldClass : fieldClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="e.g., General Assembly Schedule"
                  />
                <span className="text-right text-xs font-normal text-[#6C7A70]">{title.length}/120</span>
              </Field>

              <Field label="Message" required error={formErrors.message}>
                <div className="mb-4 rounded-md bg-white [&_.ql-container]:rounded-b-md [&_.ql-editor]:max-h-[190px] [&_.ql-editor]:min-h-[140px] [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:text-sm [&_.ql-editor]:font-sans [&_.ql-toolbar]:rounded-t-md">
                  <ReactQuill
                    theme="snow"
                    value={message}
                    onChange={setMessage}
                    placeholder="Enter the full announcement details here..."
                  />
                </div>
                <p className="text-right text-xs font-normal text-[#6C7A70]">{stripHtml(message).trim().length}/8,000 characters</p>
              </Field>

              <Field label="Short Excerpt" hint="A brief summary (optional)">
                <input
                  type="text"
                  name="excerpt"
                  className={fieldClass}
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                  maxLength={240}
                  placeholder="Summary of the announcement"
                />
                <span className="text-right text-xs font-normal text-[#6C7A70]">{excerpt.length}/240</span>
              </Field>
            </div>

            <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-[#FBFCF8] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                <span className="grid size-8 place-items-center rounded-md bg-[#EAF3E8] text-[#1F6B43]">
                  <Users className="size-4" aria-hidden="true" />
                </span>
                Audience
              </div>
              <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                <div className="grid content-start gap-2">
                  <Field label="Audience" required error={formErrors.audience}>
                    <ComboSelect
                      value={audienceType}
                      onChange={(value) => {
                        setAudienceType(value);
                        setAudienceValues([]);
                        setSelectedMembers([]);
                        setMemberSearch("");
                        setFormErrors(prev => ({ ...prev, audience: "", audienceValue: "" }));
                      }}
                      options={audienceOptions}
                      ariaLabel="Announcement audience"
                      className={formErrors.audience ? "!border-[#FF4D4F]" : ""}
                    />
                  </Field>
                  <p className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-[#5D6D63]">
                    Pick who should see this announcement.
                  </p>
                </div>

                <div className="relative min-h-[10.75rem] rounded-lg border border-[#CAD8CB] bg-white p-3">
                  {audienceType === "Sector" ? (
                    <div className="grid gap-2">
                      <p className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                        <Sprout className="size-4 text-[#1F6B43]" aria-hidden="true" />
                        Target Sector
                      </p>
                      <MultiTargetPicker
                        options={sectorOptions}
                        selectedValues={audienceValues}
                        onToggle={toggleAudienceValue}
                        onRemove={removeAudienceValue}
                        emptyLabel="No sectors selected"
                      />
                      {formErrors.audienceValue ? <p className="text-xs text-[#FF4D4F]">{formErrors.audienceValue}</p> : null}
                    </div>
                  ) : audienceType === "Barangay" ? (
                    <div className="grid gap-2">
                      <p className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                        <MapPin className="size-4 text-[#1F6B43]" aria-hidden="true" />
                        Target Barangay
                      </p>
                      <MultiTargetPicker
                        options={barangaySelectOptions}
                        selectedValues={audienceValues}
                        onToggle={toggleAudienceValue}
                        onRemove={removeAudienceValue}
                        emptyLabel={isFetchingBarangays ? "Loading barangays..." : "No barangays selected"}
                        disabled={isFetchingBarangays}
                      />
                      {formErrors.audienceValue ? <p className="text-xs text-[#FF4D4F]">{formErrors.audienceValue}</p> : null}
                    </div>
                  ) : audienceType === "Selected Users" ? (
                    <div className="grid gap-2">
                      <p className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                        <Users className="size-4 text-[#1F6B43]" aria-hidden="true" />
                        Specific Member
                      </p>
                      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-2 py-1.5">
                        {selectedMembers.length > 0 ? (
                          selectedMembers.map((member) => (
                            <span key={member.userId} className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#123D2A] shadow-sm">
                              <span className="truncate">{member.fullName}</span>
                              <button
                                type="button"
                                onClick={() => removeSelectedMember(String(member.userId))}
                                className="grid size-4 shrink-0 place-items-center rounded-full text-[#6C7A70] transition hover:bg-[#EEF2EC] hover:text-[#9A392A]"
                                aria-label={`Remove ${member.fullName}`}
                              >
                                <X className="size-3" aria-hidden="true" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="px-1 text-xs font-semibold text-[#6C7A70]">No members selected</span>
                        )}
                      </div>
                      <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
                          <input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search member name..."
                            className={`${formErrors.audience ? errorFieldClass : fieldClass} pl-10`}
                            role="combobox"
                            aria-expanded={Boolean(memberSearch)}
                            aria-label="Search member"
                          />
                          {memberSearch && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-1 shadow-xl shadow-[#123D2A]/12">
                              {isFetchingMembers ? (
                                <div className="p-3 text-sm text-[#6C7A70]">Loading members...</div>
                              ) : filteredMembers.length > 0 ? (
                                filteredMembers.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-[#123D2A] transition hover:bg-[#EAF3E8]"
                                    onClick={() => addSelectedMember({ userId: m.userId, fullName: m.fullName })}
                                  >
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-xs font-black text-[#1F6B43]">
                                      {String(m.fullName ?? "?").slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 truncate">{m.fullName}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-sm text-[#6C7A70]">No members found with linked accounts.</div>
                              )}
                            </div>
                          )}
                        </div>
                      {formErrors.audience ? <p className="text-xs text-[#FF4D4F]">{formErrors.audience}</p> : null}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-center">
                      <p className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                        <Globe className="size-4 text-[#1F6B43]" aria-hidden="true" />
                        Target
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#5D6D63]">
                        {audienceType === "Public"
                          ? "Visible to everyone who can access announcements."
                          : `Applies to ${getAudienceLabel(audienceType).toLowerCase()}.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto flex justify-end gap-3 border-t border-[#CAD8CB] pt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className={primaryButtonClass} disabled={isSubmitting}>
              {isSubmitting ? <BusyLabel label="Saving..." /> : (editingId ? "Update Announcement" : "Create Announcement")}
            </button>
          </div>
          </section>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={confirmSubmitModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmSubmitModalOpen(false);
            if (!isSubmitting) {
              setTimeout(() => setModalOpen(true), 50);
            }
          }
        }}
        title={editingId ? "Confirm Update" : "Confirm Publication"}
        description={`Are you sure you want to ${editingId ? "update" : "publish"} this announcement? Members will be able to see it immediately.`}
        confirmLabel={isSubmitting ? "Saving..." : "Yes, Proceed"}
        onConfirm={executeSubmit}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Archive Announcement?"
        description="This announcement will be moved to the archived list and hidden from active announcements."
        confirmLabel={isSubmitting ? "Archiving..." : "Archive Announcement"}
        variant="danger"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!restoringId}
        onOpenChange={(open) => {
          if (!open) {
            setRestoringId(null);
            if (restoreDeletedModal && !isSubmitting) {
              setTimeout(() => setDeletedModalOpen(true), 50);
              setRestoreDeletedModal(false);
            }
          }
        }}
        title="Confirm Restore"
        description="Are you sure you want to restore this announcement? It will be visible to members again."
        confirmLabel={isSubmitting ? "Restoring..." : "Restore Announcement"}
        onConfirm={executeRestore}
      />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Announcement summary">
        <StatCard
          label="Total Announcements"
          value={String(announcementsList.length)}
          icon={Megaphone}
          variant="compact"
        />
        <StatCard
          label="Public Announcements"
          value={String(announcementsList.filter((a) => a.audienceType === "Public").length)}
          icon={Globe}
          variant="compact"
        />
        <StatCard
          label="Total Acknowledgments"
          value={String(announcementsList.reduce((sum, a) => sum + (a.acknowledgmentCount || 0), 0))}
          icon={ShieldCheck}
          variant="compact"
        />
      </div>

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:p-4">
        <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
          <Filter className="size-4" aria-hidden="true" />
          Filters
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.4fr_0.9fr_0.9fr]">
          <label className="relative block min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title or details"
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white pl-10 pr-3 text-sm font-semibold text-[#123D2A] outline-none transition placeholder:font-normal placeholder:text-[#7D8C82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
            />
          </label>
          <ComboSelect
            value={audienceFilter}
            onChange={setAudienceFilter}
            options={audienceFilterOptions}
            ariaLabel="Audience filter"
          />
          <ComboSelect
            value={sortDirection}
            onChange={(value) => setSortDirection(value as "desc" | "asc")}
            options={[
              { value: "desc", label: "Newest first" },
              { value: "asc", label: "Oldest first" },
            ]}
            ariaLabel="Sort announcements"
          />
        </div>
      </section>

      {isFetchingAnnouncements ? (
        <div className="flex h-32 items-center justify-center">
          <BusyLabel label="Loading announcements..." />
        </div>
      ) : announcementLoadError ? (
        <div role="alert" aria-live="assertive" className="rounded-lg border border-[#FFB4B4] bg-[#FFF1F1] p-6 text-center text-[#9A392A]">
          <p className="font-bold">Unable to load announcements.</p>
          <button type="button" onClick={fetchAnnouncements} className="mt-3 rounded-md bg-[#123D2A] px-4 py-2 text-sm font-bold text-white">Retry</button>
        </div>
      ) : (
        (() => {
          const filteredAnnouncements = announcementsList.filter((ann) => {
            const details = `${ann.title ?? ""} ${ann.excerpt ?? ""} ${stripHtml(ann.message ?? "")}`.toLowerCase();
            const matchesSearch =
              searchTerm.trim().length === 0 ||
              details.includes(searchTerm.trim().toLowerCase());
            
            const isNotDeleted = ann.announcementStatus !== "Archived";

            if (audienceFilter === "All") return matchesSearch && isNotDeleted;
            return matchesSearch && isNotDeleted && ann.audienceType === audienceFilter;
          });
          const latestAnnouncement = [...filteredAnnouncements]
            .sort((a, b) => getAnnouncementTime(b).getTime() - getAnnouncementTime(a).getTime())[0];
          const sortedAnnouncements = filteredAnnouncements
            .filter((ann) => ann.id !== latestAnnouncement?.id)
            .sort((a, b) => {
              const delta = getAnnouncementTime(b).getTime() - getAnnouncementTime(a).getTime();
              return sortDirection === "desc" ? delta : -delta;
            });
          const today = startOfToday();
          const week = startOfWeek();
          const month = startOfMonth();
          const sections = [
            {
              key: "today",
              title: "Today",
              icon: Clock3,
              items: sortedAnnouncements.filter((ann) => getAnnouncementTime(ann) >= today),
            },
            {
              key: "week",
              title: "This Week",
              icon: CalendarDays,
              items: sortedAnnouncements.filter((ann) => {
                const date = getAnnouncementTime(ann);
                return date >= week && date < today;
              }),
            },
            {
              key: "month",
              title: "This Month",
              icon: CalendarDays,
              items: sortedAnnouncements.filter((ann) => {
                const date = getAnnouncementTime(ann);
                return date >= month && date < week;
              }),
            },
            {
              key: "earlier",
              title: "Earlier Announcements",
              icon: Sprout,
              items: sortedAnnouncements.filter((ann) => getAnnouncementTime(ann) < month),
            },
          ];

          const renderActions = (ann: any) => (
            <div className="flex items-center gap-1">
              {ann.announcementStatus !== "Archived" && (
                <>
                  <button onClick={() => handleEdit(ann)} className="grid size-9 place-items-center rounded-md text-[#6C7A70] transition hover:bg-[#EEF2EC] hover:text-[#123D2A]" aria-label={`Edit ${ann.title}`}>
                    <Edit className="size-4" />
                  </button>
                  <button onClick={() => confirmDelete(ann.id)} className="grid size-9 place-items-center rounded-md text-[#6C7A70] transition hover:bg-[#FFE6E0] hover:text-[#9A392A]" aria-label={`Archive ${ann.title}`}>
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
          );

          const renderCard = (ann: any, featured = false) => {
            const images = getAnnouncementImages(ann);
            const coverImage = images[0];
            const summary = stripHtml(ann.message ?? "");

            return (
              <article
                key={ann.id}
                className={`group grid min-w-0 overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition hover:border-[#1F6B43]/45 hover:shadow-[0_16px_34px_rgba(18,61,42,0.10)] ${featured ? "lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.1fr)]" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setViewingAnnouncement(ann)}
                  className={`relative block min-h-44 overflow-hidden bg-[#EEF2EC] text-left ${featured ? "lg:min-h-72" : ""}`}
                >
                  {coverImage ? (
                    <img src={toImageSrc(coverImage)} alt={ann.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[#E7F2E4] text-[#1F6B43]">
                      <Megaphone className="size-10" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061B11]/82 via-[#123D2A]/24 to-transparent" />
                  {images.length > 1 && (
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#123D2A] shadow-sm">
                      {images.length} photos
                    </span>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-full bg-[#F2C94C] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#123D2A]">
                    {formatDate(ann.createdAt)}
                  </span>
                </button>

                <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${getAudienceBadge(ann.audienceType)}`}>
                          {getAudienceLabel(ann.audienceType)}
                        </span>
                        {ann.audienceValue ? (
                          <span className="min-w-0 truncate rounded-full bg-[#F7F8F3] px-2.5 py-1 text-[11px] font-bold text-[#365F4A]">
                            {ann.audienceValue}
                          </span>
                        ) : null}
                      </div>
                      <h3 className={`${featured ? "text-2xl sm:text-3xl" : "text-lg"} line-clamp-2 font-black leading-tight text-[#123D2A]`}>
                        {ann.title}
                      </h3>
                    </div>
                    {renderActions(ann)}
                  </div>

                  <p className={`${featured ? "text-base leading-7" : "text-sm leading-6"} line-clamp-3 break-words text-[#294B39]`}>
                    {summary || ann.excerpt || "No announcement details provided."}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] pt-3">
                    <button
                      onClick={() => setViewingAnnouncement(ann)}
                      className="text-sm font-black text-[#1F6B43] underline-offset-4 transition hover:text-[#123D2A] hover:underline"
                    >
                      Read more
                    </button>
                    <button
                      onClick={() => openAckList(ann.id)}
                      disabled={!ann.acknowledgmentCount}
                      className={`inline-flex items-center gap-1.5 text-xs font-black transition ${ann.acknowledgmentCount ? "text-[#1F6B43] hover:text-[#123D2A] hover:underline" : "cursor-not-allowed text-[#7D8C82] opacity-75"}`}
                    >
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      {ann.acknowledgmentCount || 0} Acknowledgment{(ann.acknowledgmentCount || 0) !== 1 && "s"}
                    </button>
                  </div>
                </div>
              </article>
            );
          };

          if (filteredAnnouncements.length === 0) {
            return (
              <EmptyState
                icon={Megaphone}
                title="No announcements found"
                description="Adjust the search, audience filter, or create a new announcement."
              />
            );
          }

          return (
            <div className="grid gap-7">
              {latestAnnouncement ? (
                <section className="grid gap-3">
                  <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                    <Megaphone className="size-4 text-[#1F6B43]" aria-hidden="true" />
                    Latest Announcement
                  </div>
                  {renderCard(latestAnnouncement, true)}
                </section>
              ) : null}

              {sections.map(({ key, title, icon: Icon, items }) => (
                <section key={key} className="grid gap-3">
                  <div className="flex items-center justify-between gap-3 border-b border-[#CAD8CB] pb-2">
                    <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
                      <Icon className="size-4 text-[#1F6B43]" aria-hidden="true" />
                      {title}
                    </div>
                    <span className="text-xs font-bold text-[#6C7A70]">
                      {items.length} post{items.length !== 1 && "s"}
                    </span>
                  </div>
                  {items.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((ann) => renderCard(ann))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#B9CABD] bg-white/60 px-4 py-6 text-sm font-semibold text-[#6C7A70]">
                      No announcements in this group.
                    </div>
                  )}
                </section>
              ))}
            </div>
          );
        })()
      )}

      <FormDialog
        open={deletedModalOpen}
        onOpenChange={(open) => {
          setDeletedModalOpen(open);
          if (!open) {
            setDeletedSearch("");
            setDeletedPage(1);
          }
        }}
        title="Deleted Announcements"
        description="View archived announcements that have been removed."
      >
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
            <input
              type="search"
              value={deletedSearch}
              onChange={(e) => {
                setDeletedSearch(e.target.value);
                setDeletedPage(1);
              }}
              placeholder="Search deleted announcements..."
              className="w-full rounded-md border border-[#CAD8CB] py-2 pl-9 pr-4 text-sm text-[#123D2A] focus:border-[#1F6B43] focus:outline-none"
            />
          </div>

          <div className="grid gap-3">
            {(() => {
              const filteredDeleted = announcementsList.filter(ann => {
                const matchesSearch = ann.title.toLowerCase().includes(deletedSearch.toLowerCase()) ||
                                      ann.message.toLowerCase().includes(deletedSearch.toLowerCase());
                return ann.announcementStatus === "Archived" && matchesSearch;
              });
              
              const itemsPerPage = 5;
              const totalPages = Math.max(1, Math.ceil(filteredDeleted.length / itemsPerPage));
              const currentPage = Math.min(deletedPage, totalPages);
              const paginatedDeleted = filteredDeleted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              if (filteredDeleted.length === 0) {
                return <div className="py-8 text-center text-sm text-[#6C7A70]">No deleted announcements found.</div>;
              }

              return (
                <>
                  {paginatedDeleted.map(ann => (
                    <div key={ann.id} className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-left">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h4 className="font-bold text-[#123D2A] truncate">{ann.title}</h4>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#9A392A] shrink-0">Deleted</span>
                      </div>
                      <p className="text-xs text-[#6C7A70] mb-2">{formatDate(ann.createdAt)}</p>
                      <p className="text-sm text-[#294B39] line-clamp-2 break-all">{stripHtml(ann.message)}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => {
                            setRestoreDeletedModal(true);
                            setDeletedModalOpen(false);
                            setViewingAnnouncement(ann);
                          }}
                          className="text-xs font-bold text-[#1F6B43] hover:underline"
                        >
                          Read more
                        </button>
                        <button
                          onClick={() => confirmRestore(ann.id)}
                          className="text-xs font-bold text-[#F2C94C] hover:underline"
                          disabled={isSubmitting}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2 pt-2 border-t border-[#CAD8CB]">
                      <button onClick={() => setDeletedPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#EEF2EC] text-[#123D2A] font-bold text-xs">
                        &lt;&lt;
                      </button>
                      <button onClick={() => setDeletedPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#EEF2EC] text-[#123D2A] font-bold text-xs">
                        &lt;
                      </button>
                      <span className="text-xs font-semibold text-[#6C7A70] px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button onClick={() => setDeletedPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#EEF2EC] text-[#123D2A] font-bold text-xs">
                        &gt;
                      </button>
                      <button onClick={() => setDeletedPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#EEF2EC] text-[#123D2A] font-bold text-xs">
                        &gt;&gt;
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <div className="mt-6 flex justify-end border-t border-[#CAD8CB] pt-4">
          <button type="button" className={secondaryButtonClass} onClick={() => setDeletedModalOpen(false)}>
            Close
          </button>
        </div>
      </FormDialog>

      <FormDialog
        open={ackListModalOpen}
        onOpenChange={(open) => {
          setAckListModalOpen(open);
          if (!open) {
            setAckSearch("");
            setAckPage(1);
          }
        }}
        title="Acknowledgments"
        description="List of members who have acknowledged this announcement."
      >
        <div className="mt-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7A70]" />
            <input
              type="text"
              placeholder="Search member name..."
              value={ackSearch}
              onChange={(e) => {
                setAckSearch(e.target.value);
                setAckPage(1);
              }}
              className="w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] py-2 pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#82E6A7]/20"
            />
          </div>

          <div className="min-h-[200px] max-h-[50vh] overflow-y-auto">
            {isFetchingAckList ? (
              <div className="flex h-full items-center justify-center py-8">
                 <BusyLabel label="Loading..." />
              </div>
            ) : ackListError ? (
              <div role="alert" aria-live="assertive" className="py-8 text-center text-sm text-[#9A392A]">
                <p className="font-semibold">Unable to load acknowledgment records.</p>
                <button type="button" disabled={!ackAnnouncementId} onClick={() => ackAnnouncementId ? void openAckList(ackAnnouncementId) : undefined} className="mt-3 rounded-md bg-[#123D2A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Retry</button>
              </div>
            ) : (
              (() => {
                const filteredAcks = ackList.filter(ack => ack.fullName.toLowerCase().includes(ackSearch.toLowerCase()));
                const itemsPerPage = 10;
                const totalPages = Math.max(1, Math.ceil(filteredAcks.length / itemsPerPage));
                const currentPage = Math.min(ackPage, totalPages);
                const paginatedAcks = filteredAcks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                if (filteredAcks.length === 0) {
                  return <div className="py-8 text-center text-sm text-[#6C7A70]">No members found matching your search.</div>;
                }

                return (
                  <>
                    <ul className="divide-y divide-[#CAD8CB]">
                      {paginatedAcks.map((ack, idx) => (
                        <li key={`${ack.userId}-${idx}`} className="flex items-center justify-between py-3">
                          <span className="font-semibold text-[#123D2A]">{ack.fullName}</span>
                          <span className="text-xs text-[#6C7A70]">
                            {formatDate(ack.acknowledgedAt, true)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-2 pt-2 border-t border-[#CAD8CB]">
                        <button onClick={() => setAckPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#F7F8F3] text-[#123D2A] font-bold text-xs">
                          &lt;&lt;
                        </button>
                        <button onClick={() => setAckPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#F7F8F3] text-[#123D2A] font-bold text-xs">
                          &lt;
                        </button>
                        <span className="text-xs font-semibold text-[#6C7A70] px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => setAckPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#F7F8F3] text-[#123D2A] font-bold text-xs">
                          &gt;
                        </button>
                        <button onClick={() => setAckPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-[#CAD8CB] disabled:opacity-50 hover:bg-[#F7F8F3] text-[#123D2A] font-bold text-xs">
                          &gt;&gt;
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-between border-t border-[#CAD8CB] pt-4">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 py-2 text-sm font-semibold text-[#123D2A] transition hover:bg-[#F7F8F3] hover:text-[#1F6B43]"
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              
              const html = `
                <html>
                  <head>
                    <title>Acknowledgment List</title>
                    <style>
                      body { font-family: sans-serif; padding: 20px; color: #123D2A; }
                      h1 { font-size: 1.5rem; margin-bottom: 5px; }
                      p { color: #6C7A70; margin-bottom: 20px; }
                      table { width: 100%; border-collapse: collapse; }
                      th, td { border: 1px solid #CAD8CB; padding: 10px; text-align: left; }
                      th { background-color: #F7F8F3; }
                      @media print {
                        button { display: none; }
                      }
                    </style>
                  </head>
                  <body>
                    <h1>Acknowledgments Report</h1>
                    <p>Total Acknowledgments: ${ackList.length}</p>
                    <table>
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Date Acknowledged</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${ackList.map(ack => `
                          <tr>
                            <td>${ack.fullName}</td>
                            <td>${formatDate(ack.acknowledgedAt, true)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                    <script>
                      window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                      };
                    </script>
                  </body>
                </html>
              `;
              printWindow.document.write(html);
              printWindow.document.close();
            }}
          >
            <Printer className="size-4" />
            Print Report
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => setAckListModalOpen(false)}>
            Close
          </button>
        </div>
      </FormDialog>

      <FormDialog
        open={!!viewingAnnouncement}
        onOpenChange={(open) => {
          if (!open) {
            setViewingAnnouncement(null);
            if (restoreDeletedModal) {
              setTimeout(() => setDeletedModalOpen(true), 50);
              setRestoreDeletedModal(false);
            }
          }
        }}
        title="View Announcement"
        description="Full details of the announcement."
      >
        {viewingAnnouncement && (
          <div className="mt-4 grid min-w-0 max-w-full gap-5 overflow-x-hidden">
            {(() => {
              const images = Array.isArray(viewingAnnouncement.images) && viewingAnnouncement.images.length > 0
                ? viewingAnnouncement.images
                : viewingAnnouncement.featuredImagePath
                  ? [viewingAnnouncement.featuredImagePath]
                  : [];

              if (images.length === 0) return null;

              return (
                <div className="grid min-w-0 max-w-full gap-2 overflow-hidden sm:grid-cols-2">
                  {images.map((image: string, index: number) => (
                    <div key={`${image}-${index}`} className="relative min-w-0 h-48 w-full max-w-full overflow-hidden rounded-md border border-[#CAD8CB] bg-[#F7F8F3]">
                      <img src={toImageSrc(image)} alt={viewingAnnouncement.title} className="absolute inset-0 block h-full w-full max-w-full object-cover" />
                    </div>
                  ))}
                </div>
              );
            })()}
            
            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-[#123D2A]">{viewingAnnouncement.title}</h2>
                <span className="inline-flex items-center rounded-full bg-[#E3F7E7] px-2.5 py-0.5 text-xs font-bold text-[#1F6B43]">
                  {viewingAnnouncement.audienceType}
                </span>
              </div>
              <p className="text-xs font-medium text-[#6C7A70]">
                Published {formatDate(viewingAnnouncement.createdAt)}
              </p>
            </div>

            <div className="min-w-0 max-w-full break-words whitespace-pre-wrap text-sm text-[#294B39] quill-content" dangerouslySetInnerHTML={{ __html: viewingAnnouncement.message }} />

            {viewingAnnouncement.audienceValue && (
              <div className="rounded-md bg-[#F7F8F3] px-3 py-2 text-sm text-[#294B39] border border-[#CAD8CB]">
                <span className="font-semibold">Targeted to:</span> {viewingAnnouncement.audienceValue}
              </div>
            )}

            <div className="flex justify-end border-t border-[#CAD8CB] pt-4">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setViewingAnnouncement(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
