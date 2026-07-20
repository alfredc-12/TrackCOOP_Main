"use client";

import { useMemo, useState } from "react";

export function useRentalFilters<T>(items: T[], searchable: (item: T) => string) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => searchable(item).toLowerCase().includes(term)) : items;
  }, [items, search, searchable]);
  return { search, setSearch, filtered };
}
