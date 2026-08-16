"use client";

import { Megaphone, Edit, Trash2, ShieldCheck, Plus, Search, Globe, Image as ImageIcon, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Users, X, Printer } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState, FormDialog, ConfirmDialog, StatCard } from "@/components/portal/PortalPrimitives";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { env } from "@/config/env";
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

function getAudienceBadge(type: string) {
  switch (type) {
    case "Public": return "bg-[#E3F7E7] text-[#1F6B43] border-[#1F6B43]/20";
    case "All Members": return "bg-[#E0F2FE] text-[#0369A1] border-[#0369A1]/20";
    case "Selected Users": return "bg-[#FCE7F3] text-[#BE185D] border-[#BE185D]/20";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function stripHtml(html: string) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function ChairmanAnnouncementsClient() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [audienceType, setAudienceType] = useState("Public");
  const [selectedMember, setSelectedMember] = useState<{ userId: string; fullName: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [ackListModalOpen, setAckListModalOpen] = useState(false);
  const [ackSearch, setAckSearch] = useState("");
  const [ackPage, setAckPage] = useState(1);
  const [ackList, setAckList] = useState<{ userId: string; fullName: string; acknowledgedAt: string }[]>([]);
  const [isFetchingAckList, setIsFetchingAckList] = useState(false);
  
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [isFetchingAnnouncements, setIsFetchingAnnouncements] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [deletedModalOpen, setDeletedModalOpen] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState("");
  const [deletedPage, setDeletedPage] = useState(1);
  const [restoreDeletedModal, setRestoreDeletedModal] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [viewingAnnouncement, setViewingAnnouncement] = useState<any | null>(null);

  const fetchAnnouncements = () => {
    setIsFetchingAnnouncements(true);
    apiRequest<any[]>("/api/announcements")
      .then((data) => setAnnouncementsList(data || []))
      .catch((err) => {
        console.error(err);
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

  const filteredMembers = members.filter((m) =>
    m.userId && m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setExcerpt("");
    setAudienceType("Public");
    setSelectedMember(null);
    setMemberSearch("");
    setEditingId(null);
    setImageFile(null);
    setFormErrors({});
  };

  const handleEdit = (ann: any) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setMessage(ann.message);
    setExcerpt(ann.excerpt || "");
    setAudienceType(ann.audienceType);
    if (ann.audienceType === "Selected Users") {
      setMemberSearch("");
      setMembers([]);
      setSelectedMember({ userId: ann.audienceValue, fullName: `User ID: ${ann.audienceValue}` });
    } else {
      setSelectedMember(null);
    }
    setImageFile(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const openAckList = async (id: string) => {
    setAckListModalOpen(true);
    setIsFetchingAckList(true);
    try {
      const data = await apiRequest<{ userId: string; fullName: string; acknowledgedAt: string }[]>(`/api/announcements/${id}/acknowledgments`);
      setAckList(data || []);
    } catch (error) {
      console.error("Failed to fetch acknowledgments:", error);
      toast.error("Failed to load acknowledgments.");
    } finally {
      setIsFetchingAckList(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/announcements/${deletingId}/archive`, {
        method: "POST"
      });
      setDeletingId(null);
      fetchAnnouncements();
      toast.success("Announcement successfully deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: Record<string, string> = {};
    if (title.trim().length < 3) errors.title = "Title must be at least 3 characters long.";
    if (message.trim().length < 10) errors.message = "Message must be at least 10 characters long.";
    if (audienceType === "Selected Users" && !selectedMember) {
      errors.audience = "Please select a member.";
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
    setIsSubmitting(true);
    try {
      let uploadedImagePath: string | null = null;
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);

        const uploadRes = await apiRequest<{ url: string }>("/api/announcements/upload-image", {
          method: "POST",
          body: formData,
        });
        uploadedImagePath = uploadRes.url;
      }

      const url = editingId ? `/api/announcements/${editingId}` : "/api/announcements";
      const method = editingId ? "PATCH" : "POST";

      const payload: any = {
        title,
        message,
        excerpt: excerpt || null,
        audienceType,
        announcementStatus: "Published",
        ...(audienceType === "Selected Users" && selectedMember ? {
          recipientUserIds: [String(selectedMember.userId)],
          audienceValue: `User: ${selectedMember.fullName}`
        } : {})
      };

      if (uploadedImagePath) {
        payload.featuredImagePath = uploadedImagePath;
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
      toast.error("Failed to save announcement. Check console for details.");
    } finally {
      setIsSubmitting(false);
      setConfirmSubmitModalOpen(false);
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
              New Notification
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
        title={editingId ? "Edit Notification" : "Create New Notification"}
        description="Fill out the details below to broadcast a message to the members."
      >
        <form onSubmit={handleSubmit} noValidate className="grid gap-5">
          <Field label="Title" required error={formErrors.title}>
            <input
              type="text"
              name="title"
              className={formErrors.title ? errorFieldClass : fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., General Assembly Schedule"
            />
          </Field>

          <Field label="Message" required error={formErrors.message}>
            <div className="bg-white rounded-md mb-10 [&_.ql-editor]:min-h-[160px] [&_.ql-editor]:text-sm [&_.ql-editor]:font-sans [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md">
              <ReactQuill
                theme="snow"
                value={message}
                onChange={setMessage}
                placeholder="Enter the full announcement details here..."
              />
            </div>
          </Field>

          <Field label="Short Excerpt" hint="A brief summary (optional)">
            <input
              type="text"
              name="excerpt"
              className={fieldClass}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Summary of the announcement"
            />
          </Field>

          <Field label="Featured Image" hint="Max 5MB (optional)" error={formErrors.imageFile}>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 5 * 1024 * 1024) {
                    setFormErrors(prev => ({ ...prev, imageFile: "The image must be smaller than 5MB." }));
                    e.target.value = "";
                    setImageFile(null);
                    return;
                  }
                  setFormErrors(prev => ({ ...prev, imageFile: "" }));
                  setImageFile(file || null);
                }}
                className="block w-full text-sm text-[#6C7A70] file:mr-4 file:rounded-md file:border-0 file:bg-[#EEF2EC] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[#123D2A] hover:file:bg-[#e4e9e1] cursor-pointer"
              />
            </div>
          </Field>

          <Field label="Audience" required>
            <select
              className={fieldClass}
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
            >
              <option value="Public">Public (Everyone)</option>
              <option value="All Members">All Members</option>
              <option value="Selected Users">Specific Member</option>
            </select>
          </Field>

          {audienceType === "Selected Users" && (
            <Field label="Select Member" required error={formErrors.audience}>
              {!selectedMember ? (
                <div className="relative">
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search member name..."
                    className={formErrors.audience ? errorFieldClass : fieldClass}
                  />
                  {memberSearch && (
                    <div className="absolute top-full z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-[#CAD8CB] bg-white shadow-lg">
                      {isFetchingMembers ? (
                        <div className="p-3 text-sm text-[#6C7A70]">Loading members...</div>
                      ) : filteredMembers.length > 0 ? (
                        filteredMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[#EEF2EC]"
                            onClick={() => {
                              setSelectedMember({ userId: m.userId, fullName: m.fullName });
                              setMemberSearch("");
                              setFormErrors(prev => ({ ...prev, audience: "" }));
                            }}
                          >
                            {m.fullName}
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-[#6C7A70]">No members found (with linked accounts)</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 py-2.5 text-sm text-[#17211C]">
                  <span className="font-medium">{selectedMember.fullName}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="text-xs font-bold text-[#1F6B43] hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}
            </Field>
          )}

          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-[#CAD8CB]">
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
              {isSubmitting ? <BusyLabel label="Saving..." /> : (editingId ? "Update Notification" : "Publish Notification")}
            </button>
          </div>
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
        title="Confirm Deletion"
        description="Are you sure you want to delete this announcement? This will archive the announcement and hide it from all views. This action cannot be undone."
        confirmLabel={isSubmitting ? "Deleting..." : "Delete Announcement"}
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

      <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Announcement summary">
        <StatCard
          label="Total Announcements"
          value={String(announcementsList.length)}
          icon={Megaphone}
        />
        <StatCard
          label="Public Announcements"
          value={String(announcementsList.filter((a) => a.audienceType === "Public").length)}
          icon={Globe}
        />
        <StatCard
          label="Total Acknowledgments"
          value={String(announcementsList.reduce((sum, a) => sum + (a.acknowledgmentCount || 0), 0))}
          icon={ShieldCheck}
        />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {["All", "Public", "All Members", "Selected Users"].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setPage(1);
              }}
              className={`rounded-full border px-5 py-2 text-sm font-bold transition-all ${activeFilter === filter
                  ? "bg-[#123D2A] border-[#123D2A] text-white shadow-md"
                  : "bg-white border-[#CAD8CB] text-[#6C7A70] hover:border-[#1F6B43] hover:text-[#123D2A]"
                }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search announcements..."
            className="h-10 w-full rounded-md border border-[#CAD8CB] bg-white pl-9 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          />
        </div>
      </div>

      {isFetchingAnnouncements ? (
        <div className="flex h-32 items-center justify-center">
          <BusyLabel label="Loading announcements..." />
        </div>
      ) : (
        (() => {
          const filteredAnnouncements = announcementsList.filter((ann) => {
            const matchesSearch =
              ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              ann.message.toLowerCase().includes(searchTerm.toLowerCase());
            
            const isNotDeleted = ann.announcementStatus !== "Archived";

            if (activeFilter === "All") return matchesSearch && isNotDeleted;
            return matchesSearch && isNotDeleted && ann.audienceType === activeFilter;
          });
          const itemsPerPage = 5;
          const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / itemsPerPage));
          const currentPage = Math.min(page, totalPages);
          const paginatedAnnouncements = filteredAnnouncements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

          if (filteredAnnouncements.length === 0) {
            return (
              <EmptyState
                icon={Megaphone}
                title="No Announcements Yet"
                description="Click 'New Notification' to publish your first announcement to the members."
              />
            );
          }

          return (
            <div className="grid gap-4">
              {paginatedAnnouncements.map((ann) => (
                <div key={ann.id} className="group relative overflow-hidden rounded-xl border border-[#CAD8CB] bg-white shadow-sm transition-all hover:border-[#1F6B43]/50 hover:shadow-md flex flex-col md:flex-row items-stretch">
                  {ann.featuredImagePath && (
                    <div className="md:w-[180px] h-32 md:h-auto relative overflow-hidden shrink-0 bg-[#F7F8F3] border-b md:border-b-0 md:border-r border-[#CAD8CB]">
                      <img src={`${env.apiUrl}${ann.featuredImagePath}`} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#123D2A]/10 to-transparent z-10 pointer-events-none"></div>
                    </div>
                  )}
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="mb-1.5 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-[#123D2A] truncate">{ann.title}</h3>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${getAudienceBadge(ann.audienceType)}`}>
                            {ann.audienceType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                          {ann.announcementStatus !== "Archived" && (
                            <>
                              <button onClick={() => handleEdit(ann)} className="rounded-md p-1.5 text-[#6C7A70] hover:bg-[#EEF2EC] hover:text-[#123D2A] transition" aria-label="Edit">
                                <Edit className="size-3.5" />
                              </button>
                              <button onClick={() => confirmDelete(ann.id)} className="rounded-md p-1.5 text-[#6C7A70] hover:bg-[#FFE6E0] hover:text-[#9A392A] transition" aria-label="Delete">
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="mb-2 text-[11px] font-medium text-[#6C7A70]">
                        Published {formatDate(ann.createdAt)}
                      </p>

                      <p className="whitespace-pre-wrap break-all text-sm text-[#294B39] line-clamp-2">{stripHtml(ann.message)}</p>
                      <button
                        onClick={() => setViewingAnnouncement(ann)}
                        className="mt-1 text-xs font-bold text-[#1F6B43] hover:underline"
                      >
                        Read more
                      </button>
                      {ann.audienceValue && (
                        <div className="mt-2.5 rounded-md bg-[#F7F8F3] px-2.5 py-1.5 text-xs text-[#294B39] border border-[#CAD8CB] inline-block">
                          <span className="font-semibold">Targeted to:</span> {ann.audienceValue}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#CAD8CB] pt-2.5">
                      <div className="text-xs text-[#6C7A70]">
                        {ann.excerpt && <span className="italic line-clamp-1">{ann.excerpt}</span>}
                      </div>
                      <button
                        onClick={() => openAckList(ann.id)}
                        disabled={!ann.acknowledgmentCount}
                        className={`flex items-center text-xs font-bold transition shrink-0 ${ann.acknowledgmentCount ? "text-[#1F6B43] hover:text-[#123D2A] hover:underline" : "text-[#6C7A70] cursor-not-allowed opacity-70"
                          }`}
                      >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        {ann.acknowledgmentCount || 0} Acknowledgment{(ann.acknowledgmentCount || 0) !== 1 && "s"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-center gap-4 mt-6 mb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage === 1}
                    className="grid size-9 place-items-center rounded-lg border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] hover:text-[#123D2A] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="grid size-9 place-items-center rounded-lg border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] hover:text-[#123D2A] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
                <div className="text-sm font-bold text-[#0A291A]">
                  Page {currentPage} of {totalPages} <span className="mx-2 text-[#CAD8CB]">•</span> {filteredAnnouncements.length} announcement{filteredAnnouncements.length !== 1 ? "s" : ""}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="grid size-9 place-items-center rounded-lg border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] hover:text-[#123D2A] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="grid size-9 place-items-center rounded-lg border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] hover:text-[#123D2A] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="size-4" />
                  </button>
                </div>
              </div>
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
          <div className="mt-4 grid gap-5">
            {viewingAnnouncement.featuredImagePath && (
              <div className="relative h-48 w-full overflow-hidden rounded-md border border-[#CAD8CB] bg-[#F7F8F3]">
                <img src={`${env.apiUrl}${viewingAnnouncement.featuredImagePath}`} alt={viewingAnnouncement.title} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            
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

            <div className="whitespace-pre-wrap text-sm text-[#294B39] quill-content" dangerouslySetInnerHTML={{ __html: viewingAnnouncement.message }} />

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
