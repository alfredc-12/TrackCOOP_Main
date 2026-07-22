"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Package, Search } from "lucide-react";

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  description: string;
  stock: number;
  pending_qty?: number;
  status: string;
  img: string;
};

function formatQuantityUnit(quantity: number | string, unit?: string) {
  return `${Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || "piece"}`;
}

export default function ProductCatalogClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) {
        setInventory([]);
        return;
      }

      setInventory((await response.json()) as InventoryItem[]);
    } catch (error) {
      console.error("Failed to fetch products", error);
      setInventory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchProducts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(inventory.map((item) => item.category))).sort()],
    [inventory],
  );

  const filteredProducts = inventory.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  return (
    <main className="flex-1 overflow-y-auto bg-[#f8faf5] p-6 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 border-b border-[#d8e4d6] pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#c78800]">Operations</p>
          <h1 className="text-4xl font-black tracking-tight text-[#09351f]">Products</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#365944]">
            Product catalog records that feed Inventory, POS Sales, member ordering, and the cooperative store.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7d9a89]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-[#d8e4d6] bg-white py-3 pl-12 pr-4 text-sm text-[#123D2A] outline-none transition focus:border-[#0f7a46] focus:ring-2 focus:ring-[#0f7a46]/15"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? "bg-[#123D2A] text-white shadow-sm"
                    : "bg-white text-[#365944] hover:bg-[#edf5ed]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-[#d8e4d6] bg-white p-12 text-center text-sm font-semibold text-[#607a6b]">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#b9cdbc] bg-white p-12 text-center">
            <Package className="mx-auto mb-3 size-10 text-[#9bb4a4]" />
            <h2 className="text-lg font-bold text-[#123D2A]">No products found</h2>
            <p className="mt-1 text-sm text-[#607a6b]">Try a different search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((item) => {
              const available = item.stock - (item.pending_qty ?? 0);

              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-[#d8e4d6] bg-white shadow-sm">
                  <div className="relative flex h-44 items-center justify-center bg-[#eef4ef]">
                    {item.img ? (
                      <img src={item.img} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="size-14 text-[#9bb4a4]" />
                    )}
                    <span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1 text-xs font-bold text-[#123D2A] shadow-sm">
                      {item.status}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-[#123D2A]">{item.name}</h2>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#7d9a89]">{item.category}</p>
                      </div>
                      <p className="whitespace-nowrap text-sm font-black text-[#123D2A]">
                        P {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <p className="mb-5 min-h-10 text-sm text-[#607a6b]">{item.description || "No description provided."}</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-[#7d9a89]">Stock</p>
                        <p className="font-black text-[#123D2A]">{formatQuantityUnit(item.stock, item.unit)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#7d9a89]">Reserved</p>
                        <p className="font-black text-[#123D2A]">{formatQuantityUnit(item.pending_qty ?? 0, item.unit)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#7d9a89]">Available</p>
                        <p className="font-black text-[#123D2A]">{formatQuantityUnit(available, item.unit)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
