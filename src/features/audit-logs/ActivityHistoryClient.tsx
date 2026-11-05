"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  ChevronDown,
  Eye,
  Filter,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/Button";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { LoadingSkeleton, PaginationControls } from "@/components/portal/PortalPrimitives";
import {
  getActivity,
  getActivityOptions,
  localTime,
  type ActivityItem,
  type ActivityOptions,
} from "./activity-client";
import { ActivityDrawer } from "./ActivityDrawer";
import styles from "@/features/system-settings/SystemPages.module.css";
type Query = Record<string, string>;
const defaults = {
  page: "1",
  pageSize: "10",
  search: "",
  category: "",
  userId: "",
  start: "",
  end: "",
};
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("activity-query", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("activity-query", callback);
  };
};
const snapshot = () => window.location.search;
function useQuery() {
  const text = useSyncExternalStore(subscribe, snapshot, () => ""),
    query = useMemo(
      () => ({ ...defaults, ...Object.fromEntries(new URLSearchParams(text)) }),
      [text],
    );
  return {
    query,
    apply: (next: Query) => {
      window.history.pushState(
        null,
        "",
        `${location.pathname}?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`,
      );
      window.dispatchEvent(new Event("activity-query"));
    },
  };
}
function ActivityFilters({
  query,
  apply,
  options,
  optionsError,
}: {
  query: Query;
  apply: (q: Query) => void;
  options: ActivityOptions | null;
  optionsError: boolean;
}) {
  const [draft, setDraft] = useState(query),
    [expanded, setExpanded] = useState(false),
    [error, setError] = useState(""),
    [userSearch, setUserSearch] = useState(""),
    [userOptions, setUserOptions] = useState<ActivityOptions | null>(null);
  useEffect(() => {
    if (draft.search === query.search) return;
    const timer = setTimeout(
      () => apply({ ...query, search: draft.search, page: "1" }),
      350,
    );
    return () => clearTimeout(timer);
  }, [draft.search, query, apply]);
  useEffect(() => {
    if (!userSearch) return;
    const c = new AbortController(),
      timer = setTimeout(() => {
        getActivityOptions(userSearch, c.signal)
          .then((v) => {
            if (!c.signal.aborted) setUserOptions(v);
          })
          .catch(() => {});
      }, 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [userSearch]);
  const set = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const choices = (
    key: string,
    label: string,
    items: Array<{ id: string; label: string }>,
  ) => {
    const selected = items.find((i) => i.id === draft[key]);
    return (
      <label className={styles.field}>
        <span>{label}</span>
        <StyledSelect
          aria-label={label}
          value={
            selected?.label ??
            (draft[key]
              ? `Selected user #${draft[key]}`
              : (items[0]?.label ?? "All"))
          }
          options={items.map((i) => i.label)}
          onChange={(label) =>
            set(key, items.find((i) => i.label === label)?.id ?? "")
          }
        />
      </label>
    );
  };
  const chipNames: Record<string, string> = {
    search: "Search",
    category: "Category",
    userId: "User",
    start: "From",
    end: "To",
  };
  return (
    <form
      className={styles.panel}
      aria-label="Activity filters"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.start && draft.end && draft.start > draft.end) {
          setError("Choose dates in chronological order.");
          return;
        }
        setError("");
        apply({ ...draft, page: "1" });
      }}
    >
      <div className={`${styles.toolbar} mb-4`}>
        <div className={styles.actions}>
          <h2>
            <Filter className="mr-2 inline size-4" aria-hidden="true" />
            Filters
          </h2>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="More activity filters"
            aria-expanded={expanded}
            aria-controls="activity-additional-filters"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={`size-4 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => apply(defaults)}
          >
            Clear all
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
      <div className={styles.filterFields}>
        <label className={styles.field}>
          <span>Search activity, user or record</span>
          <span className={styles.search}>
            <Search className="size-4" aria-hidden="true" />
            <input
              type="search"
              value={draft.search}
              maxLength={190}
              onChange={(e) => set("search", e.target.value)}
            />
          </span>
        </label>
        <DatePicker
          label="From date"
          value={draft.start}
          max={draft.end || undefined}
          onChange={(v) => set("start", v)}
        />
        <DatePicker
          label="To date"
          value={draft.end}
          min={draft.start || undefined}
          onChange={(v) => set("end", v)}
        />
        {choices("category", "Activity category", [
          { id: "", label: "All activity categories" },
          ...(options?.categories ?? []),
        ])}
      </div>
      <div id="activity-additional-filters" hidden={!expanded} className="mt-4">
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Find a responsible user</span>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search user names"
              maxLength={120}
            />
          </label>
          {choices("userId", "Responsible user", [
            { id: "", label: "All users" },
            { id: "system", label: "System / unavailable user" },
            ...((userSearch ? userOptions : options)?.users ?? []).map((u) => ({
              id: u.id,
              label: `${u.name} (#${u.id})`,
            })),
          ])}
          {choices(
            "pageSize",
            "Rows per page",
            ["10", "20", "50", "100"].map((id) => ({ id, label: id })),
          )}
        </div>
        {(userSearch ? userOptions : options)?.usersTruncated && (
          <p className={styles.hint}>Search a user name to narrow the list.</p>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {optionsError && (
        <p role="status" className={styles.hint}>
          Filter options could not be loaded. Use Refresh to retry.
        </p>
      )}
      <div className={styles.chips}>
        {Object.entries(query)
          .filter(([key, value]) => value && chipNames[key])
          .map(([key, value]) => (
            <button
              type="button"
              className={styles.chip}
              key={key}
              aria-label={`Remove ${chipNames[key]} filter`}
              onClick={() => apply({ ...query, [key]: "", page: "1" })}
            >
              {chipNames[key]}:{" "}
              {key === "category"
                ? (options?.categories.find((c) => c.id === value)?.label ??
                  value)
                : value}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
      </div>
    </form>
  );
}
export function ActivityHistoryClient() {
  const { query, apply } = useQuery(),
    [revision, setRevision] = useState(0),
    [options, setOptions] = useState<ActivityOptions | null>(null),
    [item, setItem] = useState<ActivityItem | null>(null),
    [optionsError, setOptionsError] = useState(false);
  const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v),
    ).toString(),
    key = `${params}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    items: ActivityItem[];
    total: number;
    page: number;
    error: string;
  }>({ key: "", items: [], total: 0, page: 1, error: "" });
  useEffect(() => {
    const c = new AbortController();
    getActivity(new URLSearchParams(params), c.signal)
      .then((r) => {
        if (!c.signal.aborted)
          setState({
            key,
            items: r.items,
            total: Number(r.meta.total ?? 0),
            page: Number(r.meta.page ?? 1),
            error: "",
          });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState((s) => ({
            ...s,
            key,
            error:
              e instanceof Error ? e.message : "Activity could not be loaded.",
          }));
      });
    return () => c.abort();
  }, [params, key]);
  useEffect(() => {
    const c = new AbortController();
    getActivityOptions("", c.signal)
      .then((v) => {
        if (!c.signal.aborted) {
          setOptions(v);
          setOptionsError(false);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setOptionsError(true);
      });
    return () => c.abort();
  }, [revision]);
  const loading = state.key !== key,
    pages = Math.max(1, Math.ceil(state.total / Number(query.pageSize))),
    inspect = (r: ActivityItem) => (
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`View activity ${r.id}`}
        title="View activity details"
        onClick={() => setItem(r)}
      >
        <Eye className="size-4" aria-hidden="true" />
      </button>
    );
  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="System"
        title="Activity History"
        description="See who did what across the cooperative, with the recorded details."
        actions={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <ActivityFilters
        key={params}
        query={query}
        apply={apply}
        options={options}
        optionsError={optionsError}
      />
      <section className={styles.panel} aria-label="Recorded activity">
        <div className={`${styles.toolbar} mb-4`}>
          <h2>
            <Activity className="mr-2 inline size-4" aria-hidden="true" />
            Recorded activity
          </h2>
          <span className={styles.hint}>
            {loading
              ? "Loading activity…"
              : state.error
                ? "Activity unavailable"
                : `${state.total.toLocaleString("en-PH")} ${state.total === 1 ? "record" : "records"} · newest first · Philippine time`}
          </span>
        </div>
        {loading && <LoadingSkeleton />}
        {state.error && (
          <p role="alert" className={styles.error}>
            {state.error}
            {state.items.length > 0
              ? " Previously loaded activity may be out of date."
              : ""}
            <Button
              variant="secondary"
              onClick={() => setRevision((v) => v + 1)}
            >
              Retry activity
            </Button>
          </p>
        )}
        {!loading && !state.error && !state.items.length && (
          <div className={styles.empty}>
            <Activity className="size-7" aria-hidden="true" />
            <h3>No matching activity</h3>
            <p>Try another search, date range or user.</p>
          </div>
        )}
        {!loading && state.items.length > 0 && (
          <>
            <div className={`${styles.tableRegion} ${styles.desktopTable}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Responsible user</th>
                    <th>Area / record</th>
                    <th>Date and time</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.activityLabel}
                          onClick={() => setItem(r)}
                        >
                          {r.label}
                        </button>
                        {r.description && (
                          <p className={styles.hint}>{r.description}</p>
                        )}
                      </td>
                      <td>{r.userName}</td>
                      <td>
                        {r.area}
                        <p className={styles.hint}>
                          {r.reference ?? "Record not specified"}
                        </p>
                      </td>
                      <td>
                        <time dateTime={r.at}>{localTime(r.at)}</time>
                      </td>
                      <td>{inspect(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileActivity}>
              {state.items.map((r) => (
                <article key={r.id} className={styles.activityCard}>
                  <div className={styles.toolbar}>
                    <button
                      type="button"
                      className={styles.activityLabel}
                      onClick={() => setItem(r)}
                    >
                      {r.label}
                    </button>
                    {inspect(r)}
                  </div>
                  <p>{r.userName}</p>
                  <p className={styles.hint}>
                    {r.area} · {r.reference ?? "Record not specified"}
                  </p>
                  {r.description && (
                    <p className={styles.hint}>{r.description}</p>
                  )}
                  <time className={styles.hint} dateTime={r.at}>
                    {localTime(r.at)} PHT
                  </time>
                </article>
              ))}
            </div>
          </>
        )}
        {!state.error ? (
          <PaginationControls
            currentPage={state.page}
            totalPages={pages}
            totalItems={state.total}
            itemName="activity records"
            onPageChange={(nextPage) => apply({ ...query, page: String(nextPage) })}
            pageSize={Number(query.pageSize)}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageSizeChange={(nextPageSize) => apply({ ...query, page: "1", pageSize: String(nextPageSize) })}
            disabled={loading}
            className="mt-4"
          />
        ) : null}
      </section>
      <ActivityDrawer item={item} onClose={() => setItem(null)} />
    </div>
  );
}
