"use client";

import { useEffect, useState } from "react";

export function useRentalData<T>(loader: () => Promise<T>, dependencies: React.DependencyList = []) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    loader()
      .then((result) => { if (active) setData(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Rental data could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // The caller owns stable loader dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);

  return {
    data,
    loading,
    error,
    refresh: () => {
      setLoading(true);
      setError(undefined);
      setRevision((value) => value + 1);
    },
    setData,
  };
}
