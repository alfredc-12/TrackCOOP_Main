"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, ShoppingCart, Plus, Minus, X, CheckCircle, Package, Image as ImageIcon, History, QrCode, Printer } from "lucide-react";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
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
}

interface MemberPOSProps {
    isPublicView?: boolean;
}

export default function MemberPOS({ isPublicView = false }: MemberPOSProps) {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);
    const [activeAdjustItemId, setActiveAdjustItemId] = useState<number | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment">("cart");
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online">("Cash");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentName, setPaymentName] = useState(isPublicView ? "" : "Juan Dela Cruz");
    const [paymentEmail, setPaymentEmail] = useState(isPublicView ? "" : "juandelacruz@gmail.com");
    const [paymentContact, setPaymentContact] = useState(isPublicView ? "" : "09123456789");
    const [isConfirmCheckoutModalOpen, setIsConfirmCheckoutModalOpen] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<any>(null);

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");

    const [cartSlot, setCartSlot] = useState<Element | null>(null);
    const [mobileCartSlot, setMobileCartSlot] = useState<Element | null>(null);

    useEffect(() => {
        fetchInventory();

        const interval = setInterval(() => {
            fetchInventory();
        }, 5000); // Poll inventory every 5 seconds

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isPublicView) {
            setCartSlot(document.getElementById('store-header-cart-slot'));
            setMobileCartSlot(document.getElementById('store-header-cart-slot-mobile'));
        }
    }, [isPublicView]);

    const fetchInventory = async () => {
        try {
            const res = await fetch("/api/inventory");
            if (res.ok) {
                const data = await res.json();
                setInventory(data);
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch("/api/pos/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
                setHistorySearchQuery("");
                setIsHistoryOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    };

    const fetchHistoryQuietly = async () => {
        try {
            const res = await fetch("/api/pos/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    };

    useEffect(() => {
        if (isHistoryOpen) {
            const interval = setInterval(() => {
                fetchHistoryQuietly();
            }, 5000); // Poll history every 5 seconds while open
            return () => clearInterval(interval);
        }
    }, [isHistoryOpen]);

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

    const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const addToCart = (product: InventoryItem, qty: number = 1) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            const currentQty = existingItem ? existingItem.quantity : 0;
            const availableToSell = product.stock - (product.pending_qty || 0);

            if (currentQty + qty > availableToSell) {
                alert(`Cannot add more. Only ${availableToSell} items are currently available to buy (some are pending).`);
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
                maxStock: product.stock,
                img: product.img,
                category: product.category
            }];
        });
    };

    const updateCartQuantity = (id: number, delta: number) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === id) {
                const newQuantity = item.quantity + delta;
                if (newQuantity > item.maxStock) {
                    alert(`Maximum stock reached for ${item.name}.`);
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
        if (!paymentName.trim()) {
            alert("Please enter your Name.");
            return;
        }
        if (!paymentEmail.trim()) {
            alert("Please enter your Email account.");
            return;
        }
        if (!paymentContact.trim()) {
            alert("Please enter your Contact Number.");
            return;
        }
        if (paymentMethod === "Online" && !paymentReference.trim()) {
            alert("Please enter the GCash reference number.");
            return;
        }

        setIsConfirmCheckoutModalOpen(true);
    };

    const processCheckout = async () => {

        try {
            const res = await fetch("/api/pos/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: cart, paymentMethod, paymentReference, paymentName, paymentEmail, paymentContact }),
            });

            if (res.ok) {
                setIsConfirmCheckoutModalOpen(false);
                setIsCartOpen(false);
                setCheckoutSuccess(true);
                setCart([]);
                setCheckoutStep("cart");
                setPaymentMethod("Cash");
                setPaymentReference("");
                setPaymentEmail("juandelacruz@gmail.com");
                setPaymentContact("09123456789");
                fetchInventory(); // Refresh stock
            } else {
                const data = await res.json();
                alert(data.error || "Checkout failed");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            alert("An error occurred during checkout.");
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-white sm:p-8 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-6rem)] relative">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-[#1e293b]">Cooperative Shop</h2>
                    <p className="text-sm text-[#64748b] mt-1">Order agricultural supplies directly from the cooperative.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Sort Dropdown moved here */}
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                        >
                            <option value="name-asc">Sort by: Name (A-Z)</option>
                            <option value="price-asc">Sort by: Price (Low to High)</option>
                            <option value="price-desc">Sort by: Price (High to Low)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {!isPublicView && (
                        <button
                            onClick={() => {
                                fetchHistory();
                                setIsHistoryOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-[#1e293b] shadow-sm hover:bg-gray-50 transition relative"
                        >
                            <History className="size-4" />
                            Order History
                        </button>
                    )}
                    
                    {/* In Member Dashboard, render normally. In Public View, it will be portaled! */}
                    {!isPublicView && (
                        <button
                            onClick={() => {
                                setIsCartOpen(true);
                                setCheckoutStep("cart");
                            }}
                            className="relative flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
                        >
                            <ShoppingCart className="size-4" />
                            My Cart
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-200">
                                    {cart.reduce((total, item) => total + item.quantity, 0)}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Portals for Public View Navbar */}
            {isPublicView && cartSlot && createPortal(
                <button
                    onClick={() => {
                        setIsCartOpen(true);
                        setCheckoutStep("cart");
                    }}
                    className="relative flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90 mr-2"
                >
                    <ShoppingCart className="size-4" />
                    My Cart
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-200">
                            {cart.reduce((total, item) => total + item.quantity, 0)}
                        </span>
                    )}
                </button>,
                cartSlot
            )}
            
            {isPublicView && mobileCartSlot && createPortal(
                <button
                    onClick={() => {
                        setIsCartOpen(true);
                        setCheckoutStep("cart");
                    }}
                    className="relative flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
                >
                    <ShoppingCart className="size-4" />
                    My Cart
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-200">
                            {cart.reduce((total, item) => total + item.quantity, 0)}
                        </span>
                    )}
                </button>,
                mobileCartSlot
            )}

            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Products..."
                            className="w-full rounded-full border border-gray-200 bg-[#f8fafc] py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                        />
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {["All", "Harvested Goods", "Supplies", "Seeds", "Fertilizers"].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategory === cat
                                ? "bg-[#123D2A] text-white shadow-sm"
                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-12">
                {filteredAndSortedInventory.length > 0 ? (
                    filteredAndSortedInventory.map(item => {
                        const cartItem = cart.find(c => c.id === item.id);

                        return (
                            <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 transition hover:shadow-lg">
                                <div className="relative h-48 bg-[#f4f7f9] p-4 flex items-center justify-center rounded-t-2xl overflow-hidden">
                                    <span className={`absolute left-4 top-4 rounded-md px-2.5 py-1 text-xs font-semibold text-white z-10 ${item.status === 'Available' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}>
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
                                    <h3 className="font-bold text-[#1e293b] mb-6 truncate leading-tight text-base">{item.name}</h3>

                                    <div className="flex justify-between items-center text-sm mb-3">
                                        <span className="text-[#94a3b8]">Quantity</span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-[#1e293b]">{item.stock - (item.pending_qty || 0)} pcs</span>
                                            {item.pending_qty ? (
                                                <span className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">({item.pending_qty} pending)</span>
                                            ) : null}
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
                                                <span className="font-bold text-[#1e293b] text-sm">{cartItem.quantity} In Cart</span>
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
                                                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition shadow-sm ${cartItem ? 'bg-white border border-[#123D2A] text-[#123D2A] hover:bg-gray-50' : 'bg-[#123D2A] text-white hover:bg-[#123D2A]/90'}`}>
                                                {cartItem ? `${cartItem.quantity} In Cart - Edit` : 'Add to Cart'}
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
                        <h3 className="text-xl font-bold text-[#1e293b]">No products found</h3>
                        <p className="text-gray-500 mt-2 text-sm">Try adjusting your search or category filters.</p>
                    </div>
                )}
            </div>

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
                                onClick={() => setIsCartOpen(false)}
                                className="rounded-full p-2 text-gray-400 transition hover:bg-white hover:text-gray-600 hover:shadow-sm"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {checkoutStep === "payment" ? (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <p className="font-semibold text-gray-700 mb-4">How would you like to pay?</p>
                                    <div className="flex gap-4 mb-6">
                                        <button 
                                            onClick={() => setPaymentMethod("Cash")}
                                            className={`flex-1 p-4 rounded-2xl border-2 transition ${paymentMethod === 'Cash' ? 'border-[#123D2A] bg-[#123D2A]/5 text-[#123D2A]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            <span className="block font-bold text-lg mb-1">💵 Cash</span>
                                            <span className="text-xs">Pay at the cooperative office</span>
                                        </button>
                                        <button 
                                            onClick={() => setPaymentMethod("Online")}
                                            className={`flex-1 p-4 rounded-2xl border-2 transition ${paymentMethod === 'Online' ? 'border-[#123D2A] bg-[#123D2A]/5 text-[#123D2A]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            <span className="block font-bold text-lg mb-1">📱 GCash</span>
                                            <span className="text-xs">Scan QR and enter reference</span>
                                        </button>
                                    </div>

                                    {paymentMethod === "Online" && (
                                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                                            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 inline-block">
                                                <QrCode className="size-32 text-gray-800" />
                                            </div>
                                            <p className="font-bold text-[#1e293b]">Scan to Pay via GCash</p>
                                            <p className="text-sm text-gray-500 mb-6">TrackCOOP Official Account: 0912-345-6789</p>
                                            
                                            <div className="w-full text-left">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Reference Number <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    value={paymentReference}
                                                    onChange={(e) => setPaymentReference(e.target.value)}
                                                    placeholder="e.g. 1029384756"
                                                    className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 flex flex-col animate-in zoom-in-95 duration-200">
                                        <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Customer Details</h3>
                                        <div className="w-full text-left">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                value={paymentName}
                                                onChange={(e) => setPaymentName(e.target.value)}
                                                placeholder="e.g. Juan Dela Cruz"
                                                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                            />
                                        </div>
                                        <div className="w-full text-left mt-4">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address <span className="text-red-500">*</span></label>
                                            <input 
                                                type="email" 
                                                value={paymentEmail}
                                                onChange={(e) => setPaymentEmail(e.target.value)}
                                                placeholder="e.g. juandelacruz@gmail.com"
                                                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                            />
                                        </div>
                                        <div className="w-full text-left mt-4">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number <span className="text-red-500">*</span></label>
                                            <input 
                                                type="tel" 
                                                value={paymentContact}
                                                onChange={(e) => setPaymentContact(e.target.value)}
                                                placeholder="e.g. 09123456789"
                                                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                            />
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
                                                        <span className="font-bold text-xs px-3 text-[#1e293b]">{item.quantity}</span>
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
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-gray-500 text-sm font-medium">Subtotal</span>
                                    <span className="font-bold text-[#1e293b]">₱ {totalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex items-center justify-between mb-6 pt-4 border-t border-gray-200">
                                    <span className="text-base font-bold text-[#1e293b]">Total</span>
                                    <span className="text-2xl font-bold text-[#123D2A]">₱ {totalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                                        disabled={isCheckingOut || (checkoutStep === "payment" && paymentMethod === "Online" && !paymentReference.trim())}
                                        className="flex-1 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isCheckingOut ? "Processing..." : checkoutStep === "cart" ? "Proceed to Checkout" : "Confirm Order"}
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
                            Your order has been successfully placed. It is now pending payment confirmation by the Chairman.
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
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Confirm Checkout</h2>
                        <p className="mb-6 text-sm text-gray-500">
                            Are you sure you want to proceed with this checkout?
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
                                className="flex-1 rounded-xl border border-transparent bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCheckingOut ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : null}
                                {isCheckingOut ? "Processing..." : "Confirm"}
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

                            {history.filter(order => order.sale_number.toLowerCase().includes(historySearchQuery.toLowerCase())).length === 0 ? (
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
                                                    order.sale_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {order.sale_status}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {order.items?.map((item: any, idx: number) => (
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
                                    {receiptOrder.items?.map((item: any, idx: number) => (
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

                            <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
                                <div className="flex justify-between items-center text-sm font-bold text-gray-900">
                                    <span>TOTAL</span>
                                    <span>₱{Number(receiptOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Payment Method</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {receiptOrder.payment_reference_id ? `GCash (${receiptOrder.reference_number})` : 'Cash'}
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
