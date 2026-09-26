"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, ShoppingCart, Plus, Minus, X, CheckCircle, Package, Image as ImageIcon, History, Printer, AlertCircle, CreditCard, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth-client";
import { expressFetch } from "@/lib/express-api";
import { toast } from "sonner";
import { normalizeProductImage } from "../product-image-url";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
    description?: string;
    unit: string;
    price: number;
    stock: number;
    sold: number;
    status: string;
    img: string;
    pending_qty?: number;
};

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    maxStock: number;
    img: string;
    category: string;
    unit: string;
}

function MemberThemedSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value)?.label ?? value;
    return <div className="relative"><button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} className="flex min-w-[190px] items-center justify-between gap-4 rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"><span>{selected}</span><ChevronDown className={`size-4 text-[#52705D] transition ${open ? "rotate-180" : ""}`} /></button>{open && <div role="listbox" className="absolute left-0 top-full z-[80] mt-2 min-w-full overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button type="button" role="option" aria-selected={value === option.value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition ${value === option.value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>{option.label}{value === option.value && <span className="text-lg text-[#1F6B43]">✓</span>}</button>)}</div>}</div>;
}

function formatQuantityUnit(quantity: number | string, unit?: string) {
    return `${Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || "piece"}`;
}

type PosOrderItem = {
    name: string;
    quantity: number;
    price: number | string;
};

type PosOrder = {
    id: number;
    sale_number: string;
    sale_date: string;
    sale_status: string;
    subtotal_amount: number | string;
    discount_amount: number | string;
    total_amount: number | string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_contact?: string | null;
    payment_reference_id?: number | string | null;
    reference_number?: string | null;
    provider?: string | null;
    notes?: string | null;
    items?: PosOrderItem[];
};

type MemberPosClientProps = {
    isPublicView?: boolean;
};

type StoreCartPortalProps = {
    targetId: string;
    className: string;
    totalCartItems: number;
    onOpenCart: () => void;
};

function StoreCartPortal({ targetId, className, totalCartItems, onOpenCart }: StoreCartPortalProps) {
    const [target, setTarget] = useState<Element | null>(null);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setTarget(document.getElementById(targetId));
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [targetId]);

    if (!target) {
        return null;
    }

    return createPortal(
        <button
            type="button"
            onClick={onOpenCart}
            className={className}
        >
            <ShoppingCart className="size-4" />
            My Cart
            {totalCartItems > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                    {totalCartItems}
                </span>
            )}
        </button>,
        target,
    );
}

