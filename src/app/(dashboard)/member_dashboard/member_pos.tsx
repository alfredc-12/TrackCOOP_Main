"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, ShoppingCart, Plus, Minus, X, CheckCircle, Package, Image as ImageIcon } from "lucide-react";

// Using the same INITIAL_INVENTORY from Chairman POS
type InventoryItem = {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    sold: number;
    status: string;
    img: string;
};

const INITIAL_INVENTORY: InventoryItem[] = [
    { id: "SKU019832", name: "Harvested Palay (per sack)", category: "Harvested Goods", price: 1100, stock: 12, sold: 40, status: "Available", img: "https://picsum.photos/seed/palay/500/300" },
    { id: "SKU019833", name: "Organic Fertilizer (50kg)", category: "Fertilizers", price: 850, stock: 20, sold: 300, status: "Available", img: "https://picsum.photos/seed/fertilizer/500/300" },
    { id: "SKU019834", name: "Pesticide Alpha (1L)", category: "Supplies", price: 1200, stock: 30, sold: 120, status: "Available", img: "https://picsum.photos/seed/pesticide/500/300" },
    { id: "SKU019835", name: "Rice Seeds - Jasmine", category: "Seeds", price: 2100, stock: 7, sold: 500, status: "Available", img: "https://picsum.photos/seed/jasmine/500/300" },
    { id: "SKU019836", name: "Corn Seeds - Yellow", category: "Seeds", price: 1800, stock: 156, sold: 400, status: "Available", img: "https://picsum.photos/seed/corn/500/300" },
    { id: "SKU019837", name: "Tomato Seeds", category: "Seeds", price: 50, stock: 0, sold: 50, status: "Unavailable", img: "https://picsum.photos/seed/tomato/500/300" },
    { id: "SKU019838", name: "Carrot Seeds", category: "Seeds", price: 150, stock: 3, sold: 10, status: "Available", img: "https://picsum.photos/seed/carrot/500/300" },
    { id: "SKU019839", name: "Onion Seeds", category: "Seeds", price: 300, stock: 0, sold: 20, status: "Unavailable", img: "https://picsum.photos/seed/onion/500/300" }
];

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    maxStock: number;
    img: string;
    category: string;
}

export default function MemberPOS() {
    const [inventory] = useState(INITIAL_INVENTORY);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);
    const [activeAdjustItemId, setActiveAdjustItemId] = useState<string | null>(null);

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");

    useEffect(() => {
        if (isCartOpen || checkoutSuccess) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isCartOpen, checkoutSuccess]);

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
            if (existingItem) {
                if (existingItem.quantity + qty > product.stock) {
                    alert(`Cannot add more. Only ${product.stock} in stock.`);
                    return prevCart;
                }
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

    const updateCartQuantity = (id: string, delta: number) => {
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

    const removeFromCart = (id: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== id));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;
        setIsCartOpen(false);
        setCheckoutSuccess(true);
        setCart([]);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-white sm:p-8 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-6rem)] relative">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-[#1e293b]">Cooperative Shop</h2>
                    <p className="text-sm text-[#64748b] mt-1">Order agricultural supplies directly from the cooperative.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCartOpen(true)}
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
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Products..."
                            className="w-full rounded-full border border-gray-200 bg-[#f8fafc] py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                            >
                                <option value="name-asc">Sort by: Name (A-Z)</option>
                                <option value="price-asc">Sort by: Price (Low to High)</option>
                                <option value="price-desc">Sort by: Price (High to Low)</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
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
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[#1e293b]">{item.stock} pcs</span>
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
                                                    disabled={cartItem.quantity >= item.stock}
                                                    className={`p-1.5 rounded-lg transition ${cartItem.quantity >= item.stock ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-white hover:shadow-sm'}`}
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
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-[#1e293b]">Your Cart</h2>
                            </div>
                            <button
                                onClick={() => setIsCartOpen(false)}
                                className="rounded-full p-2 text-gray-400 bg-gray-50 transition hover:bg-gray-100 hover:text-gray-800"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {cart.length > 0 ? (
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
                                <button
                                    onClick={handleCheckout}
                                    className="w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2"
                                >
                                    Proceed to Checkout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {checkoutSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-300">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mb-6 border border-green-100">
                            <CheckCircle className="size-8 text-[#22c55e]" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#1e293b] mb-2">Order Successful!</h2>
                        <p className="text-gray-500 text-sm mb-8">
                            Your order has been submitted to the cooperative. Please proceed to the office for pickup and payment.
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
        </div>
    );
}
