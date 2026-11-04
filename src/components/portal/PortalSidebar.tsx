"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { portalNavigation, roleHomePaths, type PortalRole } from "./navigation";
import styles from "./PortalSidebar.module.css";

type PortalSidebarProps = {
  role: PortalRole;
  isMobileOpen: boolean;
  onMobileClose: () => void;
};

function SidebarContent({
  role,
  onNavigate,
}: {
  role: PortalRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navigationId = useId();
  const groups = portalNavigation[role];
  const activeGroupTitle = useMemo(
    () =>
      groups.find((group) =>
        group.items.some(
          (item) =>
            pathname === item.href || pathname.startsWith(`${item.href}/`),
        ),
      )?.title ?? null,
    [groups, pathname],
  );
  const [openGroupByPath, setOpenGroupByPath] = useState<
    Record<string, string | null>
  >({});
  const hasPathSelection = Object.prototype.hasOwnProperty.call(
    openGroupByPath,
    pathname,
  );
  const openGroupTitle = hasPathSelection
    ? openGroupByPath[pathname]
    : (activeGroupTitle ?? groups[0]?.title ?? null);

  return (
    <div className={cn("coop-navigation", styles.sidebar)}>
      <Link
        href={roleHomePaths[role]}
        className={styles.brand}
        onClick={onNavigate}
      >
        <span className={styles.logo}>
          <Image
            src="/trackcoop-logo.svg"
            alt="TrackCOOP logo"
            fill
            unoptimized
            sizes="44px"
            className="object-contain"
          />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>TrackCOOP</span>
          <span className={styles.role}>
            {role === "chairman" ? "Chairman Portal" : "Bookkeeper Portal"}
          </span>
        </span>
      </Link>

      <nav
        className={styles.navigation}
        aria-label={`${role === "chairman" ? "Chairman" : role === "bookkeeper" ? "Bookkeeper" : "Member"} navigation`}
      >
        {groups.map((group, index) => {
          const isOpen = openGroupTitle === group.title;
          const isCurrentGroup = activeGroupTitle === group.title;
          const triggerId = `${navigationId}-trigger-${index}`;
          const panelId = `${navigationId}-group-${index}`;

          return (
            <section
              key={group.title}
              className={styles.group}
              data-open={isOpen}
              data-current={isCurrentGroup}
            >
              <button
                id={triggerId}
                type="button"
                onClick={() =>
                  setOpenGroupByPath((current) => ({
                    ...current,
                    [pathname]: isOpen ? null : group.title,
                  }))
                }
                className={styles.groupTrigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                <span className={styles.groupTitle}>
                  {group.title}
                  <span className={styles.groupMarker} aria-hidden="true" />
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
              <div
                id={panelId}
                className={styles.groupPanel}
                data-open={isOpen}
                aria-labelledby={triggerId}
                aria-hidden={!isOpen}
                inert={!isOpen}
              >
                <div className={styles.groupClip}>
                  <ul className={styles.linkList}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={styles.link}
                            data-active={active}
                            title={item.label}
                          >
                            <Icon
                              className={styles.itemIcon}
                              aria-hidden="true"
                            />
                            <span className={styles.linkLabel}>
                              {item.label}
                            </span>
                            <span
                              className={styles.linkMarker}
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </nav>
    </div>
  );
}

export function PortalSidebar({
  role,
  isMobileOpen,
  onMobileClose,
}: PortalSidebarProps) {
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) onMobileClose();
    };
    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, [onMobileClose]);

  return (
    <>
      <aside
        className={styles.desktop}
        aria-label={`${role === "chairman" ? "Chairman" : role === "bookkeeper" ? "Bookkeeper" : "Member"} sidebar`}
      >
        <SidebarContent role={role} />
      </aside>

      <Dialog.Root
        open={isMobileOpen}
        onOpenChange={(open) => {
          if (!open) onMobileClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            id="portal-mobile-navigation"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("portal-navigation-trigger")?.focus();
            }}
            className={styles.mobileDrawer}
          >
            <Dialog.Title className="sr-only">Portal navigation</Dialog.Title>
            <Dialog.Close
              aria-label="Close navigation"
              className={cn("coop-icon-button", styles.close)}
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
            <SidebarContent role={role} onNavigate={onMobileClose} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
