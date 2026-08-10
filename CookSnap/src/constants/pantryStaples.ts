import { Ingredient } from "@/types";

export const PANTRY_STAPLES: Omit<Ingredient, "id" | "addedAt">[] = [
  { name: "Salt", category: "spice", status: "in_stock", isStaple: true },
  { name: "Black Pepper", category: "spice", status: "in_stock", isStaple: true },
  { name: "Olive Oil", category: "condiment", status: "in_stock", isStaple: true },
  { name: "Garlic", category: "produce", status: "in_stock", isStaple: true },
  { name: "Onion", category: "produce", status: "in_stock", isStaple: true },
  { name: "Flour", category: "grain", status: "in_stock", isStaple: true },
  { name: "Sugar", category: "condiment", status: "in_stock", isStaple: true },
  { name: "Rice", category: "grain", status: "in_stock", isStaple: true },
  { name: "Pasta", category: "grain", status: "in_stock", isStaple: true },
  { name: "Butter", category: "dairy", status: "in_stock", isStaple: true },
  { name: "Soy Sauce", category: "condiment", status: "in_stock", isStaple: true },
  { name: "Vinegar", category: "condiment", status: "in_stock", isStaple: true },
];
