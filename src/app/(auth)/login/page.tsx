"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LogIn, Eye, EyeOff, AlertCircle, X, Keyboard, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schema";
import type { AuthUser } from "@/features/auth/types";
import { getOptionalAuthenticatedUser, login } from "@/lib/auth-client";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import styles from "./LoginPage.module.css";

const roleDestinations: Record<AuthUser["role"], string> = {
  chairman: "/portal/chairman/dashboard",
  bookkeeper: "/portal/bookkeeper/financial-dashboard",
  member: "/portal/member/dashboard",
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back");
  const recentAccountsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = recentAccountsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = recentAccountsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGreeting(getTimeGreeting());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const removeSavedEmail = (emailToRemove: string) => {
    const newEmails = savedEmails.filter(e => e !== emailToRemove);
    setSavedEmails(newEmails);
    localStorage.setItem("trackcoop_saved_logins", JSON.stringify(newEmails));
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    let active = true;

    getOptionalAuthenticatedUser()
      .then((user) => {
        if (active && user) {
          if (user.mustChangePassword) {
            router.replace("/force-change-password");
          } else {
            router.replace(roleDestinations[user.role]);
          }
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const savedEmailsFrame = window.requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem("trackcoop_saved_logins");
        if (stored) {
          setSavedEmails(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    });

    try {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.getModifierState) {
          setCapsLockOn(event.getModifierState("CapsLock"));
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyDown);

      return () => {
        window.cancelAnimationFrame(savedEmailsFrame);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyDown);
      };
    } catch {
      return () => {
        window.cancelAnimationFrame(savedEmailsFrame);
      }
    }
  }, []);

  async function onSubmit(values: LoginFormValues) {
    setFormError("");

    try {
      const user = await login(values);
      
      // Save email for suggestions
      try {
        const stored = localStorage.getItem("trackcoop_saved_logins");
        let emails = stored ? JSON.parse(stored) : [];
        if (!emails.includes(values.identifier)) {
          emails.unshift(values.identifier);
          if (emails.length > 3) emails = emails.slice(0, 3);
          localStorage.setItem("trackcoop_saved_logins", JSON.stringify(emails));
          setSavedEmails(emails);
        }
      } catch {
        // ignore
      }

      if (user.mustChangePassword) {
        router.replace("/force-change-password");
      } else {
        router.replace(roleDestinations[user.role]);
      }
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : "Sign in could not be completed. Please try again.",
      );
    }
  }

  return (
    <main className="min-h-svh bg-coop-canvas text-coop-ink">
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
        <section aria-label="Our cooperative" className="relative hidden overflow-hidden bg-coop-forest lg:sticky lg:top-0 lg:block lg:h-svh">
          <Image
            src="/images/Hero Page/Main Photo 4.jpg"
            alt="TrackCOOP cooperative members"
            fill
            preload
            sizes="(min-width:1680px) 800px, 50vw"
            className="object-cover object-center"
          />
          <div aria-hidden="true" className={styles.photoScrim} />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white xl:p-10">
            <p className="max-w-lg text-[clamp(1.75rem,2.5vw,2.25rem)] font-semibold leading-tight text-pretty">
              Shared records, clearer service, and accountable cooperative work.
            </p>
          </div>
        </section>

        <section aria-label="Account sign in" className="flex min-h-svh min-w-0 flex-col justify-center px-4 py-4 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-md">
            <Link href="/" className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-coop-secondary transition-colors hover:text-coop-green">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to the cooperative site
            </Link>

            <div className={`${styles.card} coop-panel p-5`}>
              <div className="flex items-center gap-3">
                <span className="relative block size-9 shrink-0">
                  <Image src="/trackcoop-logo.svg" alt="TrackCOOP logo" fill unoptimized sizes="36px" className="object-contain" />
                </span>
                <div className="min-w-0">
                  <p translate="no" className="text-xl font-bold leading-tight text-coop-forest">TrackCOOP</p>
                  <p className="mt-0.5 text-xs leading-4 text-coop-secondary">Cooperative Management System</p>
                </div>
              </div>

              <header className="mt-4">
                <p className="text-sm text-coop-muted">{greeting}</p>
                <h1 className="mt-1 text-[1.625rem] font-bold leading-tight tracking-tight text-coop-forest sm:text-[1.75rem]">Sign in to your account</h1>
                <p className="mt-1.5 text-sm leading-5 text-coop-muted">Use your assigned email address or username.</p>
              </header>

              <form className="mt-4 grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor="login-identifier" className="text-sm font-semibold text-coop-body">Email or username</label>
                  <input
                    {...register("identifier")}
                    id="login-identifier"
                    suppressHydrationWarning
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={errors.identifier ? "login-identifier-error" : undefined}
                    className="coop-field h-11 w-full min-w-0 rounded-coop-control border border-coop-border bg-coop-field px-3 text-base text-coop-ink outline-none focus:border-coop-green focus:ring-2 focus:ring-coop-green/15"
                  />
                  {errors.identifier && <p id="login-identifier-error" aria-live="polite" className="flex items-start gap-1.5 text-sm text-coop-danger"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{errors.identifier.message}</p>}
                </div>

                {savedEmails.length > 0 && <details ref={recentAccountsRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }} className="group relative min-w-0 rounded-lg bg-coop-workspace px-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-coop-secondary [&::-webkit-details-marker]:hidden">
                    <span>Recent accounts</span>
                    <span className="inline-flex items-center gap-2 text-xs text-coop-muted">{savedEmails.length} saved<ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></span>
                  </summary>
                  <ul className="absolute inset-x-0 top-full z-20 mt-1.5 grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-coop-border bg-coop-surface p-2 shadow-coop-floating">
                    {savedEmails.map((email) => <li key={email} className="flex min-w-0 items-center rounded-md bg-coop-surface">
                      <button type="button" onClick={() => { setValue("identifier", email); if (recentAccountsRef.current) recentAccountsRef.current.open = false; document.getElementById("login-password")?.focus(); }} title={email} className="min-h-11 min-w-0 flex-1 truncate rounded-md px-3 text-left text-sm text-coop-forest transition-colors hover:bg-coop-sage">{email}</button>
                      <button type="button" onClick={() => { removeSavedEmail(email); if (recentAccountsRef.current) recentAccountsRef.current.open = false; if (savedEmails.length === 1) document.getElementById("login-identifier")?.focus(); else recentAccountsRef.current?.querySelector("summary")?.focus(); }} aria-label={`Remove saved account ${email}`} className="grid size-11 shrink-0 place-items-center rounded-md text-coop-muted transition-colors hover:bg-coop-danger-bg hover:text-coop-danger"><X aria-hidden="true" className="size-4" /></button>
                    </li>)}
                  </ul>
                </details>}

                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor="login-password" className="text-sm font-semibold text-coop-body">Password</label>
                  <div className="relative">
                    <input
                      {...register("password")}
                      id="login-password"
                      suppressHydrationWarning
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? "login-password-error" : capsLockOn ? "login-caps-lock" : undefined}
                      className="coop-field h-11 w-full min-w-0 rounded-coop-control border border-coop-border bg-coop-field pl-3 pr-12 text-base text-coop-ink outline-none focus:border-coop-green focus:ring-2 focus:ring-coop-green/15"
                    />
                    <button type="button" suppressHydrationWarning onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-coop-control text-coop-secondary transition-colors hover:bg-coop-subtle">
                      {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                    </button>
                  </div>
                  {errors.password ? <p id="login-password-error" aria-live="polite" className="flex items-start gap-1.5 text-sm text-coop-danger"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{errors.password.message}</p>
                    : capsLockOn ? <p id="login-caps-lock" aria-live="polite" className="flex items-center gap-1.5 text-sm text-coop-danger"><Keyboard aria-hidden="true" className="size-4" />Caps Lock is on</p> : null}
                </div>

                {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-coop-danger-bg p-3 text-sm leading-6 text-coop-danger"><AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{formError}</span></p>}

                <Button type="submit" loading={isSubmitting} loadingLabel="Signing in to TrackCOOP..." aria-label={isSubmitting ? "Signing in to TrackCOOP..." : undefined} className="h-11 w-full text-base">
                  <LogIn aria-hidden="true" className="size-4" />Sign in to account
                </Button>
              </form>

              <p className="mt-4 border-t border-coop-border pt-3 text-sm leading-5 text-coop-muted">
                Need an account? Contact the Chairman or send a request through the{" "}
                <Link href="/contact" className="font-semibold text-coop-green underline underline-offset-4">cooperative contact page</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
