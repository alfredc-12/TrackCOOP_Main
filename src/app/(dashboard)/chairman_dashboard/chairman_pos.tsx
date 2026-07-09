"use client";

import { useState, useEffect } from "react";
import { Plus, X, Camera, Search, ScanLine, Image as ImageIcon, ChevronDown, Wheat, Sprout, Leaf, AlertCircle, History } from "lucide-react";

const INITIAL_INVENTORY: any[] = [
    { id: "SKU019832", name: "Harvested Palay (per sack)", category: "Harvested Goods", price: 1100, stock: 12, sold: 40, status: "Available", img: "https://picsum.photos/seed/palay/500/300" },
    { id: "SKU019833", name: "Organic Fertilizer (50kg)", category: "Fertilizers", price: 850, stock: 20, sold: 300, status: "Available", img: "https://picsum.photos/seed/fertilizer/500/300" },
    { id: "SKU019834", name: "Pesticide Alpha (1L)", category: "Supplies", price: 1200, stock: 30, sold: 120, status: "Available", img: "https://picsum.photos/seed/pesticide/500/300" },
    { id: "SKU019835", name: "Rice Seeds - Jasmine", category: "Seeds", price: 2100, stock: 7, sold: 500, status: "Available", img: "https://picsum.photos/seed/jasmine/500/300" },
    { id: "SKU019836", name: "Corn Seeds - Yellow", category: "Seeds", price: 1800, stock: 156, sold: 400, status: "Available", img: "https://picsum.photos/seed/corn/500/300" },
    { id: "SKU019837", name: "Tomato Seeds", category: "Seeds", price: 50, stock: 0, sold: 50, status: "Unavailable", img: "https://picsum.photos/seed/tomato/500/300" },
    { id: "SKU019838", name: "Carrot Seeds", category: "Seeds", price: 150, stock: 3, sold: 10, status: "Available", img: "https://picsum.photos/seed/carrot/500/300" },
    { id: "SKU019839", name: "Onion Seeds", category: "Seeds", price: 300, stock: 0, sold: 20, status: "Unavailable", img: "https://picsum.photos/seed/onion/500/300" }
];

