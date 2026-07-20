"use client";

import { useState, useEffect } from "react";
import { Plus, X, Camera, Search, Image as ImageIcon, ChevronDown, Wheat, Sprout, AlertCircle, History, Activity, ShoppingBag, Banknote, Smartphone, Printer } from "lucide-react";
import { toast } from "sonner";

type StockHistory = {
    type: "add" | "deduct";
    amount: number;
    date: string;
};

export type InventoryItem = {
    id: number;
    name: string;
    category: string;
    price: number;
    cost_price: number;
    description: string;
    stock: number;
    pending_qty?: number;
    sold: number;
    status: string;
    img: string;
    history?: StockHistory[];
};

type EditableInventoryItem = Omit<InventoryItem, "price" | "cost_price" | "stock"> & {
    price: number | string;
    cost_price: number | string;
    stock: number | string;
};

type InventoryHistoryEntry = {
    id: number;
    type: "add" | "deduct";
    amount: number;
    date: string;
    inventoryItem?: {
        name?: string | null;
        img?: string | null;
    };
};

type PosOrderItem = {
    name: string;
    quantity: number | string;
    price: number | string;
};

type PosOrder = {
    id: number;
    sale_number: string;
    sale_date: string;
    sale_status: "Pending Payment" | "Paid" | string;
    payment_status?: string | null;
    total_amount: number | string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_contact?: string | null;
    payment_reference_id?: number | null;
    reference_number?: string | null;
    provider?: string | null;
    items?: PosOrderItem[];
};


