export type StoreProduct = {
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

export type StoreCatalogFilters = { search: string; category: string; unit: string; stock: string; sort: string };
export const emptyStoreFilters: StoreCatalogFilters = { search: "", category: "", unit: "", stock: "", sort: "name-asc" };

export function availableStoreQuantity(product: StoreProduct) {
  return Math.max(0, Number(product.stock) - Number(product.pending_qty || 0));
}

export function storeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function filterStoreCatalog(products: StoreProduct[], filters: StoreCatalogFilters) {
  const terms = storeSearchText(filters.search).split(" ").filter(Boolean);
  return products.filter((product) => {
    if (product.status !== "Available" || Number(product.stock) <= 0) return false;
    const text = storeSearchText([product.name, product.category, product.description, product.unit].filter(Boolean).join(" "));
    if (!terms.every((term) => text.includes(term))) return false;
    if (filters.category && product.category.trim().toLowerCase() !== filters.category.toLowerCase()) return false;
    if (filters.unit && product.unit.trim().toLowerCase() !== filters.unit.toLowerCase()) return false;
    const available = availableStoreQuantity(product);
    if (filters.stock === "in-stock" && available <= 0) return false;
    if (filters.stock === "low-stock" && (available <= 0 || available > 5)) return false;
    return true;
  }).sort((a, b) => {
    const name = a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }) || a.id - b.id;
    if (filters.sort === "price-asc") return Number(a.price) - Number(b.price) || name;
    if (filters.sort === "price-desc") return Number(b.price) - Number(a.price) || name;
    if (filters.sort === "name-desc") return -name;
    return name;
  });
}
