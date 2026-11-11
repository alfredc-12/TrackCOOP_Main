"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Gift,
  Settings2,
  UsersRound,
  Activity,
  Boxes,
  RefreshCcw,
  Save,
  Info,
  LockKeyhole,
  WalletCards,
  Sprout,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  ConfirmDialog,
  LoadingSkeleton,
} from "@/components/portal/PortalPrimitives";
import { SettingControl } from "./SettingControl";
import {
  getSettingsCatalog,
  saveSettings,
  describeValue,
  draftError,
  type SettingsCatalog,
  type DraftValues,
} from "./settings-client";
import { HighValueCropsGuide } from "@/features/crops/HighValueCropsGuide";
import styles from "./SystemPages.module.css";
const icons = {
  membership: UsersRound,
  share_capital: WalletCards,
  referrals: Gift,
  indicators: Activity,
  inventory: Boxes,
};
export function SystemSettingsClient() {
  const [resource, setResource] = useState<{
      data: SettingsCatalog | null;
      error: string;
      revision: number;
    }>({ data: null, error: "", revision: -1 }),
    [revision, setRevision] = useState(0),
    [draft, setDraft] = useState<DraftValues>({}),
    [touched, setTouched] = useState<string[]>([]),
    [category, setCategory] = useState("membership"),
    [saving, setSaving] = useState(false),
    [confirm, setConfirm] = useState<"save" | "refresh" | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    getSettingsCatalog(c.signal)
      .then((data) => {
        if (c.signal.aborted) return;
        setResource({ data, error: "", revision });
        setDraft(
          Object.fromEntries(data.settings.map((s) => [s.key, s.value])),
        );
        setTouched([]);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setResource({
            data: null,
            error:
              e instanceof Error ? e.message : "Settings could not be loaded.",
            revision,
          });
      });
    return () => c.abort();
  }, [revision]);
  const data = resource.data,
    loading = resource.revision !== revision;
  const configuredHighValueCrops = Array.isArray(draft["inventory.high_value_crops"])
    ? draft["inventory.high_value_crops"].filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const changed =
      data?.settings.filter(
        (s) =>
          s.editable &&
          touched.includes(s.key) &&
          (s.source !== "saved" ||
            JSON.stringify(s.value) !== JSON.stringify(draft[s.key])),
      ) ?? [],
    current = changed.filter((s) => s.category === category),
    selected = data?.settings.filter((s) => s.category === category) ?? [];
  const update = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setTouched((t) => (t.includes(key) ? t : [...t, key]));
    setError("");
    setMessage("");
  };
  const review = () => {
    const invalid = current
      .map((s) => draftError(s, draft[s.key]))
      .filter(Boolean);
    if (invalid.length) {
      setError(invalid.join(" "));
      return;
    }
    setError("");
    setConfirm("save");
  };
  const refresh = () => {
    if (changed.length) {
      setConfirm("refresh");
      return;
    }
    setRevision((v) => v + 1);
    setError("");
    setMessage("");
  };
  const discard = () => {
    setDraft((d) => ({
      ...d,
      ...Object.fromEntries(selected.map((s) => [s.key, s.value])),
    }));
    setTouched((t) => t.filter((key) => !selected.some((s) => s.key === key)));
    setError("");
  };
  async function apply() {
    if (confirm === "refresh") {
      setConfirm(null);
      setRevision((v) => v + 1);
      return;
    }
    if (busy.current || !current.length) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const savedKeys = current.map((s) => s.key),
        result = await saveSettings(current, draft),
        remaining = changed.filter((s) => !savedKeys.includes(s.key));
      setResource({ data: result, error: "", revision });
      setDraft((d) => ({
        ...Object.fromEntries(result.settings.map((s) => [s.key, s.value])),
        ...Object.fromEntries(remaining.map((s) => [s.key, d[s.key]])),
      }));
      setTouched(remaining.map((s) => s.key));
      setMessage(
        "Settings saved. Activity History includes the recorded changes.",
      );
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved.");
      setConfirm(null);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const confirmation = (kind: "save" | "refresh", trigger: ReactNode) => (
    <ConfirmDialog
      open={confirm === kind}
      trigger={trigger}
      onOpenChange={(open) => {
        if (!open && !saving) setConfirm(null);
      }}
      title={
        kind === "refresh"
          ? "Discard changes and refresh?"
          : "Confirm settings changes"
      }
      description={
        kind === "refresh"
          ? "Unsaved edits will be discarded and the latest saved values loaded."
          : "Only the changes shown below will be saved. Existing financial records, deadlines and indicator snapshots are not rewritten."
      }
      confirmLabel={kind === "refresh" ? "Discard & refresh" : "Save changes"}
      loading={saving}
      onConfirm={() => void apply()}
    >
      {kind === "save" && (
        <div className={styles.reviewChanges}>
          {current.map((s) => (
            <div key={s.key}>
              <strong>{s.label}</strong>
              <p>
                <span>Before:</span>{" "}
                {s.source === "saved"
                  ? describeValue(s.value)
                  : s.source === "default"
                    ? "Application default (not saved)"
                    : "Invalid / withheld saved value"}
              </p>
              <p>
                <span>After:</span> {describeValue(draft[s.key])}
              </p>
            </div>
          ))}
        </div>
      )}
    </ConfirmDialog>
  );
  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="System"
        title="System Settings"
        description="Manage supported cooperative rules with clear, reviewed changes."
        actions={confirmation(
          "refresh",
          <Button
            variant="secondary"
            disabled={loading || saving}
            onClick={refresh}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>,
        )}
      />
      {loading && <LoadingSkeleton />}
      {!loading && resource.error && (
        <div role="alert" className={styles.error}>
          {resource.error}
          <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
            Retry settings
          </Button>
        </div>
      )}
      {!loading && data && (
        <>
          <Tabs.Root value={category} onValueChange={setCategory}>
            <Tabs.List
              aria-label="Settings categories"
              className={styles.categoryTabs}
            >
              {data.categories.map((c) => {
                const Icon = icons[c.id as keyof typeof icons] ?? Settings2;
                return (
                  <Tabs.Trigger
                    key={c.id}
                    value={c.id}
                    className={styles.categoryTab}
                    aria-label={c.label}
                    aria-description={
                      changed.some((s) => s.category === c.id)
                        ? "Unsaved changes"
                        : undefined
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {c.label}
                    {changed.some((s) => s.category === c.id) && (
                      <span className={styles.pendingDot} aria-hidden="true" />
                    )}
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>
            {data.categories.map((c) => (
              <Tabs.Content
                value={c.id}
                key={c.id}
                className={styles.categoryContent}
              >
                <section className={styles.panel}>
                  <div className={styles.toolbar}>
                    <div>
                      <h2>{c.label}</h2>
                      <p className={styles.hint}>{c.help}</p>
                    </div>
                    <span className={styles.hint}>
                      {current.length
                        ? `${current.length} unsaved ${current.length === 1 ? "change" : "changes"}`
                        : "Saved values"}
                    </span>
                  </div>
                  {selected.map((s) => (
                    <section
                      key={s.key}
                      className={styles.settingRow}
                      data-wide={[
                        "referral",
                        "thresholds",
                        "labels",
                        "statuses",
                        "crop_list",
                      ].includes(s.kind)}
                    >
                      <div>
                        <h3 className={styles.settingTitle}>
                          {s.label}
                          {s.editable && s.unit ? ` (${s.unit})` : ""}
                          {!s.editable && (
                            <LockKeyhole
                              className="size-3.5"
                              aria-label="View-only"
                            />
                          )}
                        </h3>
                        <p className={styles.help}>{s.help}</p>
                        <p className={styles.saved}>
                          {s.kind === "thresholds"
                            ? "Saved threshold rows are shown in the controls below. "
                            : ""}
                          {s.source === "saved"
                            ? "Saved"
                            : s.source === "default"
                              ? "Application default · not saved"
                              : "Saved value needs review"}
                          :{" "}
                          {s.source === "invalid"
                            ? "The saved value is invalid or withheld. Review the proposed values before explicitly saving."
                            : s.kind === "thresholds"
                              ? "Configured score ranges"
                              : s.kind === "crop_list"
                                ? "Configured reference crop names"
                                : describeValue(s.value)}
                        </p>
                        {changed.some((v) => v.key === s.key) && (
                          <span className={styles.pending}>Unsaved change</span>
                        )}
                      </div>
                      <div
                        className={styles.control}
                        data-simple={s.kind === "number" || s.kind === "text"}
                      >
                        <SettingControl
                          setting={s}
                          value={draft[s.key]}
                          onChange={(v) => update(s.key, v)}
                          statuses={data.participationStatuses}
                        />
                      </div>
                    </section>
                  ))}
                  {selected.some((s) => s.editable) && (
                    <div className={styles.saveBar}>
                      <p className={styles.hint}>
                        <Info
                          className="mr-1 inline size-3.5"
                          aria-hidden="true"
                        />
                        Review the changes before they take effect.
                      </p>
                      <div className={styles.actions}>
                        <Button
                          variant="secondary"
                          disabled={!current.length || saving}
                          onClick={discard}
                        >
                          Discard changes
                        </Button>
                        {confirmation(
                          "save",
                          <Button
                            disabled={!current.length || saving}
                            onClick={review}
                          >
                            <Save className="size-4" aria-hidden="true" />
                            Review & save
                          </Button>,
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </Tabs.Content>
            ))}
          </Tabs.Root>
          <section className={styles.panel}>
            <div className={styles.toolbar}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-coop-control bg-coop-subtle text-coop-green">
                  <Sprout className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2>Crop classification</h2>
                  <p className={styles.hint}>
                    Review the cooperative reference used to identify
                    High-Value Crops in Inventory and Seasonal Analytics.
                  </p>
                </div>
              </div>
              <HighValueCropsGuide
                cropNames={configuredHighValueCrops}
                onEdit={() => setCategory("inventory")}
                trigger={
                  <Button type="button" variant="secondary">
                    View High-Value Crops guide
                  </Button>
                }
              />
            </div>
          </section>
          <details className={styles.technical}>
            <summary>
              <Settings2 className="mr-2 inline size-4" aria-hidden="true" />
              Technical information
            </summary>
            <p className={`${styles.hint} mt-3`}>
              Additional and historical settings are not editable here.
              Credentials and sensitive configuration are excluded.
            </p>
            {data.technical.length ? (
              <dl className={styles.definitions}>
                {data.technical.map((t) => (
                  <div key={t.key}>
                    <dt>{t.key}</dt>
                    <dd>{t.type} · managed outside this page</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.hint}>No additional displayable settings.</p>
            )}
          </details>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
    </div>
  );
}
