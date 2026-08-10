import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ModalSheet } from "@/components/ModalSheet";
import { Badge } from "@/components/Badge";
import { colors } from "@/constants/theme";
import { useRecipes } from "@/context/RecipeContext";
import { closeModal } from "@/utils/navigation";
import { getDishEmoji } from "@/utils/dishEmoji";
import { getIngredientEmoji } from "@/utils/ingredientEmoji";

export default function RecipeDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <ModalSheet title="Recipe" onClose={closeModal}>
        <Text className="text-slate-500">This recipe is no longer available.</Text>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet title={recipe.title} onClose={closeModal}>
      <View className="flex-row items-center mb-5">
        <View
          className="w-14 h-14 rounded-xl items-center justify-center overflow-hidden border border-slate-950/10 mr-3"
          style={{ backgroundColor: recipe.accentColor }}
        >
          <Text style={{ fontSize: 24 }}>{getDishEmoji(recipe.title)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-slate-500 text-sm">
            Serves {recipe.servings} {recipe.servings === 1 ? "person" : "people"} · Ready in{" "}
            {recipe.cookTimeMinutes} min
          </Text>
          <View className="mt-1">
            <Badge label={recipe.difficulty} color={colors.accents.mint} />
          </View>
        </View>
      </View>

      <Text className="text-slate-500 text-base mb-6">{recipe.description}</Text>

      {recipe.missingIngredients.length > 0 ? (
        <View className="mb-6">
          <Text className="text-slate-950 font-bold mb-2">You'll also need</Text>
          <View className="bg-white rounded-2xl overflow-hidden">
            {recipe.missingIngredients.map((name, index) => (
              <View
                key={name}
                className={`flex-row items-center px-4 py-3 ${
                  index > 0 ? "border-t border-slate-950/5" : ""
                }`}
              >
                <Text style={{ fontSize: 16 }}>{getIngredientEmoji(name, "other")}</Text>
                <Text className="text-slate-700 text-sm font-medium ml-3">{name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text className="text-slate-950 font-bold text-lg mb-3">Steps</Text>
      {recipe.steps.map((step, index) => (
        <View key={index} className="flex-row mb-4">
          <View className="w-7 h-7 rounded-full bg-slate-950 items-center justify-center mr-3 mt-0.5">
            <Text className="text-white font-bold text-xs">{index + 1}</Text>
          </View>
          <Text className="flex-1 text-slate-700 text-lg leading-7">{step}</Text>
        </View>
      ))}
    </ModalSheet>
  );
}
