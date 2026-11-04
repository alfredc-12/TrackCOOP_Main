"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  getActivityDetail,
  localTime,
  type ActivityDetail,
  type ActivityItem,
} from "./activity-client";
import { describeValue } from "@/features/system-settings/settings-client";
import styles from "@/features/system-settings/SystemPages.module.css";
export function ActivityDrawer({
  item,
  onClose,
}: {
  item: ActivityItem | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
      id: string;
      detail: ActivityDetail | null;
      error: string;
    }>({ id: "", detail: null, error: "" }),
    returnFocus = useRef<HTMLElement | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!item) return;
    const c = new AbortController();
    getActivityDetail(item.id, c.signal)
      .then((detail) => {
        if (!c.signal.aborted) setData({ id: item.id, detail, error: "" });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setData({
            id: item.id,
            detail: null,
            error:
              e instanceof Error
                ? e.message
                : "Activity details could not be loaded.",
          });
      });
    return () => c.abort();
  }, [item, revision]);
  const detail = data.id === item?.id ? data.detail : null;
  const values = (title: string, v: ActivityDetail["previous"]) => (
    <section>
      <h3>{title}</h3>
      {v ? (
        <dl className={styles.definitions}>
          {Object.entries(v).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{describeValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.hint}>
          Not recorded, or no safe displayable values are available.
        </p>
      )}
    </section>
  );
  return (
    <Dialog.Root
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.drawer}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <header className={styles.drawerHeader}>
            <div>
              <Dialog.Title>Activity details</Dialog.Title>
              <Dialog.Description>
                Recorded activity · read-only
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close activity details"
              className={styles.iconButton}
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className={styles.drawerBody}>
            {!detail && !(data.id === item?.id && data.error) && (
              <p role="status">Loading activity…</p>
            )}
            {data.id === item?.id && data.error && (
              <p role="alert" className={styles.error}>
                {data.error}
                <button
                  type="button"
                  className={styles.activityLabel}
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Retry activity details
                </button>
              </p>
            )}
            {detail && (
              <>
                <h2>{detail.label}</h2>
                <dl className={styles.definitions}>
                  <div>
                    <dt>Responsible user</dt>
                    <dd>{detail.userName}</dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <dd>{detail.area}</dd>
                  </div>
                  <div>
                    <dt>Affected record</dt>
                    <dd>{detail.reference ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Date and time</dt>
                    <dd>{localTime(detail.at)} · PHT</dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>
                      {detail.description || "No description was recorded."}
                    </dd>
                  </div>
                </dl>
                <div className={styles.changeColumns}>
                  {values("Previous values", detail.previous)}
                  {values("New values", detail.next)}
                </div>
                <p className={styles.notice}>{detail.detailsNote}</p>
                <details>
                  <summary>Technical reference</summary>
                  <dl className={styles.definitions}>
                    <div>
                      <dt>Activity ID</dt>
                      <dd>{detail.id}</dd>
                    </div>
                    <div>
                      <dt>Action code</dt>
                      <dd>{detail.action}</dd>
                    </div>
                  </dl>
                </details>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
