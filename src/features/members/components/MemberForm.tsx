"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { memberSchema, type MemberInput } from "../schema";

export function MemberForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit(() => undefined)}
    >
      <Input label="Name" placeholder="Cooperative name" {...register("name")} />
      {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
      <Input label="Sector" placeholder="Agriculture" {...register("sector")} />
      <Input label="Location" placeholder="Province or city" {...register("location")} />
      <Button type="submit">Save member</Button>
    </form>
  );
}
