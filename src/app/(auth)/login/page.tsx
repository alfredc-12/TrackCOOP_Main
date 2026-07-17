import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f3] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4d8f5b]">
          TrackCOOP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Welcome back</h1>
        <form className="mt-6 grid gap-4">
          <Input label="Email" name="email" type="email" placeholder="admin@trackcoop.local" />
          <Input label="Password" name="password" type="password" placeholder="Password" />
          <Button type="submit">Login</Button>
        </form>
        <p className="mt-5 text-sm text-[#657169]">
          New workspace?{" "}
          <Link href="/register" className="font-semibold text-[#17211c]">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
