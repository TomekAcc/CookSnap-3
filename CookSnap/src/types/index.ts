export type IngredientCategory =
  | "produce"
  | "dairy"
  | "protein"
  | "grain"
  | "condiment"
  | "spice"
  | "other";

export type StockStatus = "in_stock" | "out_of_stock";

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  status: StockStatus;
  isStaple: boolean;
  addedAt: number;
}

export interface ScanResult {
  ingredients: Ingredient[];
  photoUri: string;
  scannedAt: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  steps: string[];
  usedIngredients: string[];
  missingIngredients: string[];
  cookTimeMinutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  servings: number;
  accentColor: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: IngredientCategory;
  checked: boolean;
}

export type ScanPhase = "idle" | "capturing" | "scanning" | "populating" | "done";

export type ScanMode = "fridge" | "pantry";
