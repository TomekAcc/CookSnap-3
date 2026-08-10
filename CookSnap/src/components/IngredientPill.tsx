import React from "react";
import { Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Ingredient } from "@/types";
import { getIngredientEmoji } from "@/utils/ingredientEmoji";

interface IngredientPillProps {
  ingredient: Ingredient;
  onToggle: (id: string) => void;
}

export function IngredientPill({ ingredient, onToggle }: IngredientPillProps) {
  const inStock = ingredient.status === "in_stock";
  const emoji = getIngredientEmoji(ingredient.name, ingredient.category);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle(ingredient.id);
      }}
      className={`flex-row items-center rounded-full border px-3.5 py-2 active:opacity-80 ${
        inStock ? "bg-white border-slate-950/10" : "bg-slate-950/5 border-slate-950/5"
      }`}
    >
      <Text style={{ fontSize: 16, opacity: inStock ? 1 : 0.4 }}>{emoji}</Text>
      <Text
        className={`ml-1.5 text-sm font-semibold ${
          inStock ? "text-slate-950" : "text-slate-400 line-through"
        }`}
      >
        {ingredient.name}
      </Text>
    </Pressable>
  );
}
