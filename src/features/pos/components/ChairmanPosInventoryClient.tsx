"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Camera, Search, Image as ImageIcon, ChevronDown, Wheat, Sprout, AlertCircle, History, Activity, ShoppingBag, Banknote, Smartphone, Printer, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { expressFetch } from "@/lib/express-api";
import { toast } from "sonner";
import { normalizeProductImage } from "../product-image-url";

type StockHistory = {
    type: "add" | "deduct";
    amount: number;
    date: string;
};

const STOCK_UNIT_OPTIONS = [
    "piece",
    "sack",
    "bag",
    "kg",
    "g",
    "liter",
    "ml",
    "bundle",
    "box",
    "pack",
    "bottle",
    "can",
    "tray",
    "crate",
    "roll",
    "set",
    "unit",
];

function formatQuantityUnit(quantity: number | string, unit?: string) {
    return `${Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || "piece"}`;
}

export type InventoryItem = {
    id: number;
    name: string;
    category: string;
    unit: string;
    price: number;
    cost_price: number;
    description: string;
    stock: number;
    pending_qty?: number;
    sold: number;
    status: string;
    img: string;
    reorder_level?: number;
    history?: StockHistory[];
};

type EditableInventoryItem = Omit<InventoryItem, "price" | "cost_price" | "stock"> & {
    price: number | string;
    cost_price: number | string;
    stock: number | string;
    margin?: number | string;
    reorder_level?: number | string;
};

type StockActivityLog = {
    id: number | string;
    type: "add" | "deduct";
    amount: number;
    date: string;
    inventoryItem?: Pick<InventoryItem, "name" | "img" | "unit"> | null;
};

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
    payment_status?: string;
    member_id?: number | null;
    subtotal_amount: number | string;
    discount_amount: number | string;
    total_amount: number | string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_contact?: string | null;
    payment_reference_id?: number | string | null;
    provider?: string | null;
    reference_number?: string | null;
    items?: PosOrderItem[];
};

function uniqueCategories(categories: string[]) {
    const categoryMap = new Map<string, string>();

    categories.forEach((category) => {
        const trimmedCategory = category.trim();
        if (!trimmedCategory) return;
        categoryMap.set(trimmedCategory.toLowerCase(), trimmedCategory);
    });

    return Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b));
}

type CategoryComboboxProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    categories: string[];
    placeholder?: string;
};

