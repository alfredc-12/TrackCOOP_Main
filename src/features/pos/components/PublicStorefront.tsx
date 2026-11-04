"use client";

import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ImageOff, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { useId, useState } from "react";
import { availableStoreQuantity, emptyStoreFilters, filterStoreCatalog, type StoreCatalogFilters, type StoreProduct } from "../store-catalog";
import styles from "./PublicStorefront.module.css";

const pageSize = 8;
const price = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
const fieldClass = "h-11 w-full min-w-0 appearance-none rounded-md border border-[#CCDACC] bg-white pl-3 pr-9 text-base text-coop-forest outline-none focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/15";

export function PublicStorefront({ products, cart, loading, error, totalItems, totalPrice, onOpenCart, onAdd, onAdjust, onRetry }: {
  products: StoreProduct[];
  cart: { id: number; quantity: number }[];
  loading: boolean;
  error: string;
  totalItems: number;
  totalPrice: number;
  onOpenCart: () => void;
  onAdd: (id: number) => void;
  onAdjust: (id: number, delta: number) => void;
  onRetry: () => void;
}) {
  const [filters, setFilters] = useState<StoreCatalogFilters>(emptyStoreFilters);
  const [page, setPage] = useState(1);
  const availableProducts = products.filter((product) => product.status === "Available" && Number(product.stock) > 0);
  const filtered = filterStoreCatalog(products, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const categories = [...new Map(availableProducts.map((product) => [product.category.trim().toLowerCase(), product.category.trim()])).values()].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const units = [...new Set(availableProducts.map((product) => product.unit.trim()).filter(Boolean))].sort();
  const update = (key: keyof StoreCatalogFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const hasFilters = Boolean(filters.search.trim() || filters.category || filters.unit || filters.stock || filters.sort !== "name-asc");
  const clear = () => { setFilters(emptyStoreFilters); setPage(1); };

  return (
    <>
      <section aria-labelledby="store-title" className={`${styles.intro} mx-auto max-w-7xl px-5 pb-2 pt-7 sm:px-8 sm:pt-9`}>
        <div>
          <h1 id="store-title" className="text-3xl font-bold leading-tight tracking-tight text-coop-forest sm:text-4xl">Cooperative store.</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-coop-secondary">Seeds, feed, and farm supplies. Order online for collection at NFFAC.</p>
        </div>
      </section>

      <section id="store-products" aria-labelledby="store-products-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-10 sm:px-8">
        <div className="sticky top-16 z-30 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--public-canvas)] px-1 py-4">
          <div><h2 id="store-products-title" className="text-2xl font-bold text-coop-forest">Shop products</h2><p role="status" className="mt-1 text-sm text-coop-secondary">{loading ? "Loading products..." : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}</p></div>
          <button type="button" onClick={onOpenCart} aria-label={`Open cart, ${totalItems} items`} className={`${styles.action} inline-flex min-h-11 items-center gap-2 rounded-md bg-coop-forest px-4 text-sm font-bold text-white hover:bg-coop-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green`}><ShoppingCart aria-hidden="true" className="size-4" />My Cart<span className="grid min-w-6 place-items-center rounded-full bg-coop-yellow px-1.5 text-sm text-coop-forest">{totalItems}</span><span className="hidden font-semibold sm:inline">{price(totalPrice)}</span></button>
        </div>
        <div className="mb-6 rounded-xl border border-[var(--public-card-border)] bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="col-span-2 min-w-0 text-sm font-semibold text-coop-forest sm:col-span-3 lg:col-span-1">Search products<span className="relative mt-1.5 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-coop-green" /><input type="search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Name, category, or description" className={`${fieldClass} pl-9 pr-3 placeholder:text-[#627468]`} /></span></label>
            <StoreSelect label="Sort products" value={filters.sort} onChange={(value) => update("sort", value)} options={[{ value: "name-asc", label: "Name: A–Z" }, { value: "name-desc", label: "Name: Z–A" }, { value: "price-asc", label: "Price: low to high" }, { value: "price-desc", label: "Price: high to low" }]} />
            <StoreSelect label="Stock" value={filters.stock} onChange={(value) => update("stock", value)} options={[{ value: "", label: "All products" }, { value: "in-stock", label: "In stock" }, { value: "low-stock", label: "5 or fewer remaining" }]} />
            <StoreSelect label="Product unit" value={filters.unit} onChange={(value) => update("unit", value)} options={[{ value: "", label: "All units" }, ...units.map((unit) => ({ value: unit, label: unit }))]} />
          </div>
          <div aria-label="Product categories" className="mt-3 flex flex-wrap items-center gap-2">
            {["", ...categories].map((category) => <button key={category} type="button" aria-pressed={filters.category === category} onClick={() => update("category", category)} className={`${styles.action} min-h-10 rounded-full px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green ${filters.category === category ? "bg-coop-forest text-white" : "bg-[#EDF3E9] text-coop-secondary hover:bg-[#DCE9D6]"}`}>{category || "All products"}</button>)}
            {hasFilters ? <button type="button" onClick={clear} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-coop-green underline underline-offset-4"><X aria-hidden="true" className="size-3.5" />Clear filters</button> : null}
          </div>
        </div>

        {error && products.length === 0 ? <div role="alert" className="rounded-xl border border-[#DCCEB5] bg-white p-8 text-center"><h3 className="text-xl font-bold text-coop-forest">Products are temporarily unavailable</h3><p className="mx-auto mt-2 max-w-lg text-base leading-7 text-coop-secondary">{error}</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-md bg-coop-forest px-5 text-base font-semibold text-white">Try again</button></div>
          : loading ? <div role="status" className="rounded-xl bg-[#EAF1E5] px-6 py-12 text-center font-semibold text-coop-secondary">Loading products...</div>
          : visible.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 sm:gap-5">{visible.map((product) => <PublicProduct key={product.id} product={product} quantity={cart.find((item) => item.id === product.id)?.quantity ?? 0} onAdd={() => onAdd(product.id)} onAdjust={(delta) => onAdjust(product.id, delta)} />)}</div>
          : <div className="rounded-xl border border-[var(--public-card-border)] bg-white p-8 text-center"><h3 className="text-xl font-bold text-coop-forest">{hasFilters ? "No products match your filters" : "No products are currently available"}</h3><p className="mt-2 text-base text-coop-secondary">{hasFilters ? "Try a shorter search or choose another category." : "Please check back for cooperative supplies."}</p>{hasFilters ? <button type="button" onClick={clear} className="mt-4 min-h-11 rounded-md bg-coop-forest px-5 text-base font-semibold text-white">Show all products</button> : null}</div>}

        {pageCount > 1 ? <nav aria-label="Product pages" className="mt-7 flex flex-wrap items-center justify-center gap-3"><button type="button" aria-label="Previous product page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="grid size-11 place-items-center rounded-md border border-[var(--public-card-border)] bg-white text-coop-forest disabled:opacity-40"><ChevronLeft aria-hidden="true" className="size-4" /></button><p role="status" className="text-sm font-semibold text-coop-secondary">Page {currentPage} of {pageCount}</p><button type="button" aria-label="Next product page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="grid size-11 place-items-center rounded-md border border-[var(--public-card-border)] bg-white text-coop-forest disabled:opacity-40"><ChevronRight aria-hidden="true" className="size-4" /></button></nav> : null}
      </section>
    </>
  );
}

function PublicProduct({ product, quantity, onAdd, onAdjust }: { product: StoreProduct; quantity: number; onAdd: () => void; onAdjust: (delta: number) => void }) {
  const available = availableStoreQuantity(product);
  const canBuy = product.status === "Available" && available > 0;
  return <article aria-label={product.name} className={`${styles.product} group flex min-w-0 flex-col overflow-hidden`}>
    <div className="relative aspect-[4/3] overflow-hidden bg-[#F0F4EC]"><StorePhoto src={product.img} name={product.name} /><span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[13px] font-semibold ${!canBuy ? "bg-[#EFEDE7] text-[#675E47]" : available <= 5 ? "bg-[#F8EBC6] text-[#795B21]" : "bg-[#E6F0E2] text-coop-green"}`}>{!canBuy ? "Unavailable" : available <= 5 ? "Few left" : "In stock"}</span></div>
    <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
      <p className="text-[13px] text-coop-secondary">{product.category}</p>
      <h3 className="mt-1 line-clamp-3 min-h-[4.5rem] text-base font-bold leading-6 text-coop-forest sm:line-clamp-2 sm:min-h-12 sm:text-lg" title={product.name}>{product.name}</h3>
      {product.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-coop-secondary" title={product.description}>{product.description}</p> : null}
      <div className="mt-auto pt-3"><p className="text-xl font-bold text-coop-forest sm:text-2xl">{price(product.price)}</p><p className="mt-1 text-sm leading-5 text-coop-secondary">per {product.unit || "piece"} · {available.toLocaleString("en-PH", { maximumFractionDigits: 3 })} available</p>
        {quantity > 0 ? <div className="mt-3 flex min-h-11 items-center justify-between gap-1 rounded-md border border-[#BFD4BE] bg-[#F0F6EC]"><button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={quantity <= 1} onClick={() => onAdjust(-1)} className="grid size-10 shrink-0 place-items-center rounded-md text-coop-forest hover:bg-white disabled:opacity-30"><Minus aria-hidden="true" className="size-4" /></button><span aria-live="polite" className="min-w-0 text-center text-sm font-bold text-coop-forest">{quantity}<span className="sr-only"> in cart</span></span><button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= available} onClick={() => onAdjust(1)} className="grid size-10 shrink-0 place-items-center rounded-md text-coop-forest hover:bg-white disabled:opacity-30"><Plus aria-hidden="true" className="size-4" /></button></div>
          : <button type="button" onClick={onAdd} disabled={!canBuy} aria-label={`Add ${product.name} to cart`} className={`${styles.action} mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-coop-forest px-2 text-sm font-bold text-white hover:bg-coop-green disabled:bg-[#ECEFE8] disabled:text-[#647565]`}><Plus aria-hidden="true" className="size-4 shrink-0" />{canBuy ? "Add to Cart" : "Unavailable"}</button>}
      </div>
    </div>
  </article>;
}

function StorePhoto({ src, name, sizes = "(min-width:1024px) 300px, (min-width:768px) 33vw, 50vw" }: { src: string; name: string; sizes?: string }) {
  const [failed, setFailed] = useState("");
  return src && failed !== src ? <Image src={src} alt={name} fill unoptimized sizes={sizes} className="object-contain p-3 sm:p-4" onError={() => setFailed(src)} /> : <div role="img" aria-label={`${name}: photo unavailable`} className="absolute inset-0 grid place-content-center gap-2 p-3 text-center text-sm text-coop-secondary"><ImageOff aria-hidden="true" className="mx-auto size-7" /><span>Photo unavailable</span></div>;
}

function StoreSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return <div className="min-w-0"><label htmlFor={id} className="block text-sm font-semibold text-coop-forest">{label}</label><div className="relative mt-1.5"><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-coop-green" /></div></div>;
}