export default function InventoryManagement() {
    const [inventory, setInventory] = useState(INITIAL_INVENTORY);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [addingStockItem, setAddingStockItem] = useState<any>(null);
    const [stockToAdd, setStockToAdd] = useState("");
    const [historyItem, setHistoryItem] = useState<any>(null);

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");

    // Form State
    const [newItemName, setNewItemName] = useState("");
    const [newItemCategory, setNewItemCategory] = useState("Harvested Goods");
    const [newItemStock, setNewItemStock] = useState("");
    const [newItemPrice, setNewItemPrice] = useState("");
    const [newItemStatus, setNewItemStatus] = useState("Available");
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        if (isAddModalOpen || editingItem || addingStockItem || historyItem) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isAddModalOpen, editingItem, addingStockItem, historyItem]);

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

    const handleAddItem = () => {
        if (!newItemName || !newItemStock || !newItemPrice) {
            alert("Please fill in all fields.");
            return;
        }

        const stockNum = Number(newItemStock);
        const newItem = {
            id: `SKU0${Math.floor(Math.random() * 100000)}`,
            name: newItemName,
            category: newItemCategory,
            price: Number(newItemPrice),
            stock: stockNum,
            sold: 0,
            status: newItemStatus,
            img: imagePreview || "",
            history: [{ type: 'add', amount: stockNum, date: new Date().toISOString() }]
        };

        setInventory([newItem, ...inventory]);
        setIsAddModalOpen(false);

        setNewItemName("");
        setNewItemStock("");
        setNewItemPrice("");
        setNewItemStatus("Available");
        setImagePreview(null);
    };

    const handleEditChange = (field: string, value: any) => {
        setEditingItem({ ...editingItem, [field]: value });
    };

    const saveEditItem = () => {
        if (!editingItem.name || !editingItem.stock || !editingItem.price) {
            alert("Please fill in all fields.");
            return;
        }
        const oldItem = inventory.find((i: any) => i.id === editingItem.id);
        const newHistory = oldItem && oldItem.history ? [...oldItem.history] : [];
        if (oldItem && oldItem.stock !== Number(editingItem.stock)) {
            const stockDiff = Number(editingItem.stock) - oldItem.stock;
            newHistory.unshift({
                type: stockDiff > 0 ? 'add' : 'deduct',
                amount: Math.abs(stockDiff),
                date: new Date().toISOString()
            });
        }
        const updatedItem = {
            ...editingItem,
            price: Number(editingItem.price),
            stock: Number(editingItem.stock),
            history: newHistory
        };
        setInventory(inventory.map((item: any) => item.id === updatedItem.id ? updatedItem : item));
        setEditingItem(null);
    };

    const handleDeleteItem = () => {
        if (confirm("Are you sure you want to delete this item?")) {
            setInventory(inventory.filter((item: any) => item.id !== editingItem.id));
            setEditingItem(null);
        }
    };

    const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
    const availableCount = inventory.filter(item => item.status === "Available").length;
    const unavailableCount = inventory.filter(item => item.status === "Unavailable").length;

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
                        <Leaf className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Available Items</p>
                        <p className="text-2xl font-bold text-gray-900">{availableCount}</p>
                    </div>
                </div>

                <div className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition hover:shadow-md">
                    <div className="p-3 mr-4 text-red-600 bg-red-50 rounded-xl">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-500">Unavailable</p>
                        <p className="text-2xl font-bold text-gray-900">{unavailableCount}</p>
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
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#123D2A]/90"
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
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[#1e293b]">{item.stock} pcs</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm mb-5">
                                    <span className="text-[#94a3b8]">Price</span>
                                    <span className="font-bold text-[#1e293b]">₱ {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingItem(item)}
                                        className="flex-1 rounded-xl bg-[#f8fafc] py-2.5 text-sm font-semibold text-[#64748b] transition hover:bg-[#e2e8f0] border border-gray-100">
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => setAddingStockItem(item)}
                                        className="flex-1 rounded-xl bg-[#123D2A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#123D2A]/90 shadow-sm">
                                        Add Stock
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
                    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Price (₱)</label>
                                    <input
                                        type="number"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        placeholder="e.g. 1500"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
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

                            <button
                                onClick={handleAddItem}
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
                    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Price (₱)</label>
                                    <input
                                        type="number"
                                        value={editingItem.price}
                                        onChange={(e) => handleEditChange('price', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
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

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleDeleteItem}
                                    className="w-1/3 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 hover:border-red-300"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={saveEditItem}
                                    className="w-2/3 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Stock Modal */}
            {addingStockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">Add Stock</h2>
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

                        <div className="mb-4">
                            <p className="text-sm text-gray-500 mb-1">Item:</p>
                            <p className="font-bold text-gray-900">{addingStockItem.name}</p>
                            <p className="text-xs text-gray-400 mt-1">Current Stock: {addingStockItem.stock} pcs</p>
                        </div>

                        <div className="mb-6">
                            <label className="mb-1 block text-sm font-medium text-[#64748b]">Quantity to Add</label>
                            <input
                                type="number"
                                value={stockToAdd}
                                onChange={(e) => setStockToAdd(e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (!stockToAdd) return;
                                const newStock = addingStockItem.stock + Number(stockToAdd);
                                const newHistoryEntry = { type: 'add', amount: Number(stockToAdd), date: new Date().toISOString() };
                                const updatedItem = {
                                    ...addingStockItem,
                                    stock: newStock,
                                    history: [newHistoryEntry, ...(addingStockItem.history || [])]
                                };
                                setInventory(inventory.map((item: any) => item.id === updatedItem.id ? updatedItem : item));
                                setAddingStockItem(null);
                                setStockToAdd("");
                            }}
                            className="w-full rounded-xl bg-[#22c55e] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#22c55e]/90"
                        >
                            Confirm Add Stock
                        </button>
                    </div>
                </div>
            )}
            {/* Item History Modal */}
            {historyItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] flex flex-col">
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
                                    {historyItem.history.map((log: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-3">
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${log.type === 'add' ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {log.type === 'add' ? '+' : '-'}{log.amount} pcs
                                                </span>
                                                <span className="text-xs text-gray-500 mt-0.5">
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
        </div>
    );
}