export default function MemberPosClient({ isPublicView = false }: MemberPosClientProps) {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<PosOrder[]>([]);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);
    const [activeAdjustItemId, setActiveAdjustItemId] = useState<number | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isInventoryLoading, setIsInventoryLoading] = useState(true);
    const [inventoryError, setInventoryError] = useState("");
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment">("cart");
    const [paymentName, setPaymentName] = useState("");
    const [paymentEmail, setPaymentEmail] = useState("");
    const [paymentContact, setPaymentContact] = useState("");
    const [isConfirmCheckoutModalOpen, setIsConfirmCheckoutModalOpen] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);
    const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
    const [checkoutStatusMessage, setCheckoutStatusMessage] = useState("");

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");
    const [productPage, setProductPage] = useState(1);
    const productsPerPage = 8;

    const fetchInventory = useCallback(async (notifyOnError = false, showLoading = notifyOnError) => {
        if (showLoading) setIsInventoryLoading(true);
        setInventoryError("");
        try {
            const res = await expressFetch(isPublicView ? "/api/public/store-products" : "/api/inventory");
            if (res.ok) {
                const data = await res.json();
                setInventory((data as InventoryItem[]).map(normalizeProductImage));
            } else {
                throw new Error(`Products could not be loaded (${res.status}).`);
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
            setInventoryError("We could not load the products right now. Check your connection and try again.");
            if (notifyOnError) toast.error("Products could not be loaded. Please try again.");
        } finally {
            if (showLoading) setIsInventoryLoading(false);
        }
    }, [isPublicView]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchInventory(true);
        }, 0);

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") void fetchInventory(false);
        }, 15000); // Refresh visible store inventory every 15 seconds

        if (!isPublicView) {
            getAuthenticatedUser().then(user => {
                if (user) {
                    setPaymentName(prev => prev || user.displayName || "");
                    setPaymentEmail(prev => prev || user.email || "");
                }
            }).catch(console.error);
        }

        return () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(interval);
        };
    }, [fetchInventory, isPublicView]);

    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await expressFetch("/api/pos/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data as PosOrder[]);
                setHistorySearchQuery("");
                setIsHistoryOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
            toast.error("Order history could not be loaded. Please try again.");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const fetchHistoryQuietly = useCallback(async () => {
        try {
            const res = await expressFetch("/api/pos/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data as PosOrder[]);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    }, []);

    useEffect(() => {
        if (isHistoryOpen) {
            const interval = setInterval(() => {
                void fetchHistoryQuietly();
            }, 5000); // Poll history every 5 seconds while open
            return () => clearInterval(interval);
        }
    }, [fetchHistoryQuietly, isHistoryOpen]);

    useEffect(() => {
        if (isCartOpen || isHistoryOpen || checkoutSuccess || isConfirmCheckoutModalOpen || receiptOrder !== null) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isCartOpen, isHistoryOpen, checkoutSuccess, isConfirmCheckoutModalOpen, receiptOrder]);

    // Derived states
    const availableInventory = inventory.filter(item => item.status === "Available" && item.stock > 0);
    const categoryTabs = useMemo(() => {
        const categories = new Map<string, string>();

        inventory
            .filter((item) => item.status === "Available" && item.stock > 0)
            .forEach((item) => {
            const category = item.category.trim();
            if (category) {
                categories.set(category.toLowerCase(), category);
            }
        });

        return ["All", ...Array.from(categories.values()).sort((a, b) => a.localeCompare(b))];
    }, [inventory]);

    const filteredAndSortedInventory = availableInventory
        .filter((item) => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "price-asc": return a.price - b.price;
                case "price-desc": return b.price - a.price;
                case "name-asc": default: return a.name.localeCompare(b.name);
            }
        });

    const productPageCount = Math.max(1, Math.ceil(filteredAndSortedInventory.length / productsPerPage));
    const paginatedInventory = filteredAndSortedInventory.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);

    const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const isMember = !isPublicView;
    const autoDiscountRate = isMember ? 0.05 : 0;
    const autoDiscountAmount = totalCartPrice * autoDiscountRate;
    const finalCartPrice = totalCartPrice - autoDiscountAmount;

    const openCart = useCallback(() => {
        setIsCartOpen(true);
        setCheckoutStep("cart");
    }, []);

    const addToCart = (product: InventoryItem, qty: number = 1) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            const currentQty = existingItem ? existingItem.quantity : 0;
            const availableToSell = product.stock - (product.pending_qty || 0);

            if (currentQty + qty > availableToSell) {
                toast.error(`Cannot add more. Only ${formatQuantityUnit(availableToSell, product.unit)} are available to buy.`);
                return prevCart;
            }

            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
                );
            }
            return [...prevCart, {
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: qty,
                maxStock: availableToSell,
                img: product.img,
                category: product.category,
                unit: product.unit
            }];
        });
    };

    const updateCartQuantity = (id: number, delta: number) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === id) {
                const newQuantity = item.quantity + delta;
                if (newQuantity > item.maxStock) {
                    toast.error(`Maximum stock reached for ${item.name}: ${formatQuantityUnit(item.maxStock, item.unit)}.`);
                    return item;
                }
                if (newQuantity > 0) {
                    return { ...item, quantity: newQuantity };
                }
            }
            return item;
        }));
    };

    const removeFromCart = (id: number) => {
        setCart(prevCart => prevCart.filter(item => item.id !== id));
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        
        const errors: Record<string, string> = {};
        
        const nameRegex = /^[a-zA-Z\s.,'-]+$/;
        if (!paymentName.trim()) {
            errors.paymentName = "Please enter your Name.";
        } else if (!nameRegex.test(paymentName.trim())) {
            errors.paymentName = "Name can only contain letters and basic punctuation.";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!paymentEmail.trim()) {
            errors.paymentEmail = "Please enter your Email account.";
        } else if (!emailRegex.test(paymentEmail.trim())) {
            errors.paymentEmail = "Please enter a valid email address.";
        }

        const contactRegex = /^(9)\d{9}$/;
        if (!paymentContact.trim()) {
            errors.paymentContact = "Please enter your Contact Number.";
        } else if (!contactRegex.test(paymentContact.trim())) {
            errors.paymentContact = "Please enter a valid 10-digit mobile number starting with 9.";
        }

        if (Object.keys(errors).length > 0) {
            setCheckoutErrors(errors);
            toast.error("Please fill in all required fields correctly.");
            return;
        }

        setCheckoutErrors({});
        setIsConfirmCheckoutModalOpen(true);
    };

    const processCheckout = async () => {
        if (isCheckingOut) return;
        setIsCheckingOut(true);
        setCheckoutStatusMessage("Processing your order...");
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 30000);
        try {
            const checkoutRequestId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const res = await expressFetch("/api/pos/checkout", {
                method: "POST",
                signal: controller.signal,
                headers: { "Content-Type": "application/json", "X-Checkout-Request-Id": checkoutRequestId },
                body: JSON.stringify({ items: cart, paymentName, paymentEmail, paymentContact: `+63${paymentContact}` }),
            });
            const data = await res.json().catch(() => null);

            if (res.ok) {
                if (data?.checkoutUrl) {
                    setCheckoutStatusMessage("Opening secure payment checkout...");
                    setCart([]);
                    setIsConfirmCheckoutModalOpen(false);
                    setIsCartOpen(false);
                    window.location.href = data.checkoutUrl;
                    return;
                }

                setIsConfirmCheckoutModalOpen(false);
                setIsCartOpen(false);
                setCheckoutSuccess(true);
                setCart([]);
                setCheckoutStep("cart");
                if (!isPublicView) {
                    getAuthenticatedUser().then(user => {
                        if (user) {
                            setPaymentName(user.displayName || "");
                            setPaymentEmail(user.email || "");
                        }
                    }).catch(console.error);
                } else {
                    setPaymentName("");
                    setPaymentEmail("");
                }
                setPaymentContact("");
                void fetchInventory(false); // Refresh stock
            } else {
                toast.error(data?.error || "We could not process your order. Please try again.");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error(error instanceof DOMException && error.name === "AbortError"
                ? "Checkout timed out. Please check your connection and try again."
                : "We could not connect to the checkout service. Please try again.");
        } finally {
            window.clearTimeout(timeoutId);
            setIsCheckingOut(false);
            setCheckoutStatusMessage("");
        }
    };

    return (
        <div className="-mx-4 -my-6 min-h-screen flex-1 overflow-y-auto bg-[#F5F8F3] p-4 sm:-mx-6 sm:p-5 lg:-mx-8 lg:-my-8 lg:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {/* Header */}
            <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-6 text-white shadow-[0_16px_34px_rgba(13,67,45,0.24)] sm:px-8 sm:py-7">
                <div className="absolute -right-10 -top-16 size-56 rounded-full border-[22px] border-[#D8F0DE]/10" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F6D354]"><span className="h-2 w-2 rounded-full bg-[#F6D354]" /> Cooperative marketplace</div>
                    <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Cooperative Shop</h2>
                    <p className="mt-2 text-sm leading-6 text-white/75">Order agricultural supplies directly from the cooperative.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {!isPublicView && (
                        <button
                            onClick={() => {
                                fetchHistory();
                                setIsHistoryOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-white/20 relative"
                        >
                            <History className="size-4" />
                            Order History
                        </button>
                    )}
                    {!isPublicView && (
                        <button
                            onClick={openCart}
                            className="relative flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
                        >
                            <ShoppingCart className="size-4" />
                            My Cart
                            {totalCartItems > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                                    {totalCartItems}
                                </span>
                            )}
                        </button>
                    )}
                </div></div>
            </div>

            {isPublicView && (
                <>
                    <StoreCartPortal
                        targetId="store-header-cart-slot"
                        className="relative mr-2 flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
                        totalCartItems={totalCartItems}
                        onOpenCart={openCart}
                    />
                    <StoreCartPortal
                        targetId="store-header-cart-slot-mobile"
                        className="relative flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
                        totalCartItems={totalCartItems}
                        onOpenCart={openCart}
                    />
                </>
            )}

            {/* Toolbar */}
            <div className="mb-6 rounded-2xl border border-[#DCE9DE] bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setProductPage(1); }}
                            aria-label="Search available products"
                            placeholder="Search Products..."
                            className="w-full rounded-full border border-gray-200 bg-[#f8fafc] py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <MemberThemedSelect value={sortBy} onChange={(value) => { setSortBy(value); setProductPage(1); }} ariaLabel="Sort products" options={[{ value: "name-asc", label: "Sort by: Name (A–Z)" }, { value: "price-asc", label: "Sort by: Price (Low to High)" }, { value: "price-desc", label: "Sort by: Price (High to Low)" }]} />
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {categoryTabs.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); setProductPage(1); }}
                            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategory === cat
                                ? "bg-[#123D2A] text-white shadow-sm"
                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#EEF4EF] pt-3 text-xs font-medium text-[#789181]"><span>Showing {filteredAndSortedInventory.length} available product{filteredAndSortedInventory.length === 1 ? "" : "s"}</span>{searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setProductPage(1); }} className="font-bold text-[#1F6B43] hover:underline">Clear search</button>}</div>
            </div>

            {isPublicView && checkoutStep === "cart" && (
                <div className="mb-5 rounded-xl border border-[#D8E5DB] bg-[#EEF8F0] px-4 py-3 text-sm text-[#52705D]"><span className="font-bold text-[#123D2A]">Guest checkout:</span> Add products to your cart, then provide your contact details before secure payment.</div>
            )}

            {/* Product Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-12">
                {inventoryError && inventory.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-white px-6 py-16 text-center shadow-sm" role="alert" aria-live="assertive">
                        <AlertCircle className="mb-4 size-12 text-red-500" aria-hidden="true" />
                        <h3 className="text-xl font-bold text-[#123D2A]">Products are temporarily unavailable</h3>
                        <p className="mt-2 max-w-md text-sm text-[#607A6B]">{inventoryError}</p>
                        <button type="button" onClick={() => void fetchInventory(true)} disabled={isInventoryLoading} aria-busy={isInventoryLoading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-wait disabled:opacity-60">
                            {isInventoryLoading ? <><Loader2 className="size-4 animate-spin" /> Loading products...</> : "Try again"}
                        </button>
                    </div>
                ) : isInventoryLoading ? (
                    [1, 2, 3, 4].map((item) => <div key={item} aria-hidden="true" className="h-[27rem] animate-pulse rounded-2xl bg-[#E7F2E4]" />)
                ) : filteredAndSortedInventory.length > 0 ? (
                    paginatedInventory.map(item => {
                        const cartItem = cart.find(c => c.id === item.id);

                        return (
                            <div key={item.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(18,61,42,0.14)]">
                                <div className="relative h-48 bg-[#f4f7f9] p-4 flex items-center justify-center rounded-t-2xl overflow-hidden">
                                    <span className={`absolute left-4 top-4 rounded-lg px-2.5 py-1 text-xs font-bold text-white z-10 shadow-sm ${item.status === 'Available' ? 'bg-[#16B864]' : 'bg-[#EF4444]'}`}>
                                        {item.status}
                                    </span>
                                    {item.img ? (
                                        <img src={item.img} alt={item.name} className="absolute inset-0 w-full h-full object-cover transition duration-300 hover:scale-105" />
                                    ) : (
                                        <ImageIcon className="size-16 text-gray-300 z-0" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                                </div>
                                <div className="flex flex-col p-5 flex-1">
                                    <div className="mb-4"><h3 className="font-black text-[#123D2A] truncate leading-tight text-base transition group-hover:text-[#1F6B43]">{item.name}</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#789181]">{item.category}</p></div>
                                    <p className="mb-4 min-h-10 line-clamp-2 text-xs leading-5 text-[#607A6B]">{item.description || "Cooperative agricultural supply."}</p>

                                    <div className="flex justify-between items-center text-sm mb-3">
                                        <span className="text-[#94a3b8]">Quantity</span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-[#1e293b]">{formatQuantityUnit(item.stock - (item.pending_qty || 0), item.unit)}</span>
                                            {item.pending_qty ? (
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">({formatQuantityUnit(item.pending_qty, item.unit)} pending)</span>
                                            ) : null}
                                            {(item.stock - (item.pending_qty || 0)) <= 5 && <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Only {formatQuantityUnit(item.stock - (item.pending_qty || 0), item.unit)} left</span>}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mb-5">
                                        <span className="text-[#94a3b8]">Price</span>
                                        <span className="font-bold text-[#1e293b]">₱ {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        {activeAdjustItemId === item.id && cartItem ? (
                                            <div className="flex-1 flex items-center justify-between bg-gray-50 rounded-xl px-2 border border-gray-100">
                                                <button
                                                    onClick={() => updateCartQuantity(item.id, -1)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:shadow-sm transition"
                                                >
                                                    <Minus className="size-4" />
                                                </button>
                                                <span className="font-bold text-[#1e293b] text-sm">{formatQuantityUnit(cartItem.quantity, cartItem.unit)} In Cart</span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.id, 1)}
                                                    disabled={cartItem.quantity >= (item.stock - (item.pending_qty || 0))}
                                                    className={`p-1.5 rounded-lg transition ${cartItem.quantity >= (item.stock - (item.pending_qty || 0)) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-white hover:shadow-sm'}`}
                                                >
                                                    <Plus className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() => setActiveAdjustItemId(null)}
                                                    className="ml-1 p-1 rounded-full text-gray-400 hover:text-gray-600 transition"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (!cartItem) addToCart(item);
                                                    setActiveAdjustItemId(item.id);
                                                }}
                                                disabled={item.status !== 'Available' || (item.stock - (item.pending_qty || 0)) <= 0}
                                                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition shadow-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${cartItem ? 'bg-white border border-[#123D2A] text-[#123D2A] hover:bg-gray-50' : 'bg-[#123D2A] text-white hover:bg-[#123D2A]/90'}`}>
                                                {item.status !== 'Available' || (item.stock - (item.pending_qty || 0)) <= 0 ? 'Unavailable' : cartItem ? `${formatQuantityUnit(cartItem.quantity, cartItem.unit)} In Cart - Edit` : 'Add to Cart'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                        <Package className="size-12 text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-[#1e293b]">{searchQuery || selectedCategory !== "All" ? "No products match your filters" : "No products are currently available"}</h3>
                        <p className="text-gray-500 mt-2 text-sm">{searchQuery || selectedCategory !== "All" ? "Try a different search or clear your filters." : "Please check back later for available cooperative products."}</p>
                        {(searchQuery || selectedCategory !== "All") && <button type="button" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setProductPage(1); }} className="mt-4 rounded-xl bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1F6B43]">Clear filters</button>}
                    </div>
                )}
            </div>

            {filteredAndSortedInventory.length > 0 && (
                <div className="mb-12 flex flex-wrap items-center justify-center gap-2 border-t border-[#DDE9E0] pt-5">
                    <button type="button" onClick={() => setProductPage(1)} disabled={productPage === 1} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="First page" aria-label="First product page"><ChevronsLeft className="size-4" /></button>
                    <button type="button" onClick={() => setProductPage((page) => Math.max(1, page - 1))} disabled={productPage === 1} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Previous page" aria-label="Previous product page"><ChevronLeft className="size-4" /></button>
                    <span className="px-2 text-sm font-bold text-[#123D2A]">Page {productPage} of {productPageCount} · Showing {filteredAndSortedInventory.length} products</span>
                    <button type="button" onClick={() => setProductPage((page) => Math.min(productPageCount, page + 1))} disabled={productPage === productPageCount} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Next page" aria-label="Next product page"><ChevronRight className="size-4" /></button>
                    <button type="button" onClick={() => setProductPage(productPageCount)} disabled={productPage === productPageCount} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Last page" aria-label="Last product page"><ChevronsRight className="size-4" /></button>
                </div>
            )}

            {totalCartItems > 0 && (
                <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl border border-[#BBD7C1] bg-white/95 px-4 py-3 shadow-[0_12px_30px_rgba(18,61,42,0.2)] backdrop-blur-md sm:hidden">
                    <div><p className="text-xs font-bold text-[#789181]">{totalCartItems} item{totalCartItems === 1 ? "" : "s"} in cart</p><p className="font-black text-[#123D2A]">₱ {finalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                    <button type="button" onClick={openCart} className="rounded-xl bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white">View cart</button>
                </div>
            )}

            {/* Shopping Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-[#f8fafc] px-6 py-5">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <ShoppingCart className="size-5 text-[#123D2A]" />
                                {checkoutStep === "cart" ? "My Cart" : "Payment Method"}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsCartOpen(false)}
                                aria-label="Close cart"
                                className="rounded-full p-2 text-gray-400 transition hover:bg-white hover:text-gray-600 hover:shadow-sm"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 border-b border-[#DDE9E0] bg-white px-6 py-3 text-xs font-bold">
                            <span className={`rounded-full px-3 py-1 ${checkoutStep === "cart" ? "bg-[#123D2A] text-white" : "bg-[#EAF5EC] text-[#52705D]"}`}>1. Cart</span>
                            <span className="h-px flex-1 bg-[#DDE9E0]" />
                            <span className={`rounded-full px-3 py-1 ${checkoutStep === "payment" ? "bg-[#123D2A] text-white" : "bg-[#F1F5F2] text-[#789181]"}`}>2. Customer & Payment</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {isMember && (
                                <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm flex items-center justify-center gap-2 animate-in fade-in duration-300">
                                    <span className="font-bold">⭐ Member Perks:</span> You get an automatic 5% discount on all purchases!
                                </div>
                            )}
                            {checkoutStep === "payment" ? (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="mb-6 rounded-2xl border border-[#123D2A]/15 bg-[#123D2A]/5 p-5 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#123D2A] text-white">
                                                <CreditCard className="size-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-[#123D2A]">Pay securely with PayMongo</p>
                                                <p className="mt-1 text-sm leading-6 text-gray-600">
                                                    After confirming, TrackCOOP will reserve your items and open PayMongo checkout. Stock is deducted after PayMongo confirms the payment.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 flex flex-col animate-in zoom-in-95 duration-200">
                                        <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Customer Details</h3>
                                        <div className="w-full text-left">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                value={paymentName}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^a-zA-Z\s.,'-]/g, '');
                                                    setPaymentName(val);
                                                    if (checkoutErrors.paymentName) setCheckoutErrors({ ...checkoutErrors, paymentName: "" });
                                                }}
                                                placeholder="e.g. Juan Dela Cruz"
                                                className={`w-full rounded-xl p-3 focus:outline-none focus:ring-1 transition border ${checkoutErrors.paymentName ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-[#0F9D58] focus:ring-[#0F9D58]'}`}
                                            />
                                            {checkoutErrors.paymentName && <p className="mt-1 text-xs text-red-500">{checkoutErrors.paymentName}</p>}
                                        </div>
                                        <div className="w-full text-left mt-4">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address <span className="text-red-500">*</span></label>
                                            <input 
                                                type="email" 
                                                value={paymentEmail}
                                                onChange={(e) => {
                                                    setPaymentEmail(e.target.value);
                                                    if (checkoutErrors.paymentEmail) setCheckoutErrors({ ...checkoutErrors, paymentEmail: "" });
                                                }}
                                                placeholder="e.g. juandelacruz@gmail.com"
                                                className={`w-full rounded-xl p-3 focus:outline-none focus:ring-1 transition border ${checkoutErrors.paymentEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-[#0F9D58] focus:ring-[#0F9D58]'}`}
                                            />
                                            {checkoutErrors.paymentEmail && <p className="mt-1 text-xs text-red-500">{checkoutErrors.paymentEmail}</p>}
                                        </div>
                                        <div className="w-full text-left mt-4">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number <span className="text-red-500">*</span></label>
                                            <div className="relative flex">
                                                <span className={`inline-flex items-center px-4 rounded-l-xl border border-r-0 bg-gray-50 text-gray-500 font-medium ${checkoutErrors.paymentContact ? 'border-red-500' : 'border-gray-300'}`}>
                                                    +63
                                                </span>
                                                <input 
                                                    type="tel"
                                                    maxLength={10}
                                                    onKeyDown={(e) => {
                                                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    value={paymentContact}
                                                    onChange={(e) => {
                                                        let val = e.target.value.replace(/[^0-9]/g, '');
                                                        if (val.startsWith('0')) val = val.substring(1);
                                                        setPaymentContact(val);
                                                        if (val.length > 0 && val[0] !== '9') {
                                                            setCheckoutErrors({ ...checkoutErrors, paymentContact: "Mobile number must start with 9." });
                                                        } else if (checkoutErrors.paymentContact) {
                                                            setCheckoutErrors({ ...checkoutErrors, paymentContact: "" });
                                                        }
                                                    }}
                                                    placeholder="9123456789"
                                                    className={`w-full rounded-r-xl p-3 focus:outline-none focus:ring-1 transition border ${checkoutErrors.paymentContact ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-[#0F9D58] focus:ring-[#0F9D58]'}`}
                                                />
                                            </div>
                                            {checkoutErrors.paymentContact && <p className="mt-1 text-xs text-red-500">{checkoutErrors.paymentContact}</p>}
                                        </div>
                                    </div>
                                </div>
                            ) : cart.length > 0 ? (
                                <div className="space-y-4">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 items-center">
                                            <div className="w-16 h-16 rounded-xl bg-[#f4f7f9] overflow-hidden flex-shrink-0 relative">
                                                {item.img ? (
                                                    <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="size-8 text-gray-300 m-auto mt-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 flex flex-col justify-between h-full py-1">
                                                <div>
                                                    <h4 className="font-bold text-[#1e293b] text-sm leading-tight mb-1 line-clamp-2">{item.name}</h4>
                                                    <p className="font-bold text-gray-500 text-sm">₱ {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100">
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, -1)}
                                                            className="p-1 rounded-md bg-white text-gray-600 shadow-sm border border-gray-200 transition"
                                                        >
                                                            <Minus className="size-3" />
                                                        </button>
                                                        <span className="font-bold text-xs px-3 text-[#1e293b]">{formatQuantityUnit(item.quantity, item.unit)}</span>
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, 1)}
                                                            disabled={item.quantity >= item.maxStock}
                                                            className="p-1 rounded-md bg-white text-gray-600 shadow-sm border border-gray-200 transition disabled:opacity-50"
                                                        >
                                                            <Plus className="size-3" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <ShoppingCart className="size-10 text-gray-300 mb-4" />
                                    <h3 className="text-lg font-bold text-[#1e293b]">Your cart is empty</h3>
                                    <p className="text-gray-500 mt-2 text-sm">Add some agricultural supplies to get started.</p>
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="p-6 bg-gray-50 border-t border-gray-200">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-semibold text-gray-500">Subtotal</span>
                                    <span className="text-sm font-semibold text-gray-700">₱ {totalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                {isMember && (
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-red-500">Member Discount (5%)</span>
                                        <span className="text-sm font-bold text-red-500">- ₱ {autoDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-t border-gray-100 pt-3 mb-6">
                                    <span className="text-base font-bold text-[#1e293b]">Total</span>
                                    <span className="text-2xl font-bold text-[#123D2A]">₱ {finalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex gap-3">
                                    {checkoutStep === "payment" && (
                                        <button
                                            onClick={() => setCheckoutStep("cart")}
                                            className="w-1/3 rounded-xl bg-white border border-gray-300 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
                                        >
                                            Back
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (checkoutStep === "cart") {
                                                setCheckoutStep("payment");
                                            } else {
                                                handleCheckout();
                                            }
                                        }}
                                        disabled={isCheckingOut}
                                        aria-busy={isCheckingOut}
                                        className="flex-1 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isCheckingOut ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                {checkoutStatusMessage || "Processing..."}
                                            </>
                                        ) : checkoutStep === "cart" ? (
                                            "Proceed to Checkout"
                                        ) : (
                                            <>
                                                Continue to PayMongo
                                                <ExternalLink className="size-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {checkoutSuccess && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <CheckCircle className="size-8" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Order Placed!</h2>
                        <p className="mb-6 text-sm text-gray-500">
                            Your order has been created. Complete the PayMongo checkout so TrackCOOP can confirm the payment and release the receipt.
                        </p>
                        <button
                            onClick={() => setCheckoutSuccess(false)}
                            className="w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                        >
                            Continue Shopping
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Checkout Modal */}
            {isConfirmCheckoutModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Open PayMongo Checkout</h2>
                        <p className="mb-6 text-sm text-gray-500">
                            Your order will be reserved and you will be redirected to PayMongo to complete payment.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsConfirmCheckoutModalOpen(false)}
                                disabled={isCheckingOut}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processCheckout}
                                disabled={isCheckingOut}
                                aria-busy={isCheckingOut}
                                className="flex-1 rounded-xl border border-transparent bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCheckingOut ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : null}
                                {isCheckingOut ? (checkoutStatusMessage || "Processing...") : "Continue"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                            <h3 className="text-xl font-bold text-[#1e293b]">My Order History</h3>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="mb-6 relative w-full">
                                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    placeholder="Search by Order Number..."
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58] shadow-sm"
                                />
                            </div>

                            {isHistoryLoading ? (
                                <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite"><div className="flex items-center gap-2 font-semibold text-[#123D2A]"><Loader2 className="size-5 animate-spin" /> Loading order history...</div></div>
                            ) : history.filter(order => order.sale_number.toLowerCase().includes(historySearchQuery.toLowerCase())).length === 0 ? (
                                <div className="text-center py-12">
                                    <History className="size-16 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium">No previous orders found.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {history.filter(order => order.sale_number.toLowerCase().includes(historySearchQuery.toLowerCase())).map((order) => (
                                        <div key={order.id} className="border border-gray-200 rounded-xl p-5 shadow-sm">
                                            <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                                                <div>
                                                    <p className="font-bold text-[#1e293b]">{order.sale_number}</p>
                                                    <p suppressHydrationWarning className="text-sm text-gray-500">{new Date(order.sale_date).toLocaleString()}</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    order.sale_status === 'Pending Payment' ? 'bg-orange-100 text-orange-700' :
                                                    order.sale_status === 'Paid' ? 'bg-green-100 text-green-700' :
                                                    order.sale_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {order.sale_status}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {order.items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-700">{item.quantity}x {item.name}</span>
                                                        <span className="font-medium">₱{(Number(item.price) * Number(item.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                                                <span className="font-bold text-gray-700">Total</span>
                                                <span className="font-bold text-[#123D2A] text-lg">₱{Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {order.notes && order.sale_status !== 'Paid' && (
                                                <div className="mt-4 rounded-xl bg-red-50 p-4 border border-red-100">
                                                    <div className="flex items-start gap-3">
                                                        <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-bold text-red-900 mb-1">Status Update</h4>
                                                            <p className="text-xs text-red-700 whitespace-pre-wrap">{order.notes}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {order.sale_status === 'Paid' && (
                                                <div className="mt-4 flex justify-end">
                                                    <button 
                                                        onClick={() => setReceiptOrder(order)}
                                                        className="text-xs font-bold text-[#123D2A] px-3 py-2 rounded-lg transition border border-[#123D2A]/20 hover:bg-[#123D2A]/10 shadow-sm flex items-center gap-1.5"
                                                    >
                                                        <Printer className="size-3.5" />
                                                        View Receipt
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {receiptOrder && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-900">Receipt</h2>
                            <button onClick={() => setReceiptOrder(null)} className="text-gray-400 hover:text-gray-900 transition">
                                <X className="size-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6" id="printable-receipt">
                            <div className="text-center mb-6">
                                <h1 className="text-xl font-black text-gray-900 mb-1 tracking-tight">TRACKCOOP</h1>
                                <p className="text-xs text-gray-500">Cooperative POS & Inventory</p>
                                <div className="mt-4 text-sm text-gray-600">
                                    <p>Order #: {receiptOrder.sale_number}</p>
                                    <p>{new Date(receiptOrder.sale_date).toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="border-t border-b border-dashed border-gray-300 py-4 mb-4">
                                <div className="text-xs text-gray-500 mb-2 font-semibold">CUSTOMER</div>
                                <p className="text-sm font-bold text-gray-900">{receiptOrder.customer_name || 'Walk-in'}</p>
                                {receiptOrder.customer_email && <p className="text-xs text-gray-600">{receiptOrder.customer_email}</p>}
                                {receiptOrder.customer_contact && <p className="text-xs text-gray-600">{receiptOrder.customer_contact}</p>}
                            </div>

                            <div className="mb-4">
                                <div className="text-xs text-gray-500 mb-2 font-semibold">ITEMS</div>
                                <div className="space-y-2">
                                    {receiptOrder.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-sm">
                                            <div>
                                                <p className="font-medium text-gray-800">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} x ₱{Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <p className="font-bold text-gray-900">₱{(Number(item.price) * Number(item.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-dashed border-gray-300 pt-4 mb-4 space-y-1">
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span>₱{Number(receiptOrder.subtotal_amount || receiptOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {(() => {
                                    const subtotal = Number(receiptOrder.subtotal_amount || receiptOrder.total_amount);
                                    const totalDiscount = Number(receiptOrder.discount_amount);
                                    
                                    if (totalDiscount <= 0) return null;

                                    // In Member UI, if there is a discount, it's safe to assume they are a member 
                                    // if the view is not public, or we can just check if member_id exists. 
                                    // Wait, receiptOrder in Member UI doesn't have member_id explicitly typed, let's just use the same logic
                                    // but we know for a fact that if it's not public view, they are a member.
                                    const isMember = !isPublicView;
                                    const expectedMemberDiscount = isMember ? subtotal * 0.05 : 0;
                                    
                                    // Due to float precision, we compare with a tiny threshold
                                    const hasMemberDiscount = isMember && totalDiscount >= expectedMemberDiscount - 0.01;
                                    const actualMemberDiscount = hasMemberDiscount ? expectedMemberDiscount : 0;
                                    const additionalDiscount = Math.max(0, totalDiscount - actualMemberDiscount);
                                    
                                    return (
                                        <>
                                            {actualMemberDiscount > 0 && (
                                                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                                                    <span>Member Discount (5%)</span>
                                                    <span>- ₱{actualMemberDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            {additionalDiscount > 0.01 && (
                                                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                                                    <span>Additional Discount ({Math.round((additionalDiscount / subtotal) * 100)}%)</span>
                                                    <span>- ₱{additionalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                <div className="flex justify-between items-center text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                                    <span>TOTAL</span>
                                    <span>₱{Number(receiptOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Payment Method</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {receiptOrder.payment_reference_id && receiptOrder.provider !== 'Cash' ? `${receiptOrder.provider || 'GCash'} (${receiptOrder.reference_number})` : 'Cash'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('printable-receipt');
                                    if (printContent) {
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                            printWindow.document.write(`
                                                <html>
                                                    <head>
                                                        <title>Receipt - ${receiptOrder.sale_number}</title>
                                                        <style>
                                                            body { font-family: monospace; padding: 20px; color: #000; }
                                                            h1 { text-align: center; font-size: 24px; margin: 0 0 5px 0; }
                                                            p { margin: 2px 0; }
                                                            .text-center { text-align: center; }
                                                            .mb-6 { margin-bottom: 24px; }
                                                            .mb-4 { margin-bottom: 16px; }
                                                            .border-t { border-top: 1px dashed #ccc; }
                                                            .border-b { border-bottom: 1px dashed #ccc; }
                                                            .py-4 { padding-top: 16px; padding-bottom: 16px; }
                                                            .pt-4 { padding-top: 16px; }
                                                            .flex { display: flex; justify-content: space-between; }
                                                            .text-xs { font-size: 12px; }
                                                            .text-sm { font-size: 14px; }
                                                            .font-bold { font-weight: bold; }
                                                            .font-semibold { font-weight: 600; }
                                                            .text-gray-500 { color: #666; }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        ${printContent.innerHTML}
                                                        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
                                                            Thank you for your business!
                                                        </div>
                                                        <script>
                                                            window.onload = () => { window.print(); window.close(); }
                                                        </script>
                                                    </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                        }
                                    }
                                }}
                                className="w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2"
                            >
                                <Printer className="size-4" />
                                Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
