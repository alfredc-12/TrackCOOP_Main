"use client";

import { useState } from "react";
import { Image as ImageIcon, Minus, Plus, ShoppingCart } from "lucide-react";

export function MemberStorePhoto({ src, name, compact = false }: { src: string; name: string; compact?: boolean }) {
    const [failedSource, setFailedSource] = useState<string | null>(null);

    return src && failedSource !== src ? (
        // Product uploads may come from either local storage or the configured storage provider.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" onError={() => setFailedSource(src)} className="h-full w-full object-contain p-3" />
    ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#EDF3E9] text-[#52705D]" role="img" aria-label={`${name}: photo unavailable`}>
            <ImageIcon className="size-9 text-[#8AA68F]" aria-hidden="true" />
            <span className={compact ? "sr-only" : "text-xs"}>Photo unavailable</span>
        </div>
    );
}

type Product = {
    name: string;
    category: string;
    description?: string;
    img: string;
    unit: string;
    price: number;
    stock: number;
    pending_qty?: number;
    status: string;
};

export function MemberStoreProductCard({ product, quantity, onAdd, onAdjust }: {
    product: Product;
    quantity: number;
    onAdd: () => void;
    onAdjust: (delta: number) => void;
}) {
    const available = Math.max(0, product.stock - (product.pending_qty || 0));
    const canBuy = product.status === "Available" && available > 0;
    const stockLabel = !canBuy ? "Unavailable" : available <= 5 ? "Few left" : "In stock";
    const unit = product.unit || "piece";

    return (
        <article aria-label={product.name} className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#DDE8D8] bg-white shadow-sm transition hover:border-[#A8C7AE] hover:shadow-md">
            <div className="relative h-28 border-b border-[#EDF2EA] bg-[#F6F8F2]">
                <MemberStorePhoto src={product.img} name={product.name} />
                <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-xs font-semibold ${!canBuy ? "border-slate-200 bg-slate-100 text-slate-600" : available <= 5 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#C8DECB] bg-[#F0F8ED] text-[#25613E]"}`}>{stockLabel}</span>
            </div>
            <div className="flex flex-1 flex-col p-3">
                <p className="text-xs font-medium text-[#52705D]">{product.category}</p>
                <h3 className="mt-1 min-h-10 text-base font-bold leading-5 text-[#123D2A]">{product.name}</h3>
                {product.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B7280]" title={product.description}>{product.description}</p>}
                <div className="mt-auto pt-2">
                    <p className="text-xl font-bold text-[#123D2A]">₱{Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}<span className="ml-1 text-xs font-normal text-[#6B7280]">/ {unit}</span></p>
                    <p className="mt-1 text-xs text-[#52705D]">{available.toLocaleString(undefined, { maximumFractionDigits: 3 })} {unit} available</p>
                    {quantity > 0 ? (
                        <div className="mt-2 flex min-h-11 items-center justify-between gap-1 rounded-xl border border-[#C8DECB] bg-[#F4F9F1] px-1">
                            <button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={quantity <= 1} onClick={() => onAdjust(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#123D2A] hover:bg-white disabled:text-gray-300"><Minus className="size-4" /></button>
                            <span className="text-center text-xs font-bold text-[#123D2A]">{quantity} in cart</span>
                            <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= available} onClick={() => onAdjust(1)} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#123D2A] hover:bg-white disabled:text-gray-300"><Plus className="size-4" /></button>
                        </div>
                    ) : (
                        <button type="button" disabled={!canBuy} onClick={onAdd} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#123D2A] px-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:bg-gray-100 disabled:text-gray-500"><ShoppingCart className="size-4" aria-hidden="true" />{canBuy ? "Add to Cart" : "Unavailable"}</button>
                    )}
                </div>
            </div>
        </article>
    );
}
