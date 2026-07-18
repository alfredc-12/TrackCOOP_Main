"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schema";
import type { AuthUser } from "@/features/auth/types";
import { login } from "@/lib/auth-client";
import { ApiClientError } from "@/lib/api-client";

const roleDestinations: Record<AuthUser["role"], string> = {
  chairman: "/chairman_dashboard",
  bookkeeper: "/bookkeeper_dashboard",
  member: "/member_dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError("");

    try {
      const user = await login(values);
      router.replace(roleDestinations[user.role]);
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
    <main className="min-h-screen bg-[#F8F1E5] text-[#17211C] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          src="/images/Hero Page/Main Photo 4.jpg"
          alt="TrackCOOP cooperative members"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#123D2A]/58" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DCEB9A]">
            Cooperative operations
          </p>
          <p className="mt-4 max-w-xl text-3xl font-semibold leading-tight">
            Shared records, clearer service, and accountable cooperative work.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[#365F4A] transition hover:text-[#123D2A]"
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

          <h1 className="mt-10 text-4xl font-bold text-[#123D2A]">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
            Use the email address or username assigned to your cooperative account.
          </p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
              Email or username
              <input
                {...register("identifier")}
                autoComplete="username"
                aria-invalid={Boolean(errors.identifier)}
                className="h-12 rounded-md border border-[#BFD1C2] bg-white px-4 text-[#17211C] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25"
              />
              {errors.identifier ? (
                <span className="text-xs font-medium text-[#A33A2B]">
                  {errors.identifier.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
              Password
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className="h-12 rounded-md border border-[#BFD1C2] bg-white px-4 text-[#17211C] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25"
              />
              {errors.password ? (
                <span className="text-xs font-medium text-[#A33A2B]">
                  {errors.password.message}
                </span>
              ) : null}
            </label>

            {formError ? (
              <p
                role="alert"
                className="border-l-4 border-[#C25C3C] bg-[#FFF4EC] px-4 py-3 text-sm text-[#7A3023]"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white transition hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] disabled:cursor-wait disabled:opacity-65"
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 border-t border-[#CAD8CB] pt-6 text-sm leading-6 text-[#5D6D63]">
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
