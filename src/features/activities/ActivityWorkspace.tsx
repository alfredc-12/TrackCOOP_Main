"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { apiRequest } from "@/lib/api-client";

type Activity = { id: string; title: string; date: string; time: string; location: string; details: string; status: "Scheduled" | "Cancelled"; qualifies: number | boolean };
type Attendance = { id: string; memberId: string; memberCode: string; memberName: string; status: string; remarks: string | null };
type Detail = Activity & { attendance: Attendance[] };
type Member = { id: string; memberCode: string; fullName: string };
type Draft = { title: string; date: string; time: string; location: string; details: string; qualifies: boolean };
const empty: Draft = { title: "", date: "", time: "", location: "", details: "", qualifies: true };
const field = "coop-field min-h-11 w-full rounded-coop-control border border-coop-border bg-coop-surface px-3 py-2 text-coop-forest";
const action = "min-h-11 rounded-coop-control bg-coop-green px-4 py-2 font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 rounded-coop-control border border-coop-border bg-coop-surface px-4 py-2 font-semibold text-coop-forest disabled:opacity-50";

export function ActivityWorkspace() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberChoice, setMemberChoice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => { setEvents(await apiRequest<Activity[]>("/api/activities")); }, []);
  useEffect(() => { void apiRequest<Activity[]>("/api/activities").then(setEvents).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function show(id: string) { setSelected(await apiRequest<Detail>(`/api/activities/${id}`)); }
  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); } catch (e) { setError(e instanceof Error ? e.message : "The request could not be completed."); } finally { setBusy(false); }
  }
  function change(name: keyof Draft, value: string | boolean) { setDraft(previous => ({ ...previous, [name]: value })); }
  function edit(event: Activity) { setEditing(event.id); setDraft({ title:event.title,date:event.date,time:event.time,location:event.location,details:event.details ?? "",qualifies:Boolean(event.qualifies) }); }
  function submit(e: FormEvent) {
    e.preventDefault();
    void perform(async () => {
      const result = await apiRequest<{id:string}>(editing ? `/api/activities/${editing}` : "/api/activities", { method: editing ? "PATCH" : "POST", body: JSON.stringify(draft) });
      await load(); await show(result.id); setDraft(empty); setEditing(null);
    }, editing ? "Event updated." : "Event scheduled.");
  }
  function findMembers(e: FormEvent) {
    e.preventDefault();
    void perform(async () => { const result=await apiRequest<Member[]>(`/api/members?approvalStatus=Approved&pageSize=100&search=${encodeURIComponent(search)}`); setMembers(result); setMemberChoice(""); }, "Member search complete.");
  }
  const option = (member: Member) => `${member.fullName} (${member.memberCode}) [${member.id}]`;
  const chosen = members.find(member => option(member) === memberChoice);
  return <div className="space-y-6">
    <PageHeader eyebrow="Communication" title="Events and Attendance" description="Schedule cooperative activities and maintain attendance records." />
    {error && <p role="alert" className="rounded-coop-panel border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-coop-panel border border-coop-border bg-coop-sage p-3 text-coop-forest">{message}</p>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-5">
        <h2 className="text-lg font-bold text-coop-forest">{editing ? "Edit event" : "Schedule an event"}</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 font-semibold sm:col-span-2">Event title<input className={field} value={draft.title} onChange={e=>change("title",e.target.value)} required maxLength={255} /></label>
          <label className="grid gap-1 font-semibold">Date<input className={field} type="date" value={draft.date} onChange={e=>change("date",e.target.value)} required /></label>
          <label className="grid gap-1 font-semibold">Time<input className={field} type="time" value={draft.time} onChange={e=>change("time",e.target.value)} required /></label>
          <label className="grid gap-1 font-semibold sm:col-span-2">Location<input className={field} value={draft.location} onChange={e=>change("location",e.target.value)} required maxLength={255} /></label>
          <label className="grid gap-1 font-semibold sm:col-span-2">Details<textarea className={field} value={draft.details} onChange={e=>change("details",e.target.value)} maxLength={4000} /></label>
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={draft.qualifies} onChange={e=>change("qualifies",e.target.checked)} /> Count qualifying attendance in member analytics</label>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy} className={action}>{editing ? "Save changes" : "Schedule event"}</button>{editing && <button type="button" className={secondary} onClick={()=>{setEditing(null);setDraft(empty);}}>Cancel editing</button>}</div>
        </form>
      </section>
      <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-5">
        <h2 className="text-lg font-bold text-coop-forest">Scheduled events</h2>
        {loading ? <p className="mt-4">Loading events...</p> : events.length === 0 ? <p className="mt-4">No events have been scheduled.</p> : <ul className="mt-4 space-y-3">{events.map(event=><li key={event.id} className="rounded-coop-control border border-coop-border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{event.title}</strong><p className="text-sm text-coop-muted">{event.date} at {event.time} · {event.location}</p><p className="text-sm">{event.status}</p></div><div className="flex gap-2"><button className={secondary} onClick={()=>void perform(()=>show(event.id),"Event details loaded.")}>View attendance</button>{event.status === "Scheduled" && <button className={secondary} onClick={()=>edit(event)}>Edit</button>}</div></div></li>)}</ul>}
      </section>
    </div>
    {selected && <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-5" aria-label="Event attendance">
      <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-lg font-bold text-coop-forest">Attendance: {selected.title}</h2><p className="text-sm text-coop-muted">{selected.date} · {selected.location} · {selected.status}</p></div>{selected.status === "Scheduled" && <button className={secondary} disabled={busy} onClick={()=>void perform(async()=>{await apiRequest(`/api/activities/${selected.id}/cancel`,{method:"POST"});await load();await show(selected.id);},"Event cancelled; its attendance no longer contributes to analytics.")}>Cancel event</button>}</div>
      {selected.status === "Scheduled" && <><form onSubmit={findMembers} className="mt-5 flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 font-semibold">Find approved member<input className={field} value={search} onChange={e=>setSearch(e.target.value)} required /></label><button className={secondary} disabled={busy}>Search members</button></form>
      {members.length > 0 && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 font-semibold" htmlFor="activity-member">Member<StyledSelect id="activity-member" value={memberChoice} onChange={setMemberChoice} options={members.map(option)} searchable placeholder="Choose a member" /></label><button className={action} disabled={busy || !chosen} onClick={()=>void perform(async()=>{await apiRequest(`/api/activities/${selected.id}/attendance`,{method:"POST",body:JSON.stringify({memberId:chosen!.id})});await show(selected.id);},"Attendance recorded.")}>Record attendance</button></div>}</>}
      <h3 className="mt-6 font-bold">Attendance records</h3>
      {selected.attendance.length === 0 ? <p className="mt-2">No attendance recorded.</p> : <><label className="mt-3 grid gap-1 font-semibold">Reason for correction<input className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain a correction" /></label><ul className="mt-3 space-y-2">{selected.attendance.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-coop-control border border-coop-border p-3"><span>{row.memberName} ({row.memberCode}) · {row.status}</span>{selected.status === "Scheduled" && <button className={secondary} disabled={busy || reason.trim().length < 3} onClick={()=>void perform(async()=>{await apiRequest(`/api/activities/${selected.id}/attendance/${row.id}`,{method:"PATCH",body:JSON.stringify({status:row.status === "Participated" ? "Voided" : "Participated",reason})});await show(selected.id);setReason("");},"Attendance corrected and recorded in the audit log.")}>{row.status === "Participated" ? "Void attendance" : "Restore attendance"}</button>}</li>)}</ul></>}
    </section>}
  </div>;
}
