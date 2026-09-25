"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Package, Search, LayoutGrid, List, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, AlertCircle, Sprout, Eye, X, History } from "lucide-react";
import { expressFetch } from "@/lib/express-api";

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

function CatalogThemedSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return <div className="relative"><button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} className="flex min-w-[150px] items-center justify-between gap-4 rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"><span>{selected}</span><ChevronDown className={`size-4 text-[#52705D] transition ${open ? "rotate-180" : ""}`} /></button>{open && <div role="listbox" className="absolute left-0 top-full z-[80] mt-2 min-w-full overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button type="button" role="option" aria-selected={value === option.value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition ${value === option.value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>{option.label}{value === option.value && <span className="text-lg text-[#1F6B43]">✓</span>}</button>)}</div>}</div>;
}

function formatQuantityUnit(quantity: number | string, unit?: string) {
  return `${Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || "piece"}`;
}

export default function ProductCatalogClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("name-asc");
  const [statusFilter, setStatusFilter] = useState("All");
  const [detailsProduct, setDetailsProduct] = useState<InventoryItem | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchProducts = useCallback(async () => {
    try {
      const response = await expressFetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load products.");
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("Products could not be loaded.");
      setInventory(payload as InventoryItem[]);
      setLoadError("");
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch products", error);
      setLoadError("Products could not be loaded. Please try again.");
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

  const refreshProducts = async () => {
    setIsRefreshing(true);
    await fetchProducts();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (!detailsProduct) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsProduct(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailsProduct]);

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

    return matchesCategory && matchesSearch && (statusFilter === "All" || item.status === statusFilter);
  }).sort((a, b) => {
    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    if (sortBy === "stock-asc") return a.stock - b.stock;
    if (sortBy === "stock-desc") return b.stock - a.stock;
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const hasActiveFilters = searchQuery.trim() !== "" || selectedCategory !== "All" || statusFilter !== "All" || sortBy !== "name-asc";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setStatusFilter("All");
    setSortBy("name-asc");
    setCurrentPage(1);
  };
  const availableProducts = inventory.filter((item) => item.status === "Available").length;
  const unavailableProducts = inventory.filter((item) => item.status !== "Available").length;
  const totalCatalogValue = inventory.reduce((sum, item) => sum + item.price * item.stock, 0);

  return (
    <main className={`-mx-4 -my-6 flex-1 bg-[#F5F8F3] p-4 sm:-mx-6 sm:p-5 lg:-mx-8 lg:-my-8 lg:p-6 ${detailsProduct ? "overflow-hidden" : "overflow-y-auto"}`}>
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-6 text-white shadow-[0_16px_34px_rgba(13,67,45,0.24)] sm:px-8 sm:py-7">
          <div className="absolute -right-10 -top-16 size-56 rounded-full border-[22px] border-[#D8F0DE]/10" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F6D354]"><span className="h-2 w-2 rounded-full bg-[#F6D354]" /> Cooperative operations</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Product Catalog</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Browse products used by Inventory, POS Sales, and member ordering.</p></div><div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[#CDE8D4]/20 bg-[#D8F0DE]/10 px-4 py-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#F6D354] text-[#0D432D]"><Sprout className="size-5" /></div><div><p className="text-xs font-semibold text-white/60">Catalog health</p><p className="font-bold">{unavailableProducts ? `${unavailableProducts} unavailable` : "All products available"}</p></div></div></div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Total Products", inventory.length, "Catalog items"], ["Available", availableProducts, "Ready to order"], ["Unavailable", unavailableProducts, "Needs attention"], ["Catalog Value", `₱ ${totalCatalogValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Based on stock"]].map(([label, value, hint]) => <div key={String(label)} className="flex min-h-[112px] items-center gap-3 rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5"><div className="rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]"><Package className="size-5" /></div><div><p className="text-xs font-bold text-gray-500">{label}</p><p className="text-[10px] text-gray-400">{hint}</p><p className="break-words text-xl font-black text-[#123D2A]">{value}</p></div></div>)}
        </div>

        <div className="sticky top-0 z-20 mb-6 rounded-2xl border border-[#DCE9DE] bg-white/90 p-4 shadow-sm backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7d9a89]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search products..."
              className="w-full rounded-xl border border-[#d8e4d6] bg-[#F8FBF8] py-3 pl-12 pr-4 text-sm text-[#123D2A] outline-none transition focus:border-[#0f7a46] focus:ring-2 focus:ring-[#0f7a46]/15"
            />
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <CatalogThemedSelect value={statusFilter} onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }} ariaLabel="Filter product status" options={[{ value: "All", label: "All status" }, { value: "Available", label: "Available" }, { value: "Unavailable", label: "Unavailable" }]} />
            <CatalogThemedSelect value={sortBy} onChange={(value) => { setSortBy(value); setCurrentPage(1); }} ariaLabel="Sort products" options={[{ value: "name-asc", label: "Name (A–Z)" }, { value: "price-asc", label: "Price (low to high)" }, { value: "price-desc", label: "Price (high to low)" }, { value: "stock-asc", label: "Stock (low to high)" }, { value: "stock-desc", label: "Stock (high to low)" }]} />
            <button type="button" onClick={() => void refreshProducts()} disabled={isRefreshing} aria-busy={isRefreshing} className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60"><RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">{isRefreshing ? "Refreshing..." : "Refresh"}</span></button>
          </div>
          </div>

          <div className="mt-3 flex min-w-0 items-center justify-between gap-4 border-t border-[#EEF4EF] pt-3">
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
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={`rounded-lg p-2 transition ${viewMode === "grid" ? "bg-[#eef4ef] text-[#123D2A]" : "text-[#7d9a89] hover:text-[#123D2A]"}`}
                title="Grid View"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={`rounded-lg p-2 transition ${viewMode === "list" ? "bg-[#eef4ef] text-[#123D2A]" : "text-[#7d9a89] hover:text-[#123D2A]"}`}
                title="List View"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#EEF4EF] pt-3 text-xs font-medium text-[#789181]"><span>Showing {filteredProducts.length} products{lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>{hasActiveFilters && <button type="button" onClick={clearFilters} className="font-bold text-[#1F6B43] hover:underline">Clear filters</button>}</div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[#d8e4d6] bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#607a6b]"><RefreshCw className="size-5 animate-spin text-[#1F6B43]" /> Loading products...</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-[#EEF5EF]" />)}</div></div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm"><AlertCircle className="mx-auto mb-3 size-10 text-red-500" /><h2 className="text-lg font-bold text-[#123D2A]">Unable to load products</h2><p className="mt-1 text-sm text-[#607a6b]">{loadError}</p><button type="button" onClick={() => void refreshProducts()} className="mt-5 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1F6B43]">Try again</button></div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#b9cdbc] bg-white p-12 text-center">
            <Package className="mx-auto mb-3 size-10 text-[#9bb4a4]" />
            <h2 className="text-lg font-bold text-[#123D2A]">No products found</h2>
            <p className="mt-1 text-sm text-[#607a6b]">Try a different search or category filter.</p>
            {hasActiveFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1F6B43]">Clear Filters</button>}
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-[#d8e4d6] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Product catalog list</caption>
                <thead className="bg-[#eef4ef] text-xs uppercase text-[#365944]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Product</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Price</th>
                    <th className="px-6 py-4 font-bold">Stock</th>
                    <th className="px-6 py-4 font-bold">Reserved</th>
                    <th className="px-6 py-4 font-bold">Available</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8e4d6]">
                  {filteredProducts.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage).map((item) => {
                    const available = item.stock - (item.pending_qty ?? 0);
                    return (
                      <tr key={item.id} className="transition hover:bg-[#f8faf5]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 overflow-hidden rounded-lg bg-[#eef4ef] flex-shrink-0">
                              {item.img && !brokenImageIds.has(item.id) ? (
                                <img src={item.img} alt={item.name} onError={() => setBrokenImageIds((ids) => new Set(ids).add(item.id))} className="h-full w-full object-cover" />
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
                        <td className="px-6 py-4 text-right"><button type="button" onClick={() => setDetailsProduct(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e4d6] bg-white px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#edf5ed]" aria-label={`View details for ${item.name}`}><Eye className="size-3.5" /> Details</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage).map((item) => {
              const available = item.stock - (item.pending_qty ?? 0);

              return (
                <article key={item.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#d8e4d6] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(18,61,42,0.12)]">
                  <div className="relative flex h-48 items-center justify-center bg-[#eef4ef] overflow-hidden">
                    {item.img && !brokenImageIds.has(item.id) ? (
                      <img src={item.img} alt={item.name} onError={() => setBrokenImageIds((ids) => new Set(ids).add(item.id))} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <ImageIcon className="size-14 text-[#9bb4a4] transition-transform duration-500 group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    <button type="button" onClick={() => setDetailsProduct(item)} aria-label={`View stock history for ${item.name}`} title="View stock history" className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-[#1F6B43]">
                      <History className="size-4" aria-hidden="true" />
                    </button>
                    <span className={`absolute left-4 top-4 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${item.status === 'Available' ? 'bg-[#22c55e] text-white' : 'bg-[#ef4444] text-white'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="min-h-14 text-lg font-black leading-7 text-[#123D2A] transition-colors group-hover:text-[#0f7a46]">{item.name}</h2>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#7d9a89]">{item.category}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8faf5] px-3 py-1.5 border border-[#eef4ef]">
                        <p className="whitespace-nowrap text-sm font-black text-[#123D2A]">
                          P {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <p className="mb-5 min-h-10 text-sm text-[#607a6b] line-clamp-2">{item.description || "No description provided."}</p>
                    <button type="button" onClick={() => setDetailsProduct(item)} className="mb-4 mt-auto inline-flex items-center gap-2 text-sm font-bold text-[#1F6B43] transition hover:text-[#123D2A]"><Eye className="size-4" /> View product details</button>
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

        {detailsProduct && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Product details">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center justify-between border-b border-[#DDE9E0] p-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#789181]">Product details</p><h2 className="mt-1 text-xl font-black text-[#123D2A]">{detailsProduct.name}</h2></div><button type="button" onClick={() => setDetailsProduct(null)} className="rounded-full p-2 text-gray-400 hover:bg-[#EAF5EC] hover:text-[#123D2A]" aria-label="Close product details"><X className="size-5" /></button></div>
              <div className="p-5"><div className="mb-5 flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF5EF]">{detailsProduct.img ? <img src={detailsProduct.img} alt={detailsProduct.name} className="h-full w-full object-cover" /> : <ImageIcon className="size-14 text-[#9bb4a4]" />}</div><p className="text-sm leading-6 text-[#607a6b]">{detailsProduct.description || "No description provided."}</p><div className="mt-5 grid grid-cols-2 gap-3">{[["Category", detailsProduct.category], ["Status", detailsProduct.status], ["Stock", formatQuantityUnit(detailsProduct.stock, detailsProduct.unit)], ["Reserved", formatQuantityUnit(detailsProduct.pending_qty ?? 0, detailsProduct.unit)], ["Available", formatQuantityUnit(detailsProduct.stock - (detailsProduct.pending_qty ?? 0), detailsProduct.unit)], ["Selling price", `₱ ${detailsProduct.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#F5F8F3] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#789181]">{label}</p><p className="mt-1 font-bold text-[#123D2A]">{value}</p></div>)}</div></div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
