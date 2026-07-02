import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#17211c] px-5 py-10 text-[#17211c]">
      <section className="w-full max-w-lg rounded-lg bg-[#f7f8f3] p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4d8f5b]">
          Start TrackCOOP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Register cooperative</h1>
        <form className="mt-6 grid gap-4">
          <Input label="Cooperative name" name="coop" placeholder="Greenfields MPC" />
          <Input label="Admin email" name="email" type="email" placeholder="admin@coop.ph" />
          <Input label="Password" name="password" type="password" placeholder="Password" />
          <Button type="submit">Create workspace</Button>
        </form>
        <p className="mt-5 text-sm text-[#657169]">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-[#17211c]">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