export default function InventoryManagement() {
    const [isMounted, setIsMounted] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [orders, setOrders] = useState<PosOrder[]>([]);
    const [orderSearchQuery, setOrderSearchQuery] = useState("");

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

    const fetchOrdersQuietly = async () => {
        try {
            const res = await fetch("/api/pos/orders");
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const mountFrame = requestAnimationFrame(() => {
            setIsMounted(true);
            fetchInventory();
            fetchOrdersQuietly();
        });

        const interval = setInterval(() => {
            fetchInventory();
            fetchOrdersQuietly();
        }, 5000); // 5 seconds auto-refresh

        return () => {
            cancelAnimationFrame(mountFrame);
            clearInterval(interval);
        };
    }, []);
    const [editingItem, setEditingItem] = useState<EditableInventoryItem | null>(null);
    const [addingStockItem, setAddingStockItem] = useState<InventoryItem | null>(null);
    const [stockActionType, setStockActionType] = useState<"add" | "deduct">("add");
    const [stockToAdd, setStockToAdd] = useState("");
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [itemToDelete, setItemToDelete] = useState<EditableInventoryItem | null>(null);

    const [isGlobalHistoryModalOpen, setIsGlobalHistoryModalOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState<InventoryHistoryEntry[]>([]);
    const [pendingAction, setPendingAction] = useState<"add" | "edit" | "stock" | null>(null);
    const [stockErrorMsg, setStockErrorMsg] = useState<string | null>(null);
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);

    const fetchGlobalHistory = async () => {
        try {
            const res = await fetch("/api/inventory/history");
            if (res.ok) {
                const data = await res.json();
                setGlobalHistory(data);
                setIsGlobalHistoryModalOpen(true);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchOrders = async () => {
        try {
            const res = await fetch("/api/pos/orders");
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
                setOrderSearchQuery(""); // Reset search on open
                setIsOrdersModalOpen(true);
            }
        } catch (error) {
            console.error(error);
        }
    };



    const confirmPayment = async (orderId: number) => {
        setOrderToConfirmId(orderId);
    };

    const processConfirmPayment = async () => {
        if (orderToConfirmId === null) return;
        try {
            const res = await fetch(`/api/pos/orders/${orderToConfirmId}/confirm`, {
                method: "PUT"
            });
            if (res.ok) {
                toast.success("Payment confirmed!");
                setOrderToConfirmId(null);
                fetchOrdersQuietly();
                fetchInventory(); // Immediately update the inventory table since stock is deducted
            } else {
                toast.error("Failed to confirm payment.");
            }
        } catch {
            toast.error("An error occurred.");
        }
    };

    const rejectPayment = (orderId: number) => {
        setOrderToRejectId(orderId);
    };

    const processRejectPayment = async () => {
        if (orderToRejectId === null) return;
        try {
            const res = await fetch(`/api/pos/orders/${orderToRejectId}/reject`, {
                method: "PUT"
            });
            if (res.ok) {
                toast.success("Order rejected successfully!");
                setOrderToRejectId(null);
                fetchOrdersQuietly();
            } else {
                toast.error("Failed to reject order.");
            }
        } catch {
            toast.error("An error occurred.");
        }
    };

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");

    // Form State
    const [newItemName, setNewItemName] = useState("");
    const [newItemCategory, setNewItemCategory] = useState("Harvested Goods");
    const [newItemStock, setNewItemStock] = useState("");
    const [newItemPrice, setNewItemPrice] = useState("");
    const [newItemCostPrice, setNewItemCostPrice] = useState("");
    const [newItemDescription, setNewItemDescription] = useState("");
    const [newItemStatus, setNewItemStatus] = useState("Available");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [orderToConfirmId, setOrderToConfirmId] = useState<number | null>(null);
    const [orderToRejectId, setOrderToRejectId] = useState<number | null>(null);
    const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);

    useEffect(() => {
        if (isAddModalOpen || editingItem || addingStockItem || historyItem || itemToDelete || isGlobalHistoryModalOpen || pendingAction || isOrdersModalOpen || orderToConfirmId !== null || orderToRejectId !== null || receiptOrder !== null) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isAddModalOpen, editingItem, addingStockItem, historyItem, itemToDelete, isGlobalHistoryModalOpen, pendingAction, isOrdersModalOpen, orderToConfirmId, orderToRejectId, receiptOrder]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddItemClick = () => {
        if (!newItemName || !newItemStock || !newItemPrice || !newItemCostPrice) {
            toast.error("Please fill in all required fields.");
            return;
        }
        setPendingAction("add");
    };

    const handleAddItem = async () => {

        const stockNum = Number(newItemStock);
        const newItem = {
            name: newItemName,
            category: newItemCategory,
            price: Number(newItemPrice),
            cost_price: Number(newItemCostPrice),
            description: newItemDescription,
            stock: stockNum,
            status: newItemStatus,
            img: imagePreview || "",
        };

        try {
            const res = await fetch("/api/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItem),
            });
            if (res.ok) {
                fetchInventory();
                setIsAddModalOpen(false);
                setNewItemName("");
                setNewItemStock("");
                setNewItemPrice("");
                setNewItemCostPrice("");
                setNewItemDescription("");
                setNewItemStatus("Available");
                setImagePreview(null);
                toast.success("Item added successfully!");
            } else {
                toast.error("Failed to add item.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        }
    };

    const handleEditChange = (
        field: keyof EditableInventoryItem,
        value: EditableInventoryItem[keyof EditableInventoryItem],
    ) => {
        if (!editingItem) return;
        setEditingItem({ ...editingItem, [field]: value });
    };

    const saveEditItemClick = () => {
        if (!editingItem) return;
        if (!editingItem.name || editingItem.stock === "" || !editingItem.price || !editingItem.cost_price) {
            toast.error("Please fill in all required fields.");
            return;
        }
        setPendingAction("edit");
    };

    const handleStockClick = () => {
        if (!stockToAdd) {
            toast.error("Please enter quantity.");
            return;
        }

        if (stockActionType === "deduct" && addingStockItem) {
            const availableToTake = addingStockItem.stock - (addingStockItem.pending_qty || 0);
            if (Number(stockToAdd) > availableToTake) {
                setStockErrorMsg(`Cannot take ${stockToAdd} pcs.\n\nOnly ${availableToTake} items are currently available because some are reserved for pending orders.`);
                return;
            }
        }

        setPendingAction("stock");
    };

    const processStockUpdate = async () => {
        if (!addingStockItem || !stockToAdd) return;
        try {
            const res = await fetch(`/api/inventory/${addingStockItem.id}/stock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: stockToAdd, type: stockActionType }),
            });
            if (res.ok) {
                fetchInventory();
                setAddingStockItem(null);
                setStockToAdd("");
                setPendingAction(null);
                toast.success(`Stock ${stockActionType === "add" ? "added" : "deducted"} successfully!`);
            } else {
                const err = await res.json();
                toast.error(err.error || `Failed to ${stockActionType} stock.`);
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        }
    };

    const saveEditItem = async () => {
        if (!editingItem) return;
        try {
            const res = await fetch(`/api/inventory/${editingItem.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingItem),
            });
            if (res.ok) {
                fetchInventory();
                setEditingItem(null);
                toast.success("Changes saved successfully!");
            } else {
                toast.error("Failed to save changes.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        }
    };

    const handleDeleteItem = async () => {
        if (!editingItem) return;
        setItemToDelete(editingItem);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const res = await fetch(`/api/inventory/${itemToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                fetchInventory();
                setItemToDelete(null);
                setEditingItem(null);
                toast.success("Item deleted successfully!");
            } else {
                toast.error("Failed to delete item.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        }
    };

    const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
    
    const totalCashSales = orders
        .filter(o => o.sale_status === 'Paid' && !o.payment_reference_id)
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const totalGCashSales = orders
        .filter(o => o.sale_status === 'Paid' && o.payment_reference_id)
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const filteredAndSortedInventory = inventory
        .filter((item) => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "price-asc": return a.price - b.price;
                case "price-desc": return b.price - a.price;
                case "stock-asc": return a.stock - b.stock;
                case "stock-desc": return b.stock - a.stock;
                case "name-asc": default: return a.name.localeCompare(b.name);
            }
        });

    if (!isMounted) {
        return null; // Prevent hydration mismatches from browser extensions (e.g., password managers adding fdprocessedid)
    }

    return (
        <div className="flex-1 overflow-y-auto bg-white sm:p-8 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-6rem)]">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <div className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition hover:shadow-md">
                    <div className="p-3 mr-4 text-[#123D2A] bg-[#F8F1E5] rounded-xl">
                        <Wheat className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Total Products</p>
                        <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
                    </div>
                </div>

                <div className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition hover:shadow-md">
                    <div className="p-3 mr-4 text-emerald-600 bg-emerald-50 rounded-xl">
                        <Sprout className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Total Stock Value</p>
                        <p className="text-2xl font-bold text-gray-900">₱ {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition hover:shadow-md">
                    <div className="p-3 mr-4 text-green-600 bg-green-50 rounded-xl">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Total Cash Sales</p>
                        <p className="text-2xl font-bold text-gray-900">₱ {totalCashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition hover:shadow-md">
                    <div className="p-3 mr-4 text-blue-600 bg-blue-50 rounded-xl">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Total GCash Sales</p>
                        <p className="text-2xl font-bold text-gray-900">₱ {totalGCashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-[#1e293b]">All Inventory Items</h2>
                    <p className="text-sm text-[#64748b] mt-1">Manage all inventory across warehouses in real-time.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchOrders}
                        className="relative flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-[#1e293b] shadow-sm hover:bg-gray-50 transition"
                    >
                        <ShoppingBag className="size-4" /> Orders & Payments
                        {orders.filter(o => o.sale_status === 'Pending Payment').length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                                {orders.filter(o => o.sale_status === 'Pending Payment').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={fetchGlobalHistory}
                        className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-[#1e293b] shadow-sm hover:bg-gray-50 transition"
                    >
                        <Activity className="size-4" /> Activity Log
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90 transition"
                    >
                        <Plus className="size-4" /> Add Item
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
                                <option value="stock-asc">Sort by: Stock (Low to High)</option>
                                <option value="stock-desc">Sort by: Stock (High to Low)</option>
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

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-12">
                {filteredAndSortedInventory.length > 0 ? (
                    filteredAndSortedInventory.map(item => (
                        <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 transition hover:shadow-lg">
                            <div className="relative h-48 bg-[#f4f7f9] p-4 flex items-center justify-center rounded-t-2xl overflow-hidden">
                                <span className={`absolute left-4 top-4 rounded-md px-2.5 py-1 text-xs font-semibold text-white z-10 ${item.status === 'Available' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                                    }`}>
                                    {item.status}
                                </span>
                                <button
                                    onClick={() => setHistoryItem(item)}
                                    className="absolute right-4 top-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-gray-600 hover:text-blue-600 hover:bg-white transition"
                                    title="View History"
                                >
                                    <History className="size-4" />
                                </button>
                                {item.img ? (
                                    <img src={item.img} alt={item.name} className="absolute inset-0 w-full h-full object-cover transition duration-300 hover:scale-105" />
                                ) : (
                                    <ImageIcon className="size-16 text-gray-300 z-0" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col p-5">
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

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingItem(item)}
                                        className="flex-1 rounded-xl bg-[#f8fafc] py-2 text-xs font-semibold text-[#64748b] transition hover:bg-[#e2e8f0] border border-gray-100">
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => { setStockActionType("add"); setAddingStockItem(item); }}
                                        className="flex-1 rounded-xl bg-[#123D2A] py-2 text-xs font-semibold text-white transition hover:bg-[#123D2A]/90 shadow-sm">
                                        + Stock
                                    </button>
                                    <button
                                        onClick={() => { setStockActionType("deduct"); setAddingStockItem(item); }}
                                        className="flex-1 rounded-xl bg-orange-100 text-orange-700 py-2 text-xs font-semibold transition hover:bg-orange-200 shadow-sm">
                                        - Take
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <Wheat className="size-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">No items found</h3>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your search or category filters.</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">Add New Item</h2>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="grid gap-4">
                            <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 transition hover:border-[#0F9D58] hover:bg-[#F8F1E5]/50 overflow-hidden">
                                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0" />

                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="absolute inset-0 z-10 w-full h-full object-cover opacity-60" />
                                ) : (
                                    <>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#123D2A]/10 text-[#0F9D58] z-10">
                                            <Camera className="size-6" />
                                        </div>
                                        <p className="mt-3 text-sm font-semibold text-[#1e293b] z-10">Upload item photo</p>
                                    </>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Item Name</label>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    placeholder="e.g. Rice Seeds"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Category</label>
                                    <select
                                        value={newItemCategory}
                                        onChange={(e) => setNewItemCategory(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    >
                                        <option>Harvested Goods</option>
                                        <option>Supplies</option>
                                        <option>Seeds</option>
                                        <option>Fertilizers</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Initial Stock (pcs)</label>
                                    <input
                                        type="number"
                                        value={newItemStock}
                                        onChange={(e) => setNewItemStock(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Selling Price (₱)</label>
                                    <input
                                        type="number"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        placeholder="e.g. 1500"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Cost Price (₱)</label>
                                    <input
                                        type="number"
                                        value={newItemCostPrice}
                                        onChange={(e) => setNewItemCostPrice(e.target.value)}
                                        placeholder="e.g. 1200"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Status</label>
                                    <select
                                        value={newItemStatus}
                                        onChange={(e) => setNewItemStatus(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    >
                                        <option>Available</option>
                                        <option>Unavailable</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Description (Optional)</label>
                                <textarea
                                    value={newItemDescription}
                                    onChange={(e) => setNewItemDescription(e.target.value)}
                                    placeholder="Enter item description..."
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58] resize-none h-24"
                                />
                            </div>

                            <button
                                onClick={handleAddItemClick}
                                className="mt-4 w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                            >
                                Add to Inventory
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">Edit Item Details</h2>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="grid gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Item Name</label>
                                <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => handleEditChange('name', e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Category</label>
                                    <select
                                        value={editingItem.category}
                                        onChange={(e) => handleEditChange('category', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    >
                                        <option>Harvested Goods</option>
                                        <option>Supplies</option>
                                        <option>Seeds</option>
                                        <option>Fertilizers</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Stock (pcs)</label>
                                    <input
                                        type="number"
                                        value={editingItem.stock}
                                        onChange={(e) => handleEditChange('stock', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Selling Price (₱)</label>
                                    <input
                                        type="number"
                                        value={editingItem.price}
                                        onChange={(e) => handleEditChange('price', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Cost Price (₱)</label>
                                    <input
                                        type="number"
                                        value={editingItem.cost_price}
                                        onChange={(e) => handleEditChange('cost_price', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Status</label>
                                    <select
                                        value={editingItem.status}
                                        onChange={(e) => handleEditChange('status', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    >
                                        <option>Available</option>
                                        <option>Unavailable</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Description (Optional)</label>
                                <textarea
                                    value={editingItem.description || ""}
                                    onChange={(e) => handleEditChange('description', e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58] resize-none h-24"
                                />
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleDeleteItem}
                                    className="w-1/3 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 hover:border-red-300"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={saveEditItemClick}
                                    className="w-2/3 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add/Deduct Stock Modal */}
            {addingStockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200 h-[380px] flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">
                                {stockActionType === "add" ? "Add Stock" : "Deduct Stock"}
                            </h2>
                            <button
                                onClick={() => {
                                    setAddingStockItem(null);
                                    setStockToAdd("");
                                }}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1">
                            <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-1">Item:</p>
                                <p className="font-bold text-gray-900">{addingStockItem.name}</p>
                                <p className="text-xs text-gray-400 mt-1">Current Stock: {addingStockItem.stock} pcs</p>
                            </div>

                            <div className="mb-4">
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">
                                    Quantity to {stockActionType === "add" ? "Add" : "Deduct"}
                                </label>
                                <input
                                    type="number"
                                    value={stockToAdd}
                                    onChange={(e) => setStockToAdd(e.target.value)}
                                    placeholder="e.g. 50"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleStockClick}
                            className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition ${
                                stockActionType === "add"
                                    ? "bg-[#123D2A] hover:bg-[#123D2A]/90"
                                    : "bg-orange-600 hover:bg-orange-700"
                                }`}
                        >
                            Confirm {stockActionType === "add" ? "Add" : "Deduct"}
                        </button>
                    </div>
                </div>
            )}
            {/* Item History Modal */}
            {historyItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-[#1e293b]">Stock History</h2>
                                <p className="text-sm text-gray-500 mt-1">{historyItem.name}</p>
                            </div>
                            <button
                                onClick={() => setHistoryItem(null)}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {historyItem.history && historyItem.history.length > 0 ? (
                                <div className="space-y-4">
                                    {historyItem.history.map((log, idx) => (
                                        <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-3">
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${log.type === 'add' ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {log.type === 'add' ? '+' : '-'}{log.amount} pcs
                                                </span>
                                                <span suppressHydrationWarning className="text-xs text-gray-500 mt-0.5">
                                                    {new Date(log.date).toLocaleString()}
                                                </span>
                                            </div>
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                {log.type === 'add' ? 'Added' : 'Deducted'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-gray-500">
                                    <History className="size-8 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm">No history records found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex justify-center">
                            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <AlertCircle className="size-8" />
                            </div>
                        </div>
                        <h3 className="mb-2 text-center text-xl font-bold text-gray-900">Delete Item?</h3>
                        <p className="mb-6 text-center text-sm text-gray-500">
                            Are you sure you want to delete <span className="font-bold text-gray-700">{itemToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="flex-1 rounded-xl border border-transparent bg-red-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global History Modal */}
            {isGlobalHistoryModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#123D2A]/10 text-[#123D2A] rounded-lg">
                                    <Activity className="size-5" />
                                </div>
                                <h2 className="text-xl font-bold text-[#1e293b]">Global Stock Activity Log</h2>
                            </div>
                            <button
                                onClick={() => setIsGlobalHistoryModalOpen(false)}
                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-gray-50/50">
                            {globalHistory.length > 0 ? (
                                globalHistory.map((log) => (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                        {log.inventoryItem?.img ? (
                                            <img src={log.inventoryItem.img} alt="item" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                                <ImageIcon className="size-6" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800 text-sm">{log.inventoryItem?.name || "Unknown Item"}</h3>
                                            <p suppressHydrationWarning className="text-xs text-gray-500">{new Date(log.date).toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${log.type === 'add' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {log.type === 'add' ? '+' : '-'}{log.amount} pcs
                                            </span>
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                                                {log.type === 'add' ? 'Added' : 'Deducted'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-gray-500">
                                    <Activity className="size-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-base font-semibold text-gray-600">No stock activity yet.</p>
                                    <p className="text-sm mt-1">Changes to stock will appear here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Error Modal */}
            {stockErrorMsg && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <AlertCircle className="size-8" />
                            </div>
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-gray-900">Not Enough Stock</h3>
                        <p className="mb-6 text-sm text-gray-500 whitespace-pre-line">
                            {stockErrorMsg}
                        </p>
                        <button
                            onClick={() => setStockErrorMsg(null)}
                            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Generic Action Confirmation Modal */}
            {pendingAction && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200 h-[380px] flex flex-col justify-between">
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="mb-4 flex justify-center">
                                <div className="flex size-16 items-center justify-center rounded-full bg-[#123D2A]/10 text-[#123D2A]">
                                    <AlertCircle className="size-8" />
                                </div>
                            </div>
                            <h3 className="mb-2 text-center text-xl font-bold text-gray-900">
                                {pendingAction === 'add' ? 'Confirm Addition' : pendingAction === 'edit' ? 'Confirm Changes' : `Confirm ${stockActionType === 'add' ? 'Add' : 'Deduct'} Stock`}
                            </h3>
                            <p className="text-center text-sm text-gray-500">
                                {pendingAction === 'add' && `Are you sure you want to add ${newItemName} to the inventory?`}
                                {pendingAction === 'edit' && `Are you sure you want to save the changes for ${editingItem?.name}?`}
                                {pendingAction === 'stock' && `Are you sure you want to ${stockActionType === 'add' ? 'add' : 'deduct'} ${stockToAdd} pcs to ${addingStockItem?.name}?`}
                            </p>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setPendingAction(null)}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (pendingAction === 'add') {
                                        handleAddItem();
                                        setPendingAction(null);
                                    } else if (pendingAction === 'edit') {
                                        saveEditItem();
                                        setPendingAction(null);
                                    } else if (pendingAction === 'stock') {
                                        processStockUpdate();
                                    }
                                }}
                                className={`flex-1 rounded-xl border border-transparent py-3 text-sm font-bold text-white shadow-sm transition ${(pendingAction === 'stock' && stockActionType === 'deduct')
                                        ? "bg-orange-600 hover:bg-orange-700"
                                        : "bg-[#123D2A] hover:bg-[#123D2A]/90"
                                    }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Orders & Payments Modal */}
            {isOrdersModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6">
                    <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-[#f8fafc] px-6 py-5">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <ShoppingBag className="size-5 text-[#123D2A]" />
                                    Orders & Payments
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Manage member orders and confirm payments.</p>
                            </div>
                            <button
                                onClick={() => setIsOrdersModalOpen(false)}
                                className="rounded-full p-2 text-gray-400 transition hover:bg-white hover:text-gray-600 hover:shadow-sm"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                            <div className="mb-6 relative w-full">
                                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={orderSearchQuery}
                                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                                    placeholder="Search by Order Number or Customer Name..."
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58] shadow-sm"
                                />
                            </div>

                            {orders.filter(order => order.sale_number.toLowerCase().includes(orderSearchQuery.toLowerCase()) || (order.customer_name || '').toLowerCase().includes(orderSearchQuery.toLowerCase())).length > 0 ? (
                                <div className="grid gap-4">
                                    {orders.filter(order => order.sale_number.toLowerCase().includes(orderSearchQuery.toLowerCase()) || (order.customer_name || '').toLowerCase().includes(orderSearchQuery.toLowerCase())).map((order) => (
                                        <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-gray-100 pb-4">
                                                <div>
                                                    <p className="font-bold text-[#1e293b] text-lg">{order.sale_number}</p>
                                                    <p className="text-sm font-medium text-gray-600 mt-1">Customer: {order.customer_name || 'Walk-in'}</p>
                                                    <p className="text-xs text-gray-500">Email: {order.customer_email || 'N/A'} | Contact: {order.customer_contact || 'N/A'}</p>
                                                    <p suppressHydrationWarning className="text-xs text-gray-400 mt-0.5">{new Date(order.sale_date).toLocaleString()}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.sale_status === 'Pending Payment' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                            order.sale_status === 'Paid' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {order.sale_status}
                                                    </span>
                                                    {order.sale_status === 'Pending Payment' && (
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => rejectPayment(order.id)}
                                                                className="text-xs font-bold text-red-600 px-3 py-1.5 rounded-lg transition border border-red-200 hover:bg-red-50 shadow-sm"
                                                            >
                                                                Reject
                                                            </button>
                                                            <button 
                                                                onClick={() => confirmPayment(order.id)}
                                                                className="text-xs font-bold text-white px-3 py-1.5 rounded-lg transition shadow-sm bg-[#123D2A] hover:bg-[#123D2A]/90"
                                                            >
                                                                {order.payment_reference_id ? 'Verify Payment' : 'Confirm Payment'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {order.sale_status === 'Paid' && (
                                                        <button 
                                                            onClick={() => setReceiptOrder(order)}
                                                            className="text-xs font-bold text-[#123D2A] px-3 py-1.5 rounded-lg transition border border-[#123D2A]/20 hover:bg-[#123D2A]/10 shadow-sm flex items-center gap-1.5"
                                                        >
                                                            <Printer className="size-3.5" />
                                                            View Receipt
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Items</p>
                                                {order.items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-700 font-medium">{item.quantity}x {item.name}</span>
                                                        <span className="text-gray-600">₱{(Number(item.price) * Number(item.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {order.payment_reference_id && (
                                                <div className="mb-4 bg-blue-50 rounded-xl p-4 border border-blue-100 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Online Payment Details</p>
                                                        <p className="text-sm font-semibold text-gray-800">Provider: {order.provider}</p>
                                                        <p className="text-sm text-gray-600">Ref No: <span className="font-mono font-bold">{order.reference_number}</span></p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center bg-[#f8fafc] p-3 rounded-xl border border-gray-100">
                                                <span className="font-bold text-gray-700">Total Amount</span>
                                                <span className="font-bold text-[#123D2A] text-xl">₱{Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center flex flex-col items-center">
                                    <div className="bg-gray-100 p-4 rounded-full mb-4">
                                        <ShoppingBag className="size-12 text-gray-300" />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-600">No orders found.</p>
                                    <p className="text-sm text-gray-500 mt-1">Pending and completed orders will appear here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Payment Modal */}
            {orderToConfirmId !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Verify Payment</h2>
                        <p className="mb-6 text-sm text-gray-500">
                            Are you sure you want to verify this payment? This will finalize the order and deduct the items from stock.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setOrderToConfirmId(null)}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processConfirmPayment}
                                className="flex-1 rounded-xl border border-transparent bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                            >
                                Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Payment Modal */}
            {orderToRejectId !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertCircle className="size-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Reject Order</h2>
                        <p className="mb-6 text-sm text-gray-500">
                            Are you sure you want to reject this order? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setOrderToRejectId(null)}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processRejectPayment}
                                className="flex-1 rounded-xl border border-transparent bg-red-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                            >
                                Reject
                            </button>
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
                                        // A simple print approach for React without a library
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
