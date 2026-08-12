"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Package, Search, LayoutGrid, List, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

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

        <div className="sticky top-0 z-20 mb-6 flex flex-col gap-4 bg-[#f8faf5]/90 pt-2 pb-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7d9a89]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search products..."
              className="w-full rounded-full border border-[#d8e4d6] bg-white py-3 pl-12 pr-4 text-sm text-[#123D2A] outline-none shadow-sm transition focus:border-[#0f7a46] focus:ring-2 focus:ring-[#0f7a46]/15"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setCurrentPage(1);
                  }}
                  className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                    selectedCategory === category
                      ? "bg-[#123D2A] text-white shadow-md scale-105"
                      : "bg-white text-[#365944] hover:bg-[#edf5ed] hover:shadow-sm"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-[#d8e4d6] bg-white p-1 shadow-sm hidden sm:flex">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 transition ${viewMode === "grid" ? "bg-[#eef4ef] text-[#123D2A]" : "text-[#7d9a89] hover:text-[#123D2A]"}`}
                title="Grid View"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 transition ${viewMode === "list" ? "bg-[#eef4ef] text-[#123D2A]" : "text-[#7d9a89] hover:text-[#123D2A]"}`}
                title="List View"
              >
                <List className="size-4" />
              </button>
            </div>
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
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-[#d8e4d6] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#eef4ef] text-xs uppercase text-[#365944]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Product</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Price</th>
                    <th className="px-6 py-4 font-bold">Stock</th>
                    <th className="px-6 py-4 font-bold">Reserved</th>
                    <th className="px-6 py-4 font-bold">Available</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8e4d6]">
                  {filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => {
                    const available = item.stock - (item.pending_qty ?? 0);
                    return (
                      <tr key={item.id} className="transition hover:bg-[#f8faf5]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 overflow-hidden rounded-lg bg-[#eef4ef] flex-shrink-0">
                              {item.img ? (
                                <img src={item.img} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="m-auto mt-2.5 size-5 text-[#9bb4a4]" />
                              )}
                            </div>
                            <span className="font-bold text-[#123D2A]">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#7d9a89]">{item.category}</td>
                        <td className="px-6 py-4 font-black text-[#123D2A]">P {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 font-semibold text-[#123D2A]">{formatQuantityUnit(item.stock, item.unit)}</td>
                        <td className="px-6 py-4 font-semibold text-orange-600">{formatQuantityUnit(item.pending_qty ?? 0, item.unit)}</td>
                        <td className="px-6 py-4 font-bold text-[#123D2A]">{formatQuantityUnit(available, item.unit)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${item.status === 'Available' ? 'bg-[#eef4ef] text-[#0f7a46]' : 'bg-red-50 text-red-600'}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => {
              const available = item.stock - (item.pending_qty ?? 0);

              return (
                <article key={item.id} className="group overflow-hidden rounded-2xl border border-[#d8e4d6] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(18,61,42,0.12)]">
                  <div className="relative flex h-48 items-center justify-center bg-[#eef4ef] overflow-hidden">
                    {item.img ? (
                      <img src={item.img} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <ImageIcon className="size-14 text-[#9bb4a4] transition-transform duration-500 group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    <span className={`absolute left-4 top-4 rounded-md backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${item.status === 'Available' ? 'bg-white/90 text-[#0f7a46]' : 'bg-red-500/90 text-white'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-[#123D2A] transition-colors group-hover:text-[#0f7a46]">{item.name}</h2>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#7d9a89]">{item.category}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8faf5] px-3 py-1.5 border border-[#eef4ef]">
                        <p className="whitespace-nowrap text-sm font-black text-[#123D2A]">
                          P {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <p className="mb-5 min-h-10 text-sm text-[#607a6b] line-clamp-2">{item.description || "No description provided."}</p>
                    <div className="grid grid-cols-3 gap-3 text-sm rounded-xl bg-[#f8faf5] p-3 border border-[#eef4ef]">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#7d9a89] mb-0.5">Stock</p>
                        <p className="font-black text-[#123D2A]">{formatQuantityUnit(item.stock, item.unit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#7d9a89] mb-0.5">Reserved</p>
                        <p className="font-black text-orange-600">{formatQuantityUnit(item.pending_qty ?? 0, item.unit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#7d9a89] mb-0.5">Available</p>
                        <p className="font-black text-[#0f7a46]">{formatQuantityUnit(available, item.unit)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && filteredProducts.length > 0 && (
          <div className="mt-8 flex items-center justify-center border-t border-[#d8e4d6] pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#d8e4d6] bg-white text-[#365944] shadow-sm transition hover:bg-[#eef4ef] hover:text-[#123D2A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="size-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#d8e4d6] bg-white text-[#365944] shadow-sm transition hover:bg-[#eef4ef] hover:text-[#123D2A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-4" />
                </button>
              </div>

              <div className="text-sm font-semibold text-[#123D2A]">
                Page {currentPage} of {Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage))} <span className="text-[#a4b8ab] mx-1">•</span> {filteredProducts.length} products
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage) || filteredProducts.length === 0}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#d8e4d6] bg-white text-[#365944] shadow-sm transition hover:bg-[#eef4ef] hover:text-[#123D2A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage) || filteredProducts.length === 0}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#d8e4d6] bg-white text-[#365944] shadow-sm transition hover:bg-[#eef4ef] hover:text-[#123D2A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
