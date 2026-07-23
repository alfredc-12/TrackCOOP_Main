"use client";

import { Megaphone, Users, Globe, Edit, Trash2, Send, X, PlusCircle, ShieldCheck, Search, Plus } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { env } from "@/config/env";

export function ChairmanAnnouncementsClient() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
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
  const [page, setPage] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchAnnouncements = () => {
    setIsFetchingAnnouncements(true);
    apiRequest<any[]>("/api/announcements")
      .then((data) => setAnnouncementsList(data || []))
      .catch(console.error)
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
      // we'd fetch the user's name but for now we just show the ID in the input
      setSelectedMember({ userId: ann.audienceValue, fullName: `User ID: ${ann.audienceValue}` });
    } else {
      setSelectedMember(null);
    }
    setImageFile(null);
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
    } finally {
      setIsFetchingAckList(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/announcements/${deletingId}/archive`, {
        method: "POST"
      });
      setDeleteModalOpen(false);
      setDeletingId(null);
      fetchAnnouncements();
      setSuccessMessage("Announcement successfully deleted.");
      setSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      setSuccessMessage("Failed to delete announcement.");
      setSuccessModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      setSuccessMessage(editingId ? "Announcement successfully updated!" : "Announcement successfully created!");
      setSuccessModalOpen(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setSuccessMessage("Failed to save announcement. Check console for details.");
      setSuccessModalOpen(true);
    } finally {
      setIsSubmitting(false);
      setConfirmSubmitModalOpen(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        description="Publish, target, and archive cooperative announcements for members."
        actions={
          <Modal
            title="Create New Notification"
            description="Fill out the details below to broadcast a message to the members."
            open={modalOpen}
            onOpenChange={(open) => {
              setModalOpen(open);
              if (!open) resetForm();
            }}
            trigger={
              <Button variant="primary">
                <Plus className="size-4" />
                New Notification
              </Button>
            }
          >
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Input
                label="Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., General Assembly Schedule"
              />
              
              <label className="grid gap-2 text-sm font-medium text-[#36433c]">
                Message
                <textarea
                  className="h-32 rounded-md border border-black/10 bg-white p-3 text-sm text-[#17211c] outline-none transition placeholder:text-[#8a958e] focus:border-[#4d8f5b] focus:ring-4 focus:ring-[#4d8f5b]/15"
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter the full announcement details here..."
                />
              </label>

              <Input
                label="Short Excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A brief summary (optional)"
              />

              <label className="grid gap-2 text-sm font-medium text-[#36433c]">
                Featured Image (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[#8a958e] file:mr-4 file:rounded-full file:border-0 file:bg-[#4d8f5b]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#4d8f5b] hover:file:bg-[#4d8f5b]/20"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#36433c]">
                Audience
                <select
                  className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm text-[#17211c] outline-none transition focus:border-[#4d8f5b] focus:ring-4 focus:ring-[#4d8f5b]/15"
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                >
                  <option value="Public">Public (Everyone)</option>
                  <option value="All Members">All Members</option>
                  <option value="Selected Users">Specific Member</option>
                </select>
              </label>

              {audienceType === "Selected Users" && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[#36433c]">Select Member</label>
                  {!selectedMember ? (
                    <div className="relative">
                      <Input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search member name..."
                        className="w-full"
                      />
                      {memberSearch && (
                        <div className="absolute top-full z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-black/10 bg-white shadow-lg">
                          {isFetchingMembers ? (
                            <div className="p-3 text-sm text-[#8a958e]">Loading members...</div>
                          ) : filteredMembers.length > 0 ? (
                            filteredMembers.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#edf3e7]"
                                onClick={() => {
                                  setSelectedMember({ userId: m.userId, fullName: m.fullName });
                                  setMemberSearch("");
                                }}
                              >
                                {m.fullName}
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-[#8a958e]">No members found (with linked accounts)</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-md border border-[#4d8f5b] bg-[#edf3e7] px-3 py-2 text-sm text-[#17211c]">
                      <span>{selectedMember.fullName}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMember(null)}
                        className="text-xs font-bold text-[#4d8f5b] hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : (editingId ? "Update Notification" : "Publish Notification")}
                </Button>
              </div>
            </form>
          </Modal>
        }
      />

      {/* Confirmation Modal for Submit */}
      <Modal
        title={editingId ? "Confirm Update" : "Confirm Publication"}
        description={`Are you sure you want to ${editingId ? "update" : "publish"} this announcement?`}
        open={confirmSubmitModalOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setConfirmSubmitModalOpen(open);
        }}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmSubmitModalOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={executeSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Yes, Proceed"}
          </Button>
        </div>
      </Modal>

      <Modal
        title="Confirm Deletion"
        description="Are you sure you want to delete this announcement? This action cannot be undone."
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setDeletingId(null);
        }}
        trigger={<span className="hidden"></span>}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDeleteModalOpen(false);
              setDeletingId(null);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="primary" 
            className="bg-red-600 hover:bg-red-700"
            onClick={handleDelete} 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete Announcement"}
          </Button>
        </div>
      </Modal>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {["All", "Public", "All Members", "Selected Users"].map((filter) => (
          <button
            key={filter}
            onClick={() => {
              setActiveFilter(filter);
              setPage(1);
            }}
            className={`rounded-full border px-5 py-2 text-sm font-bold transition-all ${
              activeFilter === filter
                ? "bg-[#123D2A] border-[#123D2A] text-white shadow-md"
                : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#2F7D57] hover:text-[#123D2A]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {isFetchingAnnouncements ? (
        <div className="p-8 text-center text-sm text-[#8a958e]">Loading announcements...</div>
      ) : (
        (() => {
          const filteredAnnouncements = (activeFilter === "All" ? announcementsList : announcementsList.filter((a) => a.audienceType === activeFilter)).filter((a) => a.announcementStatus !== "Archived");
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
                <div key={ann.id} className="group relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition-all hover:border-[#1F6B43]/50 hover:shadow-md flex flex-col md:flex-row">
                  {ann.featuredImagePath && (
                    <div className="md:w-1/4 h-48 md:h-auto relative overflow-hidden shrink-0 bg-[#e8f3ec] border-b md:border-b-0 md:border-r border-gray-100">
                      <img src={`${env.apiUrl}${ann.featuredImagePath}`} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#123D2A]/20 to-transparent z-10 pointer-events-none"></div>
                    </div>
                  )}
                  <div className="flex-1 p-6 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-[#173626] break-all">{ann.title}</h3>
                          <span className="mt-1 inline-block rounded-full bg-[#DFF5E8] px-3 py-1 text-xs font-bold text-[#2F7D57]">
                            {ann.audienceType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(ann)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-[#123D2A] transition">
                            <Edit className="size-4" />
                          </button>
                          <button onClick={() => confirmDelete(ann.id)} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      <p className="mb-4 text-xs font-semibold text-[#6B7280]">
                        {new Date(ann.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      
                      <p className="whitespace-pre-wrap break-all text-sm text-[#36433c]">{ann.message}</p>
                      {ann.audienceValue && (
                        <div className="mt-4 rounded-md bg-slate-50 p-2 text-xs text-slate-500">
                          Targeted to: {ann.audienceValue}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-3">
                      <button 
                        onClick={() => openAckList(ann.id)}
                        disabled={!ann.acknowledgmentCount}
                        className={`flex items-center text-xs font-bold transition ${
                          ann.acknowledgmentCount ? "text-[#2F7D57] hover:text-[#123D2A] hover:underline" : "text-[#6B7280] cursor-not-allowed opacity-70"
                        }`}
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4" />
                        {ann.acknowledgmentCount || 0} Acknowledgment{(ann.acknowledgmentCount || 0) !== 1 && "s"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 mb-8">
                  <button onClick={() => setPage(1)} disabled={currentPage === 1} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                    &lt;&lt;
                  </button>
                  <button onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                    &lt;
                  </button>
                  <span className="text-sm font-semibold text-gray-600 px-4">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                    &gt;
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                    &gt;&gt;
                  </button>
                </div>
              )}
            </div>
          );
        })()
      )}

      <Modal
        title="Acknowledgments"
        description="List of members who have acknowledged this announcement."
        open={ackListModalOpen}
        onOpenChange={(open) => {
          setAckListModalOpen(open);
          if (!open) {
            setAckSearch("");
            setAckPage(1);
          }
        }}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search member name..."
              value={ackSearch}
              onChange={(e) => {
                setAckSearch(e.target.value);
                setAckPage(1);
              }}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {isFetchingAckList ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : (
              (() => {
                const filteredAcks = ackList.filter(ack => ack.fullName.toLowerCase().includes(ackSearch.toLowerCase()));
                const itemsPerPage = 10;
                const totalPages = Math.max(1, Math.ceil(filteredAcks.length / itemsPerPage));
                const currentPage = Math.min(ackPage, totalPages);
                const paginatedAcks = filteredAcks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                if (filteredAcks.length === 0) {
                  return <div className="py-8 text-center text-sm text-slate-500">No members found matching your search.</div>;
                }

                return (
                  <>
                    <ul className="divide-y divide-gray-100">
                      {paginatedAcks.map((ack, idx) => (
                        <li key={`${ack.userId}-${idx}`} className="flex items-center justify-between py-3">
                          <span className="font-semibold text-slate-800">{ack.fullName}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(ack.acknowledgedAt).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-2 pb-2">
                        <button onClick={() => setAckPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold text-xs">
                          &lt;&lt;
                        </button>
                        <button onClick={() => setAckPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold text-xs">
                          &lt;
                        </button>
                        <span className="text-xs font-semibold text-gray-600 px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => setAckPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold text-xs">
                          &gt;
                        </button>
                        <button onClick={() => setAckPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold text-xs">
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
        <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={() => setAckListModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        title={successMessage.includes("Failed") ? "Error" : "Success"}
        description={successMessage}
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="primary" onClick={() => setSuccessModalOpen(false)}>
            OK
          </Button>
        </div>
      </Modal>
    </div>
  );
}
