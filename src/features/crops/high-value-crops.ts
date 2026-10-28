export const HIGH_VALUE_CROP_DEFINITION =
  "High-Value Crops are cooperative-approved priority crops recognized for their market value, demand, production importance, or income contribution.";

export const HIGH_VALUE_CROP_CRITERIA = [
  "Approved by the cooperative as a priority crop.",
  "Has meaningful market demand or income contribution.",
  "Can be monitored through production, sales, or season records.",
] as const;

export const HIGH_VALUE_CROP_NAMES = [
  "Tomato",
  "Onion",
  "Garlic",
  "Bell Pepper",
  "Chili Pepper",
  "Eggplant",
  "Cabbage",
  "Carrot",
  "Lettuce",
  "Cucumber",
  "Squash",
  "String Beans",
  "Bitter Gourd",
  "Ampalaya",
  "Okra",
  "Pechay",
  "Mustard Greens",
  "Broccoli",
  "Cauliflower",
  "Radish",
  "Ginger",
] as const;

function normalized(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function isHighValueCropName(value: string | null | undefined) {
  const name = normalized(value);
  return HIGH_VALUE_CROP_NAMES.some((crop) => {
    const candidate = crop.toLowerCase();
    return name === candidate || name.includes(candidate);
  });
}

export function isHighValueCropRecord(
  name: string | null | undefined,
  category: string | null | undefined,
) {
  const categoryText = normalized(category);
  return (
    categoryText.includes("high-value") ||
    categoryText.includes("high value") ||
    categoryText.includes("gulayan") ||
    isHighValueCropName(name)
  );
}
