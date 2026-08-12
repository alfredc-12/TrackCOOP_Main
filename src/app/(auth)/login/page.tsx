"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, LogIn, Eye, EyeOff, AlertCircle, X, Keyboard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schema";
import type { AuthUser } from "@/features/auth/types";
import { getOptionalAuthenticatedUser, login } from "@/lib/auth-client";
import { ApiClientError } from "@/lib/api-client";

const roleDestinations: Record<AuthUser["role"], string> = {
  chairman: "/portal/chairman/dashboard",
  bookkeeper: "/portal/bookkeeper/dashboard",
  member: "/portal/member/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

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
    try {
      const stored = localStorage.getItem("trackcoop_saved_logins");
      if (stored) {
        setSavedEmails(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setCapsLockOn(e.getModifierState("CapsLock"));
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyDown);
    };
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
      } catch (e) {
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
    <main className="h-screen overflow-hidden bg-gray-50 text-[#17211C] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(30rem,0.9fr)]">
      <section className="relative hidden h-full overflow-hidden lg:block">
        <Image
          src="/images/Hero Page/Main Photo 4.jpg"
          alt="TrackCOOP cooperative members"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#123D2A]/60 backdrop-blur-[2px]" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DCEB9A]">
            Cooperative operations
          </p>
          <p className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-white/95">
            Shared records, clearer service, and accountable cooperative work.
          </p>
        </div>
      </section>

      <section className="flex h-full overflow-hidden items-center px-5 py-4 sm:px-10 lg:px-14 xl:px-20 relative bg-[#F8F1E5]/30">
        <div className="absolute inset-0 bg-white/50 backdrop-blur-3xl -z-10" />
        <div className="mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#365F4A] transition hover:text-[#123D2A]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to the cooperative site
          </Link>

          <div className="flex items-center gap-3">
            <span className="relative block size-12 overflow-hidden">
              <Image
                src="/trackcoop-logo.svg"
                alt="TrackCOOP logo"
                fill
                unoptimized
                sizes="48px"
                className="object-contain"
              />
            </span>
            <div>
              <p className="text-xl font-bold text-[#123D2A]">TrackCOOP</p>
              <p className="text-xs italic text-[#4B6B5A]">
                Cooperative Management System
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
            <p className="text-sm font-semibold text-[#365F4A] mb-1">{getGreeting()}</p>
            <h1 className="text-3xl font-black text-[#123D2A] tracking-tight">Sign in to your account</h1>
            <p className="mt-2 text-sm leading-5 text-[#5D6D63]">
              Use the email address or username assigned to your cooperative account.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
                Email or username
                <input
                  {...register("identifier")}
                  autoComplete="username"
                  aria-invalid={Boolean(errors.identifier)}
                  className="h-12 rounded-xl border border-[#BFD1C2]/60 bg-gray-50/50 px-4 text-[#17211C] outline-none transition-all focus:bg-white focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20 shadow-sm"
                />
                {errors.identifier ? (
                  <span className="text-xs font-medium text-[#A33A2B] flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3" /> {errors.identifier.message}
                  </span>
                ) : null}
                {savedEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs text-gray-500 mr-1 mt-1 shrink-0">Recent:</span>
                    {savedEmails.map((email) => (
                      <div key={email} className="inline-flex items-center bg-[#1F6B43]/10 rounded-full border border-[#1F6B43]/20 hover:bg-[#1F6B43]/20 transition-colors">
                        <button
                          type="button"
                          onClick={() => setValue("identifier", email)}
                          className="px-3 py-1 text-xs font-medium text-[#123D2A]"
                        >
                          {email}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSavedEmail(email)}
                          className="pr-2 py-1 text-[#123D2A]/60 hover:text-[#A33A2B] transition-colors"
                          aria-label="Remove saved email"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
                <div className="flex items-center justify-between">
                  <span>Password</span>
                </div>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    className="h-12 w-full rounded-xl border border-[#BFD1C2]/60 bg-gray-50/50 px-4 pr-12 text-[#17211C] outline-none transition-all focus:bg-white focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-[#123D2A] transition-colors focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <span className="text-xs font-medium text-[#A33A2B] flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3" /> {errors.password.message}
                  </span>
                ) : capsLockOn ? (
                  <span className="text-xs font-medium text-[#A33A2B] flex items-center gap-1 mt-1">
                    <Keyboard className="size-3" /> Caps Lock is on
                  </span>
                ) : null}
              </label>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-[#C25C3C]/30 bg-[#FFF4EC] px-4 py-3 text-sm text-[#7A3023] flex items-start gap-2 animate-in fade-in slide-in-from-top-1 mt-1"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123D2A] px-5 text-sm font-bold text-white shadow-md shadow-[#123D2A]/20 transition-all hover:bg-[#1F6B43] hover:shadow-lg hover:shadow-[#1F6B43]/30 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0 disabled:hover:shadow-md"
              >
                {isSubmitting ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <LogIn className="size-4" aria-hidden="true" />
                )}
                {isSubmitting ? "Signing in to TrackCOOP..." : "Sign in to account"}
              </button>
            </form>
          </div>

          <p className="mt-6 border-t border-[#CAD8CB] pt-4 text-sm leading-6 text-[#5D6D63]">
            Need an account? Contact the Chairman or send a request through the{" "}
            <Link href="/contact" className="font-bold text-[#1F6B43] underline underline-offset-4">
              cooperative contact page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