function CategoryCombobox({ label, value, onChange, categories, placeholder = "Select or type category" }: CategoryComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const searchValue = value.trim().toLowerCase();
    const selectedExistingCategory = categories.find((category) => category.toLowerCase() === searchValue);
    const matchingCategories = (isAddingCustom
        ? categories.filter((category) => !searchValue || category.toLowerCase().includes(searchValue))
        : categories
    ).slice(0, 8);

    return (
        <div className="relative">
            <label className="mb-1 block text-sm font-medium text-[#64748b]">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    readOnly={!isAddingCustom}
                    onChange={(event) => {
                        onChange(event.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                    <button
                        type="button"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            onChange("");
                            setIsAddingCustom(true);
                            setIsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#0F9D58] transition hover:bg-[#F8F1E5]"
                    >
                        <Plus className="size-4" />
                        Add category
                    </button>

                    {matchingCategories.map((category) => (
                        <button
                            key={category}
                            type="button"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                onChange(category);
                                setIsAddingCustom(false);
                                setIsOpen(false);
                            }}
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#1e293b] transition hover:bg-[#F8F1E5] ${selectedExistingCategory === category ? "bg-[#F8F1E5] font-semibold" : ""
                                }`}
                        >
                            <span className="font-medium">{category}</span>
                        </button>
                    ))}

                    {isAddingCustom && value.trim() && !selectedExistingCategory && (
                        <div className="px-3 py-2 text-xs font-semibold text-[#c78800]">
                            New category: {value.trim()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ThemedSelect({
    value,
    onChange,
    options,
    ariaLabel,
}: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    ariaLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value)?.label ?? value;

    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} className="flex w-full items-center justify-between rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-left text-sm font-medium text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20">
                <span>{selected}</span>
                <ChevronDown className={`size-4 text-[#52705D] transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-full z-[90] mt-2 overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]" role="listbox" aria-label={ariaLabel}>
                    {options.map((option) => (
                        <button key={option.value} type="button" role="option" aria-selected={value === option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${value === option.value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>
                            {option.label}{value === option.value && <span className="text-[#1F6B43]">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ChairmanPosInventoryClient() {
    const [isMounted, setIsMounted] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [inventoryError, setInventoryError] = useState<string | null>(null);
    const [isInventoryLoading, setIsInventoryLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
    const [orders, setOrders] = useState<PosOrder[]>([]);
    const [orderSearchQuery, setOrderSearchQuery] = useState("");
    const [orderStatusFilter, setOrderStatusFilter] = useState("All");
    const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
    const [inventoryPage, setInventoryPage] = useState(1);

    const fetchInventory = useCallback(async () => {
        try {
            const res = await expressFetch("/api/inventory");
            if (res.ok) {
                const data = await res.json();
                setInventory((data as InventoryItem[]).map(normalizeProductImage));
                setLastUpdated(new Date());
                setInventoryError(null);
            } else {
                setInventoryError("Unable to load inventory right now.");
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
            setInventoryError("Unable to connect to the inventory service.");
        } finally {
            setIsInventoryLoading(false);
        }
    }, []);

    const fetchOrdersQuietly = useCallback(async () => {
        try {
            const res = await expressFetch("/api/pos/orders");
            if (res.ok) {
                const data = await res.json();
                setOrders(data as PosOrder[]);
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    const refreshInventory = async () => {
        setIsRefreshing(true);
        await Promise.all([fetchInventory(), fetchOrdersQuietly()]);
        setIsRefreshing(false);
        toast.success("Inventory is up to date.");
    };

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setIsMounted(true);
            void fetchInventory();
            void fetchOrdersQuietly();
        }, 0);

        const intervalId = window.setInterval(() => {
            void fetchInventory();
            void fetchOrdersQuietly();
        }, 5000); // 5 seconds auto-refresh

        return () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(intervalId);
        };
    }, [fetchInventory, fetchOrdersQuietly]);
    const [editingItem, setEditingItem] = useState<EditableInventoryItem | null>(null);
    const [addingStockItem, setAddingStockItem] = useState<InventoryItem | null>(null);
    const [stockActionType, setStockActionType] = useState<"add" | "deduct">("add");
    const [stockToAdd, setStockToAdd] = useState("");
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [itemToDelete, setItemToDelete] = useState<EditableInventoryItem | null>(null);

    const [isGlobalHistoryModalOpen, setIsGlobalHistoryModalOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState<StockActivityLog[]>([]);
    const [activitySearchQuery, setActivitySearchQuery] = useState("");
    const [activityTypeFilter, setActivityTypeFilter] = useState<"All" | "add" | "deduct">("All");
    const [activityCurrentPage, setActivityCurrentPage] = useState(1);
    const [pendingAction, setPendingAction] = useState<"add" | "edit" | "stock" | null>(null);
    const [isActionProcessing, setIsActionProcessing] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [stockErrorMsg, setStockErrorMsg] = useState<string | null>(null);
    const fetchGlobalHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await expressFetch("/api/inventory/history");
            if (res.ok) {
                const data = await res.json();
                setGlobalHistory((data as StockActivityLog[]).map((log) => ({
                    ...log,
                    inventoryItem: log.inventoryItem ? normalizeProductImage(log.inventoryItem) : log.inventoryItem,
                })));
                setActivityCurrentPage(1);
                setIsGlobalHistoryModalOpen(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const fetchOrders = async () => {
        setIsOrdersLoading(true);
        setIsOrdersModalOpen(true);
        try {
            const res = await expressFetch("/api/pos/orders");
            if (res.ok) {
                const data = await res.json();
                setOrders(data as PosOrder[]);
                setOrderSearchQuery(""); // Reset search on open
                setOrderStatusFilter("All");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsOrdersLoading(false);
        }
    };



    const confirmPayment = async (orderId: number) => {
        setOrderToConfirmId(orderId);
        setConfirmDiscountAmount("");
        setConfirmDiscountError("");
    };

    const processConfirmPayment = async () => {
        if (orderToConfirmId === null) return;
        if (isConfirming) return;  // prevent double submission
        
        if (Number(confirmDiscountAmount) > 100) {
            setConfirmDiscountError("Discount cannot exceed 100%");
            return;
        }

        setIsConfirming(true);
        try {
            const confirmedOrder = orders.find(o => o.id === orderToConfirmId);
            const subtotal = Number(confirmedOrder?.subtotal_amount || confirmedOrder?.total_amount || 0);
            const memberDiscountAmount = Number(confirmedOrder?.discount_amount || 0);
            
            const additionalDiscountPercent = confirmDiscountAmount ? Number(confirmDiscountAmount) : 0;
            const additionalDiscountAmount = subtotal * (additionalDiscountPercent / 100);
            
            const totalDiscountAmount = memberDiscountAmount + additionalDiscountAmount;

            const res = await expressFetch(`/api/pos/orders/${orderToConfirmId}/confirm`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ discount_amount: totalDiscountAmount })
            });
            if (res.ok) {
                toast.success("Payment confirmed!");
                if (confirmedOrder) {
                    const newTotal = Math.max(0, subtotal - totalDiscountAmount);
                    
                    setReceiptOrder({ 
                        ...confirmedOrder, 
                        sale_status: 'Paid', 
                        payment_status: 'Paid',
                        discount_amount: totalDiscountAmount,
                        total_amount: newTotal,
                        subtotal_amount: subtotal
                    });
                }
                setOrderToConfirmId(null);
                fetchOrdersQuietly();
                fetchInventory(); // Immediately update the inventory table since stock is deducted
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || "Failed to confirm payment.");
            }
        } catch {
            toast.error("An error occurred.");
        } finally {
            setIsConfirming(false);
        }
    };

    const rejectPayment = (orderId: number) => {
        setOrderToRejectId(orderId);
        setRejectReason("");
    };

    const processRejectPayment = async () => {
        if (orderToRejectId === null) return;
        try {
            const res = await expressFetch(`/api/pos/orders/${orderToRejectId}/reject`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: rejectReason })
            });
            if (res.ok) {
                toast.success("Order cancelled successfully!");
                setOrderToRejectId(null);
                setRejectReason("");
                fetchOrdersQuietly();
            } else {
                toast.error("Failed to cancel order.");
            }
        } catch {
            toast.error("An error occurred.");
        }
    };

    const processRevokePayment = async () => {
        if (orderToRevokeId === null) return;
        setIsRevoking(true);
        try {
            const res = await expressFetch(`/api/pos/orders/${orderToRevokeId}/revoke`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: revokeReason })
            });
            if (res.ok) {
                toast.success("Payment revoked successfully!");
                setOrderToRevokeId(null);
                setRevokeReason("");
                fetchOrdersQuietly();
                fetchInventory(); // Inventory stock is updated
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || "Failed to revoke payment.");
            }
        } catch {
            toast.error("An error occurred.");
        } finally {
            setIsRevoking(false);
        }
    };

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("name-asc");

    // Form State
    const [newItemName, setNewItemName] = useState("");
    const [newItemCategory, setNewItemCategory] = useState("");
    const [newItemUnit, setNewItemUnit] = useState("piece");
    const [newItemStock, setNewItemStock] = useState("");
    const [newItemPrice, setNewItemPrice] = useState("");
    const [newItemCostPrice, setNewItemCostPrice] = useState("");
    const [newItemMargin, setNewItemMargin] = useState("");
    const [newItemReorderLevel, setNewItemReorderLevel] = useState("10");
    const [newItemDescription, setNewItemDescription] = useState("");
    const [newItemStatus, setNewItemStatus] = useState("Available");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [orderToConfirmId, setOrderToConfirmId] = useState<number | null>(null);
    const [orderToRejectId, setOrderToRejectId] = useState<number | null>(null);
    const [orderToRevokeId, setOrderToRevokeId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [revokeReason, setRevokeReason] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [confirmDiscountAmount, setConfirmDiscountAmount] = useState<string>("");
    const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);
    const [newItemErrors, setNewItemErrors] = useState<Record<string, string>>({});
    const [editItemErrors, setEditItemErrors] = useState<Record<string, string>>({});
    const [stockInputError, setStockInputError] = useState<string>("");
    const [confirmDiscountError, setConfirmDiscountError] = useState<string>("");


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
            if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
                toast.error("Use a PNG, JPG, GIF, or WebP image.");
                e.target.value = "";
                return;
            }
            if (file.size > 700 * 1024) {
                toast.error("Image must be 700 KB or smaller.");
                e.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingItem) return;
        if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 700 * 1024) {
            toast.error("Use a PNG, JPG, GIF, or WebP image up to 700 KB.");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const nextImage = reader.result as string;
            setEditingItem((current) => current ? { ...current, img: nextImage } : current);
        };
        reader.readAsDataURL(file);
    };

    const handleAddProductClick = () => {
        const errors: Record<string, string> = {};
        
        if (newItemName.trim().length < 2 || newItemName.trim().length > 120) errors.name = "Name must be 2–120 characters.";
        if (!newItemCategory.trim()) errors.category = "Category is required.";
        if (!newItemUnit) errors.unit = "Unit is required.";
        if (!newItemStock || !Number.isFinite(Number(newItemStock)) || Number(newItemStock) < 0) errors.stock = "Enter a valid stock amount.";
        if (!newItemCostPrice || !Number.isFinite(Number(newItemCostPrice)) || Number(newItemCostPrice) < 0) errors.cost_price = "Enter a valid cost price.";
        if (!newItemPrice || !Number.isFinite(Number(newItemPrice)) || Number(newItemPrice) < 0) errors.price = "Enter a valid selling price.";

        if (Object.keys(errors).length > 0) {
            setNewItemErrors(errors);
            toast.error("Please fix the highlighted fields.");
            return;
        }
        
        setNewItemErrors({});
        setPendingAction("add");
    };

    const handleAddProduct = async () => {
        setIsActionProcessing(true);

        const stockNum = Number(newItemStock);
        const newItem = {
            name: newItemName,
            category: newItemCategory.trim(),
            unit: newItemUnit,
            price: Number(newItemPrice),
            cost_price: Number(newItemCostPrice),
            description: newItemDescription,
            stock: stockNum,
            reorder_level: Number(newItemReorderLevel),
            status: newItemStatus,
            img: imagePreview || "",
        };

        try {
            const res = await expressFetch("/api/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItem),
            });
            if (res.ok) {
                fetchInventory();
                setIsAddModalOpen(false);
                setNewItemName("");
                setNewItemStock("");
                setNewItemUnit("piece");
                setNewItemPrice("");
                setNewItemCostPrice("");
                setNewItemReorderLevel("10");
                setNewItemDescription("");
                setNewItemCategory("");
                setNewItemStatus("Available");
                setImagePreview(null);
                setNewItemErrors({});
                toast.success("Product added successfully!");
            } else {
                toast.error("Failed to add product.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        } finally {
            setIsActionProcessing(false);
            setPendingAction(null);
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
        
        const errors: Record<string, string> = {};
        if (editingItem.name.trim().length < 2 || editingItem.name.trim().length > 120) errors.name = "Name must be 2–120 characters.";
        if (!editingItem.category.trim()) errors.category = "Category is required.";
        if (!editingItem.unit) errors.unit = "Unit is required.";
        if (editingItem.stock === "" || !Number.isFinite(Number(editingItem.stock)) || Number(editingItem.stock) < 0) errors.stock = "Enter a valid stock amount.";
        if (!Number.isFinite(Number(editingItem.cost_price)) || Number(editingItem.cost_price) < 0) errors.cost_price = "Enter a valid cost price.";
        if (!Number.isFinite(Number(editingItem.price)) || Number(editingItem.price) < 0) errors.price = "Enter a valid selling price.";

        if (Object.keys(errors).length > 0) {
            setEditItemErrors(errors);
            toast.error("Please fix the highlighted fields.");
            return;
        }

        setEditItemErrors({});
        setPendingAction("edit");
    };

    const handleStockClick = () => {
        if (!stockToAdd || !Number.isFinite(Number(stockToAdd)) || Number(stockToAdd) <= 0) {
            setStockInputError("Please enter quantity.");
            return;
        }

        if (stockActionType === "deduct" && addingStockItem) {
            const availableToTake = addingStockItem.stock - (addingStockItem.pending_qty || 0);
            if (Number(stockToAdd) > availableToTake) {
                setStockInputError(`Cannot take ${stockToAdd}. Only ${availableToTake} available.`);
                return;
            }
        }

        setStockInputError("");
        setPendingAction("stock");
    };

    const processStockUpdate = async () => {
        if (!addingStockItem || !stockToAdd) return;
        setIsActionProcessing(true);
        try {
            const res = await expressFetch(`/api/inventory/${addingStockItem.id}/stock`, {
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
        } finally {
            setIsActionProcessing(false);
            setPendingAction(null);
        }
    };

    const saveEditItem = async () => {
        if (!editingItem) return;
        setIsActionProcessing(true);

        try {
            const res = await expressFetch(`/api/inventory/${editingItem.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingItem),
            });
            if (res.ok) {
                fetchInventory();
                setEditingItem(null);
                setEditItemErrors({});
                toast.success("Changes saved successfully!");
            } else {
                toast.error("Failed to save changes.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        } finally {
            setIsActionProcessing(false);
            setPendingAction(null);
        }
    };

    const handleArchiveProduct = async () => {
        if (!editingItem) return;
        setItemToDelete(editingItem);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        try {
            const res = await expressFetch(`/api/inventory/${itemToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                fetchInventory();
                setItemToDelete(null);
                setEditingItem(null);
                toast.success("Product archived successfully!");
            } else {
                toast.error("Failed to archive product.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred.");
        } finally {
            setIsDeleting(false);
        }
    };

    const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);

    const totalCashSales = orders
        .filter(o => o.sale_status === 'Paid' && !o.payment_reference_id)
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const totalGCashSales = orders
        .filter(o => o.sale_status === 'Paid' && o.payment_reference_id)
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const existingCategories = useMemo(
        () => uniqueCategories(inventory.map((item) => item.category)),
        [inventory],
    );

    const categoryOptions = useMemo(
        () => existingCategories,
        [existingCategories],
    );

    const categoryTabs = useMemo(
        () => ["All", ...existingCategories],
        [existingCategories],
    );

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

    const lowStockCount = inventory.filter(item => {
        const availableStock = item.stock - (item.pending_qty || 0);
        return item.reorder_level && item.reorder_level > 0 && availableStock <= item.reorder_level;
    }).length;

    const hasActiveFilters = searchQuery.trim().length > 0 || selectedCategory !== "All";
    const clearFilters = () => {
        setSearchQuery("");
        setSelectedCategory("All");
        setInventoryPage(1);
    };

    const inventoryPageSize = 8;
    const inventoryPageCount = Math.max(1, Math.ceil(filteredAndSortedInventory.length / inventoryPageSize));
    const paginatedInventory = filteredAndSortedInventory.slice((inventoryPage - 1) * inventoryPageSize, inventoryPage * inventoryPageSize);

    const filteredActivityLogs = globalHistory.filter((log) => {
        const name = log.inventoryItem?.name?.toLowerCase() ?? "";
        return name.includes(activitySearchQuery.toLowerCase()) && (activityTypeFilter === "All" || log.type === activityTypeFilter);
    });
    const activityPageSize = 5;
    const activityPageCount = Math.max(1, Math.ceil(filteredActivityLogs.length / activityPageSize));
    const paginatedActivityLogs = filteredActivityLogs.slice((activityCurrentPage - 1) * activityPageSize, activityCurrentPage * activityPageSize);

    if (!isMounted) {
        return null; // Prevent hydration mismatches from browser extensions (e.g., password managers adding fdprocessedid)
    }

    return (
      <div className="-mx-4 -my-6 w-auto overflow-x-hidden bg-[#F5F8F3] p-4 sm:-mx-6 sm:p-5 lg:-mx-8 lg:-my-8 lg:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Branded overview banner */}
            <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-6 text-white shadow-[0_16px_34px_rgba(13,67,45,0.24)] sm:px-8 sm:py-7">
                <div className="absolute -right-10 -top-16 size-56 rounded-full border-[22px] border-[#D8F0DE]/10" />
                <div className="absolute -bottom-24 right-28 size-44 rounded-full bg-[#F6D354]/15 blur-2xl" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F6D354]">
                            <span className="h-2 w-2 rounded-full bg-[#F6D354] shadow-[0_0_0_5px_rgba(246,211,84,0.18)]" />
                            Cooperative operations
                        </div>
                        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Inventory Command Center</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Keep products available, monitor stock movement, and respond quickly to orders across the cooperative.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[#CDE8D4]/20 bg-[#D8F0DE]/10 px-4 py-3 backdrop-blur-sm">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-[#F6D354] text-[#0D432D] shadow-sm">
                            <Sprout className="size-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-white/60">Catalog health</p>
                            <p className="font-bold">{lowStockCount > 0 ? `${lowStockCount} product${lowStockCount > 1 ? "s" : ""} need attention` : "All stock levels healthy"}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative flex min-h-[122px] items-center overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
                    <div className="mr-2.5 shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43] shadow-sm">
                        <Wheat className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs font-bold text-gray-500">Total Products</p>
                        <p className="text-[10px] leading-4 text-gray-400">Active catalog products</p>
                        <p className="break-words text-[clamp(1.15rem,1.5vw,1.5rem)] font-black leading-7 text-[#123D2A]">{inventory.length}</p>
                    </div>
                </div>

                <div className="relative flex min-h-[122px] items-center overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
                    <div className={`mr-2.5 shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]`}>
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs font-bold text-gray-500">Low Stock Alerts</p>
                        <p className="text-[10px] leading-4 text-gray-400">At or below reorder level</p>
                        <p className={`break-words text-[clamp(1.15rem,1.5vw,1.5rem)] font-black leading-7 ${lowStockCount > 0 ? 'text-red-600' : 'text-[#123D2A]'}`}>{lowStockCount}</p>
                    </div>
                </div>

                <div className="relative flex min-h-[122px] items-center overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
                    <div className="mr-2.5 shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]">
                        <Sprout className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs font-bold text-gray-500">Total Stock Value</p>
                        <p className="text-[10px] leading-4 text-gray-400">Based on selling price</p>
                        <p className="whitespace-nowrap text-lg font-black leading-7 tracking-tight text-[#123D2A] sm:text-xl">₱ {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="relative flex min-h-[122px] items-center overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
                    <div className="mr-2.5 shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs font-bold text-gray-500">Cash Sales</p>
                        <p className="text-[10px] leading-4 text-gray-400">Paid POS orders</p>
                        <p className="whitespace-nowrap text-lg font-black leading-7 tracking-tight text-[#123D2A] sm:text-xl">₱ {totalCashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="relative flex min-h-[122px] items-center overflow-hidden rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
                    <div className="mr-2.5 shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs font-bold text-gray-500">GCash Sales</p>
                        <p className="text-[10px] leading-4 text-gray-400">Paid online orders</p>
                        <p className="whitespace-nowrap text-lg font-black leading-7 tracking-tight text-[#123D2A] sm:text-xl">₱ {totalGCashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="mb-6 rounded-2xl border border-[#DCE9DE] bg-white/75 p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#F2C94C] shadow-[0_0_0_4px_rgba(242,201,76,0.18)]" />
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#6B8A76]">Operations / Products</span>
                    </div>
                    <h2 className="text-3xl font-bold text-[#123D2A]">All Products</h2>
                    <p className="text-sm text-[#64748b] mt-1">Manage products, stock levels, and reorder alerts.</p>
                    <p className="mt-2 text-xs font-medium text-[#789181]">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading inventory…"}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchOrders}
                        disabled={isOrdersLoading}
                        className="relative flex items-center gap-2 rounded-xl border border-[#D8E5DB] bg-white px-4 py-2 text-sm font-semibold text-[#123D2A] shadow-sm hover:-translate-y-0.5 hover:border-[#91B99D] hover:bg-[#F4FAF5] active:translate-y-0 active:scale-95 transition-all duration-300 group"
                    >
                        {isOrdersLoading ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4 text-gray-500 group-hover:text-[#123D2A] transition-colors" />} {isOrdersLoading ? "Loading..." : "Orders & Payments"}
                        {orders.filter(o => o.sale_status === 'Pending Payment').length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-bounce">
                                {orders.filter(o => o.sale_status === 'Pending Payment').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={fetchGlobalHistory}
                        disabled={isHistoryLoading}
                        className="flex items-center gap-2 rounded-xl border border-[#D8E5DB] bg-white px-4 py-2 text-sm font-semibold text-[#123D2A] shadow-sm hover:-translate-y-0.5 hover:border-[#91B99D] hover:bg-[#F4FAF5] active:translate-y-0 active:scale-95 transition-all duration-300 group"
                    >
                        {isHistoryLoading ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4 text-gray-500 group-hover:text-blue-600 transition-colors" />} {isHistoryLoading ? "Loading..." : "Activity Log"}
                    </button>
                    <button
                        onClick={refreshInventory}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 rounded-xl border border-[#D8E5DB] bg-white px-3 py-2 text-sm font-semibold text-[#123D2A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#91B99D] hover:bg-[#F4FAF5] disabled:cursor-wait disabled:opacity-60"
                        aria-label="Refresh inventory"
                    >
                        <Loader2 className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={() => { setPendingAction(null); setIsActionProcessing(false); setIsAddModalOpen(true); }}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#123D2A] to-[#1a5c3f] px-5 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(18,61,42,0.3)] hover:shadow-[0_6px_16px_rgba(18,61,42,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 group"
                    >
                        <Plus className="size-4 transition-transform group-hover:rotate-90 duration-300" /> Add Product
                    </button>
                </div>
            </div>

            {inventoryError && (
                <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <span>{inventoryError}</span>
                    <button type="button" onClick={() => { setIsInventoryLoading(true); void fetchInventory(); }} className="rounded-lg bg-red-700 px-3 py-1.5 font-bold text-white hover:bg-red-800">Retry</button>
                </div>
            )}

            {/* Toolbar */}
            <div className="mb-6 mt-4 rounded-2xl border border-[#DCE9DE] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3">
                    <div className="flex w-full items-center justify-between gap-4">
                    <div className="relative min-w-0 flex-1 max-w-[720px]">
                        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setInventoryPage(1); }}
                            placeholder="Search products by name..."
                            aria-label="Search inventory products"
                            className="w-full rounded-xl border border-[#D8E5DB] bg-[#F8FBF8] py-3 pl-12 pr-11 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-4 focus:ring-[#0F9D58]/10"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#789181] transition hover:bg-[#EAF5EC] hover:text-[#123D2A]"
                                aria-label="Clear product search"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <div className="relative">
                            <button type="button" onClick={() => setIsSortMenuOpen((value) => !value)} aria-haspopup="listbox" aria-expanded={isSortMenuOpen} className="flex min-w-[210px] items-center justify-between rounded-xl border border-[#BBD7C1] bg-white px-4 py-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-4 focus:ring-[#0F9D58]/10">
                                <span>{({ "name-asc": "Name (A–Z)", "price-asc": "Price (low to high)", "price-desc": "Price (high to low)", "stock-asc": "Stock (low to high)", "stock-desc": "Stock (high to low)" } as Record<string, string>)[sortBy]}</span>
                                <ChevronDown className={`size-4 text-[#52705D] transition ${isSortMenuOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isSortMenuOpen && (
                                <div className="absolute right-0 top-full z-30 mt-2 w-full min-w-[210px] overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]" role="listbox" aria-label="Sort inventory products">
                                    {[["name-asc", "Name (A–Z)"], ["price-asc", "Price (low to high)"], ["price-desc", "Price (high to low)"], ["stock-asc", "Stock (low to high)"], ["stock-desc", "Stock (high to low)"]].map(([value, label]) => (
                                        <button key={value} type="button" role="option" aria-selected={sortBy === value} onClick={() => { setSortBy(value); setIsSortMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${sortBy === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>
                                            {label}{sortBy === value && <span className="text-[#1F6B43]">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <ChevronDown className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Category Tabs */}
                </div>

                <div className="mt-2 flex w-full items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {categoryTabs.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); setInventoryPage(1); }}
                            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategory === cat
                                ? "bg-[#123D2A] text-white shadow-sm"
                                : "border border-transparent bg-[#F3F7F3] text-[#52705D] hover:border-[#BBD7C1] hover:bg-[#EAF5EC]"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <p className="shrink-0 whitespace-nowrap text-right text-xs font-medium text-[#789181]" aria-live="polite">
                    Showing {filteredAndSortedInventory.length === 0 ? 0 : ((inventoryPage - 1) * inventoryPageSize) + 1}–{Math.min(inventoryPage * inventoryPageSize, filteredAndSortedInventory.length)} of {filteredAndSortedInventory.length} product{filteredAndSortedInventory.length === 1 ? "" : "s"}
                </p>
                {hasActiveFilters && (
                    <button type="button" onClick={clearFilters} className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-[#1F6B43] transition hover:bg-[#EAF5EC]" aria-label="Clear inventory filters">
                        Clear filters
                    </button>
                )}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                {isInventoryLoading ? (
                    Array.from({ length: inventoryPageSize }).map((_, index) => (
                        <div key={`inventory-skeleton-${index}`} className="min-h-[320px] animate-pulse overflow-hidden rounded-2xl border border-[#DCE9DE] bg-white">
                            <div className="h-48 bg-[#EAF2EA]" />
                            <div className="space-y-4 p-4">
                                <div className="h-5 w-3/4 rounded bg-[#EAF2EA]" />
                                <div className="h-4 w-1/2 rounded bg-[#EAF2EA]" />
                                <div className="h-4 w-full rounded bg-[#EAF2EA]" />
                                <div className="mt-8 h-10 rounded-xl bg-[#EAF2EA]" />
                            </div>
                        </div>
                    ))
                ) : paginatedInventory.length > 0 ? (
                    paginatedInventory.map(item => {
                        const availableStock = item.stock - (item.pending_qty || 0);
                        const isLowStock = item.reorder_level && item.reorder_level > 0 && availableStock <= item.reorder_level;
                        return (
                            <div key={item.id} style={{ animationDelay: `${Math.min(filteredAndSortedInventory.indexOf(item) * 55, 440)}ms` }} className={`group flex h-full min-h-[320px] animate-in fade-in slide-in-from-bottom-2 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(18,61,42,0.07)] border transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(18,61,42,0.14)] ${isLowStock ? 'border-red-400 ring-1 ring-red-400' : 'border-[#DCE9DE]'}`}>
                                <div className={`relative h-48 p-4 flex items-center justify-center rounded-t-2xl overflow-hidden ${item.category?.toLowerCase().includes('seed') ? 'bg-gradient-to-br from-[#FFF8E8] via-[#F8F1E5] to-[#E7F2E8]' : item.category?.toLowerCase().includes('fertil') ? 'bg-gradient-to-br from-[#EEF7FF] via-[#EAF5F0] to-[#DCEFE2]' : 'bg-gradient-to-br from-[#E8F8F0] via-[#F4FAF5] to-[#E5F0FF]'}`}>
                                    <div className="absolute left-4 top-4 flex gap-2 z-10">
                                        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold text-white ${item.status === 'Available' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                                            }`}>
                                            {item.status}
                                        </span>
                                        {isLowStock && (
                                            <span className="flex items-center gap-1 rounded-md bg-red-100 text-red-700 px-2.5 py-1 text-xs font-bold border border-red-200 shadow-sm animate-pulse">
                                                <AlertCircle className="w-3 h-3" /> Low Stock
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setHistoryItem(item)}
                                        className="absolute right-4 top-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-gray-600 hover:text-blue-600 hover:bg-white transition"
                                        title="View stock history"
                                        aria-label={`View stock history for ${item.name}`}
                                    >
                                        <History className="size-4" />
                                    </button>
                                    {item.img ? (
                                        <>
                                            <img
                                                src={item.img}
                                                alt={item.name}
                                                onError={(event) => {
                                                    event.currentTarget.style.display = "none";
                                                    event.currentTarget.nextElementSibling?.classList.remove("hidden");
                                                }}
                                                className="absolute inset-0 z-[1] w-full h-full object-cover transition duration-300 hover:scale-105"
                                            />
                                            <div className="hidden flex-col items-center gap-2 text-center text-[#6B8A76]" aria-label="Product image unavailable">
                                                <div className="flex size-16 items-center justify-center rounded-2xl bg-white/75 text-2xl font-black text-[#1F6B43] shadow-sm">
                                                    {item.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold">Image unavailable</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center text-[#6B8A76]" aria-label="No product image">
                                            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/75 text-2xl font-black text-[#1F6B43] shadow-sm">
                                                {item.name.slice(0, 1).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-semibold">No product image</span>
                                        </div>
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#123D2A]/35 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100"></div>
                                    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 translate-y-2 rounded-full bg-[#123D2A]/85 px-3 py-1 text-[10px] font-bold text-white opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">Product image</div>
                                </div>
                                <div className="flex flex-col p-4">
                                    <div className="mb-3 min-h-[50px] min-w-0">
                                        <h3 className="font-bold text-[#1e293b] truncate leading-tight text-base" title={item.name}>{item.name}</h3>
                                        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-[#EAF5EC] px-2.5 py-1 text-[11px] font-bold text-[#1F6B43] ring-1 ring-inset ring-[#C9E2CF]">{item.category || "Uncategorized"}</span>
                                    </div>

                                    <div className="mb-1 flex min-h-[42px] items-center justify-between text-sm">
                                        <span className="text-[#64748b]">Available stock</span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-[#1e293b]">{formatQuantityUnit(item.stock - (item.pending_qty || 0), item.unit)}</span>
                                            {item.pending_qty ? (
                                                <span className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">({formatQuantityUnit(item.pending_qty, item.unit)} pending)</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="mb-2 flex min-h-[18px] items-center justify-between text-xs">
                                        <span className="text-[#94a3b8]">Reorder level</span>
                                        <span className="font-semibold text-[#52705D]">{item.reorder_level ? formatQuantityUnit(item.reorder_level, item.unit) : "Not set"}</span>
                                    </div>
                                    <div className="mb-3 flex min-h-[24px] items-center justify-between text-sm">
                                        <span className="text-[#64748b]">Selling price</span>
                                        <span className="font-bold text-[#1e293b]">₱ {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        <button
                                            onClick={() => {
                                                const margin = item.cost_price && item.price ? (((item.price - item.cost_price) / item.cost_price) * 100).toFixed(1) : "";
                                                setEditingItem({ ...item, margin });
                                            }}
                                            className="flex-1 rounded-xl border border-[#D8E5DB] bg-[#F5F9F5] py-2 text-xs font-bold text-[#52705D] transition hover:border-[#A9CBAF] hover:bg-[#EAF5EC]">
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => { setStockActionType("add"); setAddingStockItem(item); }}
                                            className="flex-1 rounded-xl bg-[#123D2A] py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1F6B43] hover:shadow-md">
                                            + Stock
                                        </button>
                                        <button
                                            onClick={() => { setStockActionType("deduct"); setAddingStockItem(item); }}
                                            className="flex-1 rounded-xl bg-[#FFF1D8] py-2 text-xs font-bold text-[#A76500] shadow-sm transition hover:bg-[#FFE5B5]">
                                            - Take
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <Wheat className="size-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">No products found</h3>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your search or category filters.</p>
                    </div>
                )}
            </div>
            {inventoryPageCount > 1 && (
                <div className="mb-8 flex items-center justify-center gap-3 rounded-2xl border border-[#DCE9DE] bg-white p-3 shadow-sm">
                    <button type="button" onClick={() => setInventoryPage((page) => Math.max(1, page - 1))} disabled={inventoryPage === 1} className="rounded-xl border border-[#D8E5DB] px-4 py-2 text-sm font-bold text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <span className="text-sm font-bold text-[#123D2A]">Page {inventoryPage} of {inventoryPageCount}</span>
                    <button type="button" onClick={() => setInventoryPage((page) => Math.min(inventoryPageCount, page + 1))} disabled={inventoryPage === inventoryPageCount} className="rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-3xl rounded-3xl bg-white p-2 sm:p-4 shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar p-4 sm:p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">Add New Product</h2>
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
                                        <p className="mt-3 text-sm font-semibold text-[#1e293b] z-10">Upload product photo</p>
                                    </>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Product Name</label>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) => {
                                        setNewItemName(e.target.value);
                                        if (newItemErrors.name) setNewItemErrors({ ...newItemErrors, name: "" });
                                    }}
                                    placeholder="e.g. Rice Seeds"
                                    className={`w-full rounded-xl border ${newItemErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#0F9D58] focus:ring-[#0F9D58]'} bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:ring-1`}
                                />
                                {newItemErrors.name && <p className="mt-1 text-xs text-red-500">{newItemErrors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <CategoryCombobox
                                        label="Category"
                                        value={newItemCategory}
                                        onChange={(val) => {
                                            setNewItemCategory(val);
                                            if (newItemErrors.category) setNewItemErrors({ ...newItemErrors, category: "" });
                                        }}
                                        categories={categoryOptions}
                                    />
                                    {newItemErrors.category && <p className="mt-1 text-xs text-red-500">{newItemErrors.category}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Unit</label>
                                    <ThemedSelect value={newItemUnit} onChange={(value) => { setNewItemUnit(value); if (newItemErrors.unit) setNewItemErrors({ ...newItemErrors, unit: "" }); }} ariaLabel="Unit" options={STOCK_UNIT_OPTIONS.map((unit) => ({ value: unit, label: unit }))} />
                                    {newItemErrors.unit && <p className="mt-1 text-xs text-red-500">{newItemErrors.unit}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Initial Stock ({newItemUnit})</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        onKeyDown={(e) => {
                                            if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                                        }}
                                        value={newItemStock}
                                        onChange={(e) => {
                                            setNewItemStock(e.target.value.replace(/[^0-9]/g, ''));
                                            if (newItemErrors.stock) setNewItemErrors({ ...newItemErrors, stock: "" });
                                        }}
                                        placeholder="e.g. 10"
                                        className={`w-full rounded-xl border ${newItemErrors.stock ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#0F9D58] focus:ring-[#0F9D58]'} bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:ring-1`}
                                    />
                                    {newItemErrors.stock && <p className="mt-1 text-xs text-red-500">{newItemErrors.stock}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Low Stock Threshold</label>
                                    <p className="mb-2 text-xs text-[#789181]">The alert appears when available stock reaches this level.</p>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        onKeyDown={(e) => {
                                            if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                                        }}
                                        value={newItemReorderLevel}
                                        onChange={(e) => setNewItemReorderLevel(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="e.g. 5"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58]"
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Banknote className="w-4 h-4 text-[#0F9D58]" /> Pricing Details
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost Price</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                onKeyDown={(e) => {
                                                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                                }}
                                                value={newItemCostPrice}
                                                onChange={(e) => {
                                                    let cost = e.target.value.replace(/[^0-9.]/g, '');
                                                    if ((cost.match(/\./g) || []).length > 1) cost = cost.substring(0, cost.lastIndexOf('.'));
                                                    setNewItemCostPrice(cost);
                                                    if (newItemErrors.cost_price) setNewItemErrors({ ...newItemErrors, cost_price: "" });
                                                    if (cost && newItemMargin) {
                                                        const selling = Number(cost) * (1 + Number(newItemMargin) / 100);
                                                        setNewItemPrice(selling.toFixed(2));
                                                        if (newItemErrors.price) setNewItemErrors(prev => ({ ...prev, price: "" }));
                                                    }
                                                }}
                                                placeholder="0.00"
                                                className={`w-full rounded-xl border ${newItemErrors.cost_price ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-[#0F9D58] focus:ring-[#0F9D58]/20'} bg-white pl-8 pr-4 py-3 text-sm text-[#1e293b] font-medium outline-none transition focus:ring-2`}
                                            />
                                        </div>
                                        {newItemErrors.cost_price && <p className="mt-1 text-xs text-red-500">{newItemErrors.cost_price}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Margin</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                onKeyDown={(e) => {
                                                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                                }}
                                                value={newItemMargin}
                                                onChange={(e) => {
                                                    let margin = e.target.value.replace(/[^0-9.]/g, '');
                                                    if ((margin.match(/\./g) || []).length > 1) margin = margin.substring(0, margin.lastIndexOf('.'));
                                                    setNewItemMargin(margin);
                                                    if (newItemCostPrice && margin) {
                                                        const selling = Number(newItemCostPrice) * (1 + Number(margin) / 100);
                                                        setNewItemPrice(selling.toFixed(2));
                                                    }
                                                }}
                                                placeholder="20"
                                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#1e293b] font-medium outline-none transition focus:border-[#0F9D58] focus:ring-2 focus:ring-[#0F9D58]/20"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="mb-1.5 block text-xs font-bold text-gray-700 uppercase tracking-wide">Final Selling Price</label>
                                    <div className="relative">
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${newItemErrors.price ? 'text-red-500' : 'text-[#0F9D58]'}`}>₱</span>
                                        <input
                                            type="number"
                                            readOnly
                                            value={newItemPrice}
                                            placeholder="0.00"
                                            className={`w-full rounded-xl border-2 ${newItemErrors.price ? 'border-red-500/50 bg-red-50 text-red-600' : 'border-[#0F9D58]/30 bg-[#0F9D58]/10 text-[#0F9D58]'} pl-8 pr-4 py-3 text-lg font-bold outline-none cursor-not-allowed`}
                                        />
                                    </div>
                                    {newItemErrors.price && <p className="mt-1 text-xs text-red-500">{newItemErrors.price}</p>}
                                </div>
                            </div>



                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Status</label>
                                    <ThemedSelect value={newItemStatus} onChange={setNewItemStatus} ariaLabel="Product status" options={[{ value: "Available", label: "Available" }, { value: "Unavailable", label: "Unavailable" }]} />
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
                                onClick={handleAddProductClick}
                                className="mt-4 w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90"
                            >
                                Add Product
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-3xl rounded-3xl bg-white p-2 sm:p-4 shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar p-4 sm:p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1e293b]">Edit Product Details</h2>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="grid gap-4">
                            <div className="relative flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-[#0F9D58] hover:bg-[#F8F1E5]/50">
                                <input type="file" accept="image/*" onChange={handleEditImageChange} className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0" />

                                {editingItem.img ? (
                                    <>
                                        <img src={editingItem.img} alt={`${editingItem.name} preview`} className="absolute inset-0 z-10 h-full w-full object-cover" />
                                        <div className="absolute inset-0 z-10 bg-black/35" />
                                        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#123D2A] shadow-sm">
                                            <Camera className="size-6" />
                                        </div>
                                        <p className="relative z-10 mt-3 text-sm font-semibold text-white">Change product photo</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#123D2A]/10 text-[#0F9D58]">
                                            <Camera className="size-6" />
                                        </div>
                                        <p className="relative z-10 mt-3 text-sm font-semibold text-[#1e293b]">Upload product photo</p>
                                    </>
                                )}
                            </div>

                            {editingItem.img && (
                                <button
                                    type="button"
                                    onClick={() => handleEditChange("img", "")}
                                    className="-mt-1 justify-self-start rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                                >
                                    Remove Photo
                                </button>
                            )}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">Item Name</label>
                                <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => {
                                        handleEditChange('name', e.target.value);
                                        if (editItemErrors.name) setEditItemErrors({ ...editItemErrors, name: "" });
                                    }}
                                    className={`w-full rounded-xl border ${editItemErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#0F9D58] focus:ring-[#0F9D58]'} bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:ring-1`}
                                />
                                {editItemErrors.name && <p className="mt-1 text-xs text-red-500">{editItemErrors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <CategoryCombobox
                                        label="Category"
                                        value={editingItem.category}
                                        onChange={(value) => {
                                            handleEditChange("category", value);
                                            if (editItemErrors.category) setEditItemErrors({ ...editItemErrors, category: "" });
                                        }}
                                        categories={categoryOptions}
                                    />
                                    {editItemErrors.category && <p className="mt-1 text-xs text-red-500">{editItemErrors.category}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Unit</label>
                                    <ThemedSelect value={editingItem.unit || "piece"} onChange={(value) => { handleEditChange("unit", value); if (editItemErrors.unit) setEditItemErrors({ ...editItemErrors, unit: "" }); }} ariaLabel="Edit unit" options={STOCK_UNIT_OPTIONS.map((unit) => ({ value: unit, label: unit }))} />
                                    {editItemErrors.unit && <p className="mt-1 text-xs text-red-500">{editItemErrors.unit}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Current Stock ({editingItem.unit || "piece"})</label>
                                    <input
                                        type="number"
                                        value={editingItem.stock}
                                        readOnly
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#64748b] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Low Stock Threshold</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        onKeyDown={(e) => {
                                            if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                                        }}
                                        value={editingItem.reorder_level || ""}
                                        onChange={(e) => handleEditChange('reorder_level', e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="e.g. 5"
                                        className="w-full rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-sm font-medium text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 [&>option]:bg-white [&>option]:text-[#123D2A]"
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Banknote className="w-4 h-4 text-[#0F9D58]" /> Pricing Details
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost Price</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                onKeyDown={(e) => {
                                                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                                }}
                                                value={editingItem.cost_price}
                                                onChange={(e) => {
                                                    let cost = e.target.value.replace(/[^0-9.]/g, '');
                                                    if ((cost.match(/\./g) || []).length > 1) cost = cost.substring(0, cost.lastIndexOf('.'));
                                                    if (editItemErrors.cost_price) setEditItemErrors({ ...editItemErrors, cost_price: "" });
                                                    if (cost && editingItem.margin) {
                                                        const selling = Number(cost) * (1 + Number(editingItem.margin) / 100);
                                                        handleEditChange('price', selling.toFixed(2));
                                                        if (editItemErrors.price) setEditItemErrors(prev => ({ ...prev, price: "" }));
                                                    }
                                                    handleEditChange('cost_price', cost);
                                                }}
                                                className={`w-full rounded-xl border ${editItemErrors.cost_price ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-[#0F9D58] focus:ring-[#0F9D58]/20'} bg-white pl-8 pr-4 py-3 text-sm text-[#1e293b] font-medium outline-none transition focus:ring-2`}
                                            />
                                        </div>
                                        {editItemErrors.cost_price && <p className="mt-1 text-xs text-red-500">{editItemErrors.cost_price}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Margin</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                onKeyDown={(e) => {
                                                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                                }}
                                                value={editingItem.margin || ""}
                                                onChange={(e) => {
                                                    let margin = e.target.value.replace(/[^0-9.]/g, '');
                                                    if ((margin.match(/\./g) || []).length > 1) margin = margin.substring(0, margin.lastIndexOf('.'));
                                                    if (editingItem.cost_price && margin) {
                                                        const selling = Number(editingItem.cost_price) * (1 + Number(margin) / 100);
                                                        handleEditChange('price', selling.toFixed(2));
                                                    }
                                                    handleEditChange('margin', margin);
                                                }}
                                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#1e293b] font-medium outline-none transition focus:border-[#0F9D58] focus:ring-2 focus:ring-[#0F9D58]/20"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="mb-1.5 block text-xs font-bold text-gray-700 uppercase tracking-wide">Final Selling Price</label>
                                    <div className="relative">
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${editItemErrors.price ? 'text-red-500' : 'text-[#0F9D58]'}`}>₱</span>
                                        <input
                                            type="number"
                                            readOnly
                                            value={editingItem.price}
                                            className={`w-full rounded-xl border-2 ${editItemErrors.price ? 'border-red-500/50 bg-red-50 text-red-600' : 'border-[#0F9D58]/30 bg-[#0F9D58]/10 text-[#0F9D58]'} pl-8 pr-4 py-3 text-lg font-bold outline-none cursor-not-allowed`}
                                        />
                                    </div>
                                    {editItemErrors.price && <p className="mt-1 text-xs text-red-500">{editItemErrors.price}</p>}
                                </div>
                            </div>



                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#64748b]">Status</label>
                                    <ThemedSelect value={editingItem.status} onChange={(value) => handleEditChange("status", value)} ariaLabel="Edit product status" options={[{ value: "Available", label: "Available" }, { value: "Unavailable", label: "Unavailable" }]} />
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
                                onClick={handleArchiveProduct}
                                className="w-1/3 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 hover:border-red-300"
                            >
                                    Archive
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
                                    setStockInputError("");
                                }}
                                className="rounded-full p-2 text-[#64748b] transition hover:bg-gray-100 hover:text-[#1e293b]"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex-1">
                            <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-1">Product:</p>
                                <p className="font-bold text-gray-900">{addingStockItem.name}</p>
                                <p className="text-xs text-gray-400 mt-1">Current Stock: {formatQuantityUnit(addingStockItem.stock, addingStockItem.unit)}</p>
                            </div>

                            <div className="mb-4">
                                <label className="mb-1 block text-sm font-medium text-[#64748b]">
                                    Quantity to {stockActionType === "add" ? "Add" : "Deduct"}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    onKeyDown={(e) => {
                                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                    }}
                                    value={stockToAdd}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^0-9.]/g, '');
                                        if ((val.match(/\./g) || []).length > 1) val = val.substring(0, val.lastIndexOf('.'));
                                        setStockToAdd(val);
                                        if (stockInputError) setStockInputError("");
                                    }}
                                    placeholder="e.g. 50"
                                    className={`w-full rounded-xl border ${stockInputError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#0F9D58] focus:ring-[#0F9D58]'} bg-white px-4 py-3 text-sm text-[#1e293b] outline-none transition focus:ring-1`}
                                />
                                {stockInputError && <p className="mt-1 text-xs text-red-500">{stockInputError}</p>}
                            </div>
                        </div>

                        <button
                            onClick={handleStockClick}
                            className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition ${stockActionType === "add"
                                ? "bg-[#123D2A] hover:bg-[#123D2A]/90"
                                : "bg-orange-600 hover:bg-orange-700"
                                }`}
                        >
                            Confirm {stockActionType === "add" ? "Add" : "Deduct"}
                        </button>
                    </div>
                </div>
            )}
            {/* Product Stock History Modal */}
            {historyItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                        <h2 className="text-xl font-bold text-[#1e293b]">Product Stock History</h2>
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
                                                    {log.type === 'add' ? '+' : '-'}{formatQuantityUnit(log.amount, historyItem.unit)}
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
            {/* Archive Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex justify-center">
                            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <AlertCircle className="size-8" />
                            </div>
                        </div>
                        <h3 className="mb-2 text-center text-xl font-bold text-gray-900">Archive Product?</h3>
                        <p className="mb-6 text-center text-sm text-gray-500">
                            Are you sure you want to archive <span className="font-bold text-gray-700">{itemToDelete.name}</span>? It will be removed from active inventory.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                disabled={isDeleting}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void handleConfirmDelete()}
                                disabled={isDeleting}
                                className="flex-1 rounded-xl border border-transparent bg-red-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                            >
                                {isDeleting ? <><Loader2 className="mr-2 inline size-4 animate-spin" />Archiving...</> : "Archive Product"}
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
                        <div className="border-b border-gray-100 bg-white p-4">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={activitySearchQuery}
                                        onChange={(event) => { setActivitySearchQuery(event.target.value); setActivityCurrentPage(1); }}
                                        placeholder="Search product activity..."
                                        aria-label="Search stock activity"
                                        className="w-full rounded-xl border border-[#D8E5DB] bg-[#F8FBF8] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0F9D58] focus:ring-2 focus:ring-[#0F9D58]/10"
                                    />
                                </div>
                                <div className="min-w-[170px]">
                                    <ThemedSelect
                                        value={activityTypeFilter}
                                        onChange={(value) => { setActivityTypeFilter(value as "All" | "add" | "deduct"); setActivityCurrentPage(1); }}
                                        ariaLabel="Filter activity type"
                                        options={[{ value: "All", label: "All activity" }, { value: "add", label: "Stock added" }, { value: "deduct", label: "Stock deducted" }]}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="relative flex-1 overflow-y-auto space-y-4 bg-gray-50/50 p-6 custom-scrollbar">
                            {isHistoryLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"><div className="flex items-center gap-2 text-sm font-semibold text-[#123D2A]"><Loader2 className="size-5 animate-spin" /> Loading activity...</div></div>}
                            {filteredActivityLogs.length > 0 ? (
                                <>
                                {paginatedActivityLogs.map((log) => (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                        {log.inventoryItem?.img ? (
                                            <img src={log.inventoryItem.img} alt="item" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                                <ImageIcon className="size-6" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800 text-sm">{log.inventoryItem?.name || "Unknown Product"}</h3>
                                            <p suppressHydrationWarning className="text-xs text-gray-500">{new Date(log.date).toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${log.type === 'add' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {log.type === 'add' ? '+' : '-'}{formatQuantityUnit(log.amount, log.inventoryItem?.unit)}
                                            </span>
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                                                {log.type === 'add' ? 'Added' : 'Deducted'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {activityPageCount > 1 && (
                                    <div className="flex items-center justify-center gap-2 border-t border-[#DDE9E0] pt-4">
                                        <button type="button" onClick={() => setActivityCurrentPage(1)} disabled={activityCurrentPage === 1} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="First Page" aria-label="First activity page">
                                            <ChevronsLeft className="size-4" />
                                        </button>
                                        <button type="button" onClick={() => setActivityCurrentPage((page) => Math.max(1, page - 1))} disabled={activityCurrentPage === 1} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Previous Page" aria-label="Previous activity page">
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <span className="px-2 text-sm font-bold text-[#123D2A]">Page {activityCurrentPage} of {activityPageCount} &bull; {filteredActivityLogs.length} activities</span>
                                        <button type="button" onClick={() => setActivityCurrentPage((page) => Math.min(activityPageCount, page + 1))} disabled={activityCurrentPage === activityPageCount} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Next Page" aria-label="Next activity page">
                                            <ChevronRight className="size-4" />
                                        </button>
                                        <button type="button" onClick={() => setActivityCurrentPage(activityPageCount)} disabled={activityCurrentPage === activityPageCount} className="rounded-lg border border-[#D8E5DB] bg-white p-2 text-[#52705D] transition hover:bg-[#EAF5EC] disabled:cursor-not-allowed disabled:opacity-40" title="Last Page" aria-label="Last activity page">
                                            <ChevronsRight className="size-4" />
                                        </button>
                                    </div>
                                )}
                                </>
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
                                {pendingAction === 'add' ? 'Confirm Add Product' : pendingAction === 'edit' ? 'Confirm Changes' : `Confirm ${stockActionType === 'add' ? 'Add' : 'Deduct'} Stock`}
                            </h3>
                            <p className="text-center text-sm text-gray-500">
                                {pendingAction === 'add' && `Are you sure you want to add ${newItemName} as a new product?`}
                                {pendingAction === 'edit' && `Are you sure you want to save the changes for ${editingItem?.name}?`}
                                {pendingAction === 'stock' && `Are you sure you want to ${stockActionType === 'add' ? 'add' : 'deduct'} ${formatQuantityUnit(stockToAdd, addingStockItem?.unit)} to ${addingStockItem?.name}?`}
                            </p>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setPendingAction(null)}
                                disabled={isActionProcessing}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (pendingAction === 'add') {
                                        void handleAddProduct();
                                    } else if (pendingAction === 'edit') {
                                        void saveEditItem();
                                    } else if (pendingAction === 'stock') {
                                        void processStockUpdate();
                                    }
                                }}
                                disabled={!pendingAction || isActionProcessing}
                                className={`flex-1 rounded-xl border border-transparent py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${(pendingAction === 'stock' && stockActionType === 'deduct')
                                    ? "bg-orange-600 hover:bg-orange-700"
                                    : "bg-[#123D2A] hover:bg-[#123D2A]/90"
                                    }`}
                            >
                                {isActionProcessing ? <><Loader2 className="mr-2 inline size-4 animate-spin" />{pendingAction === 'add' ? 'Adding product...' : pendingAction === 'edit' ? 'Saving changes...' : stockActionType === 'add' ? 'Adding stock...' : 'Deducting stock...'}</> : pendingAction === 'add' ? 'Add Product' : pendingAction === 'edit' ? 'Save Changes' : stockActionType === 'add' ? 'Add Stock' : 'Deduct Stock'}
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

                        <div className="relative flex-1 overflow-y-auto bg-gray-50 p-6 custom-scrollbar">
                            {isOrdersLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"><div className="flex items-center gap-2 text-sm font-semibold text-[#123D2A]"><Loader2 className="size-5 animate-spin" /> Loading orders...</div></div>}
                            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    ["All", orders.length, "bg-white"],
                                    ["Pending Payment", orders.filter((order) => order.sale_status === "Pending Payment").length, "bg-[#FFF8E8]"],
                                    ["Paid", orders.filter((order) => order.sale_status === "Paid").length, "bg-[#EEF8F0]"],
                                    ["Rejected", orders.filter((order) => order.sale_status === "Rejected").length, "bg-[#FFF1F1]"],
                                ].map(([label, count, color]) => (
                                    <button
                                        key={label}
                                        onClick={() => { setOrderStatusFilter(String(label)); setOrdersCurrentPage(1); }}
                                        className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${color} ${orderStatusFilter === label ? "border-[#1F6B43] ring-2 ring-[#1F6B43]/15" : "border-gray-200"}`}
                                    >
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label === "Pending Payment" ? "Pending" : label}</p>
                                        <p className="mt-1 text-xl font-black text-[#123D2A]">{count}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="mb-4 flex flex-wrap gap-2">
                                {["All", "Pending Payment", "Paid", "Rejected"].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => { setOrderStatusFilter(status); setOrdersCurrentPage(1); }}
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${orderStatusFilter === status ? "bg-[#123D2A] text-white" : "bg-white text-[#52705D] hover:bg-[#EAF5EC]"}`}
                                    >
                                        {status === "Pending Payment" ? "Pending" : status}
                                    </button>
                                ))}
                            </div>
                            <div className="mb-6 relative w-full">
                                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={orderSearchQuery}
                                    onChange={(e) => {
                                        setOrderSearchQuery(e.target.value);
                                        setOrdersCurrentPage(1);
                                    }}
                                    placeholder="Search by Order Number or Customer Name..."
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#0F9D58] focus:ring-1 focus:ring-[#0F9D58] shadow-sm"
                                />
                            </div>

                            {(() => {
                                const filteredOrders = orders.filter(order => (orderStatusFilter === "All" || order.sale_status === orderStatusFilter) && (order.sale_number.toLowerCase().includes(orderSearchQuery.toLowerCase()) || (order.customer_name || '').toLowerCase().includes(orderSearchQuery.toLowerCase())));
                                const ordersPerPage = 5;
                                const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
                                const startIndex = (ordersCurrentPage - 1) * ordersPerPage;
                                const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ordersPerPage);

                                return filteredOrders.length > 0 ? (
                                    <>
                                        <div className="grid gap-4">
                                            {paginatedOrders.map((order) => (
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
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setOrderToRevokeId(order.id)}
                                                                className="text-xs font-bold text-red-600 px-3 py-1.5 rounded-lg transition border border-red-200 hover:bg-red-50 shadow-sm"
                                                            >
                                                                Revoke Payment
                                                            </button>
                                                            <button
                                                                onClick={() => setReceiptOrder(order)}
                                                                className="text-xs font-bold text-[#123D2A] px-3 py-1.5 rounded-lg transition border border-[#123D2A]/20 hover:bg-[#123D2A]/10 shadow-sm flex items-center gap-1.5"
                                                            >
                                                                <Printer className="size-3.5" />
                                                                View Receipt
                                                            </button>
                                                        </div>
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

                                            {order.payment_reference_id && order.provider !== 'Cash' && (
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
                                {totalPages > 1 && (
                                    <div className="mt-6 flex items-center justify-center gap-2 border-t border-gray-100 pt-4">
                                        <button
                                            onClick={() => setOrdersCurrentPage(1)}
                                            disabled={ordersCurrentPage === 1}
                                            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                            title="First Page"
                                        >
                                            <ChevronsLeft className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => setOrdersCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={ordersCurrentPage === 1}
                                            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                            title="Previous Page"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <span className="text-sm font-medium text-gray-700 px-2">
                                            Page {ordersCurrentPage} of {totalPages} &bull; {filteredOrders.length} orders
                                        </span>
                                        <button
                                            onClick={() => setOrdersCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={ordersCurrentPage === totalPages}
                                            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                            title="Next Page"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => setOrdersCurrentPage(totalPages)}
                                            disabled={ordersCurrentPage === totalPages}
                                            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                            title="Last Page"
                                        >
                                            <ChevronsRight className="size-4" />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-gray-200 border-dashed">
                                <div className="rounded-full bg-gray-50 p-4 mb-4">
                                    <ShoppingBag className="size-8 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">No orders found.</p>
                                <p className="text-sm text-gray-400 mt-1">Try adjusting your search query.</p>
                            </div>
                        );
                    })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Payment Modal */}
            {orderToConfirmId !== null && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Verify Payment</h2>
                        <p className="mb-4 text-sm text-gray-500">
                            Are you sure you want to verify this payment? This will finalize the order and deduct the items from stock.
                        </p>
                        
                        <div className="mb-6 text-left">
                            <label className="mb-1 block text-sm font-medium text-gray-700">Add Discount % (Optional)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    onKeyDown={(e) => {
                                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                    }}
                                    placeholder="0.00"
                                    value={confirmDiscountAmount}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^0-9.]/g, '');
                                        if ((val.match(/\./g) || []).length > 1) val = val.substring(0, val.lastIndexOf('.'));
                                        if (Number(val) > 100) val = "100";
                                        setConfirmDiscountAmount(val);
                                        if (confirmDiscountError) setConfirmDiscountError("");
                                    }}
                                    className={`w-full rounded-xl border ${confirmDiscountError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#123D2A]'} bg-gray-50 p-3 pl-8 text-sm outline-none transition focus:bg-white focus:ring-1`}
                                />
                            </div>
                            {confirmDiscountError && <p className="mt-1 text-xs text-red-500">{confirmDiscountError}</p>}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setOrderToConfirmId(null); setConfirmDiscountAmount(""); }}
                                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processConfirmPayment}
                                disabled={isConfirming}
                                className="flex-1 rounded-xl border border-transparent bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isConfirming ? "Verifying..." : "Verify"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Payment Modal */}
            {orderToRejectId !== null && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertCircle className="size-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Cancel Order</h2>
                        <p className="mb-4 text-sm text-gray-500">
                            Are you sure you want to cancel this order? This action cannot be undone.
                        </p>
                        <div className="text-left mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Cancellation reason (Optional)</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-200 resize-none h-24"
                                placeholder="Enter reason..."
                            />
                        </div>
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
                                Cancel Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {receiptOrder && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
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

                                    const isMember = !!receiptOrder.member_id;
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
            {/* Revoke Payment Modal */}
            {orderToRevokeId !== null && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-black text-gray-900">Revoke Payment</h3>
                            <button
                                onClick={() => setOrderToRevokeId(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors bg-white hover:bg-gray-100 p-2 rounded-xl"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-600">
                                Are you sure you want to revoke this payment?
                            </p>
                            <p className="mt-2 text-sm text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-100">
                                This will reset the order back to Pending, restore stock into inventory, and void associated financial records.
                            </p>
                            <div className="mt-4 text-left">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Reason for Revocation (Optional)</label>
                                <textarea
                                    value={revokeReason}
                                    onChange={(e) => setRevokeReason(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-200 resize-none h-24"
                                    placeholder="Enter reason..."
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setOrderToRevokeId(null)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void processRevokePayment()}
                                disabled={isRevoking}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isRevoking ? <Loader2 className="size-4 animate-spin" /> : null}
                                Revoke Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
