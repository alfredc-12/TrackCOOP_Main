"use client";

import { RefreshCcw, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import { DataTable, EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  createLandingRecord,
  listAuditLogs,
  listLandingRecords,
  listSystemSettings,
  saveSystemSetting,
  updateLandingRecord,
  type LandingCollection,
  type LandingRecord,
} from "./landing-admin-api";

type LandingAdminCollectionViewProps = {
  collection: LandingCollection;
  eyebrow: string;
  title: string;
  description: string;
  template: Record<string, unknown>;
  statusKey: string;
  primaryKey: string;
};

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonInput(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Input must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function Toolbar({
  search,
  setSearch,
  onRefresh,
}: {
  search: string;
  setSearch: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder="Search records"
          type="search"
        />
      </label>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
      >
        <RefreshCcw className="size-4" />
        Refresh
      </button>
    </div>
  );
}

export function LandingAdminCollectionView({
  collection,
  eyebrow,
  title,
  description,
  template,
  statusKey,
  primaryKey,
}: LandingAdminCollectionViewProps) {
  const [records, setRecords] = useState<LandingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LandingRecord | null>(null);
  const [editorValue, setEditorValue] = useState(prettyJson(template));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedId = selected?.id;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setRecords(await listLandingRecords(collection, search));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Landing records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [collection, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function startCreate() {
    setSelected(null);
    setEditorValue(prettyJson(template));
  }

  function startEdit(record: LandingRecord) {
    setSelected(record);
    const editable = Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => !["id", "createdAt", "updatedAt", "publishedAt"].includes(key),
      ),
    );
    setEditorValue(prettyJson(editable));
  }

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      const payload = parseJsonInput(editorValue);
      if (selectedId) {
        await updateLandingRecord(collection, selectedId, payload);
      } else {
        await createLandingRecord(collection, payload);
      }
      startCreate();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Landing record could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusBadge tone="success">Chairman editor</StatusBadge>}
      />
      <Toolbar search={search} setSearch={setSearch} onRefresh={() => void load()} />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="grid gap-4">
          {isLoading ? <LoadingSkeleton /> : records.length === 0 ? (
            <EmptyState title="No landing records found" description="Create a record to publish content to the public website." />
          ) : (
            <DataTable>
              <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
                <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                  <tr><th className="px-5 py-4">Record</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Order</th><th className="px-5 py-4">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-[#F7F8F3]">
                      <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{String(record[primaryKey] ?? record.id)}</p><p className="mt-1 text-xs text-[#6C7A70]">ID {record.id}</p></td>
                      <td className="px-5 py-4"><StatusBadge tone={String(record[statusKey]).includes("Active") || String(record[statusKey]).includes("Published") ? "success" : "neutral"}>{String(record[statusKey] ?? "Draft")}</StatusBadge></td>
                      <td className="px-5 py-4">{String(record.displayOrder ?? "0")}</td>
                      <td className="px-5 py-4"><button onClick={() => startEdit(record)} className="rounded-md border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Edit JSON</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </section>
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#123D2A]">{selected ? "Edit record" : "Create record"}</h2>
            <button onClick={startCreate} className="text-xs font-bold uppercase tracking-[0.16em] text-[#1F6B43]">New</button>
          </div>
          <textarea
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            className="min-h-[480px] w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4 font-mono text-xs leading-6 text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save()}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60"
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </section>
      </div>
    </div>
  );
}

export function LandingSettingsView() {
  const [settings, setSettings] = useState<LandingRecord[]>([]);
  const [logs, setLogs] = useState<LandingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [editorValue, setEditorValue] = useState(prettyJson({
    settingGroup: "Landing",
    settingKey: "landing.review_note",
    settingValue: "",
    valueType: "String",
    description: "Internal landing content note.",
    isPublic: false,
    effectiveDate: null,
  }));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextSettings, nextLogs] = await Promise.all([
        listSystemSettings(search),
        listAuditLogs(search),
      ]);
      setSettings(nextSettings);
      setLogs(nextLogs);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Settings and audit logs could not be loaded.");
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function save() {
    try {
      await saveSystemSetting(parseJsonInput(editorValue));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setting could not be saved.");
    }
  }

  const latestLogs = useMemo(() => logs.slice(0, 12), [logs]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="System"
        title="Settings and Audit"
        description="Chairman-only settings and audit records for landing administration."
        actions={<StatusBadge tone="success">Chairman only</StatusBadge>}
      />
      <Toolbar search={search} setSearch={setSearch} onRefresh={() => void load()} />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <h2 className="text-lg font-black text-[#123D2A]">Save Setting</h2>
          <textarea value={editorValue} onChange={(event) => setEditorValue(event.target.value)} className="mt-3 min-h-[260px] w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4 font-mono text-xs leading-6" />
          <button onClick={() => void save()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"><Save className="size-4" />Save setting</button>
        </section>
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Setting</th><th className="px-5 py-4">Value</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC]">
              {settings.map((setting) => <tr key={setting.id}><td className="px-5 py-4 font-bold text-[#123D2A]">{String(setting.settingKey)}</td><td className="px-5 py-4 text-[#294B39]">{String(setting.settingValue ?? "")}</td></tr>)}
            </tbody>
          </table>
        </DataTable>
      </div>
      <DataTable>
        <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
          <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
            <tr><th className="px-5 py-4">Action</th><th className="px-5 py-4">Table</th><th className="px-5 py-4">User</th><th className="px-5 py-4">Time</th></tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2EC]">
            {latestLogs.map((log) => <tr key={log.id}><td className="px-5 py-4 font-bold text-[#123D2A]">{String(log.action)}</td><td className="px-5 py-4">{String(log.entityTable)}</td><td className="px-5 py-4">{String(log.userName ?? "System")}</td><td className="px-5 py-4">{String(log.actionTime ?? "")}</td></tr>)}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
