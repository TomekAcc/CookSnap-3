import React, { useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { RefreshCw, ChefHat } from "lucide-react-native";

import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { colors } from "@/constants/theme";
import { useRecipes } from "@/context/RecipeContext";
import { Recipe } from "@/types";

export default function RecipesScreen() {
  const { recipes, isGenerating, error, refreshRecipes } = useRecipes();

  useEffect(() => {
    if (recipes.length === 0) {
      refreshRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenRecipe = (recipe: Recipe) => {
    router.push({ pathname: "/(modals)/recipe/[id]", params: { id: recipe.id } });
  };

  return (
    <View className="flex-1 bg-offwhite">
      <Header
        title="Recipes"
        subtitle="5 ideas from your kitchen"
        rightSlot={
          <Pressable
            onPress={refreshRecipes}
            disabled={isGenerating}
            className="w-11 h-11 rounded-full bg-slate-950 items-center justify-center active:opacity-80"
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <RefreshCw size={18} color="#fff" />
            )}
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {isGenerating && recipes.length === 0 ? (
          <View className="items-center justify-center py-24">
            <ActivityIndicator color={colors.slate} />
            <Text className="text-slate-500 mt-4">Cooking up ideas…</Text>
          </View>
        ) : null}

        {error ? (
          <View className="items-center justify-center py-24">
            <Text className="text-slate-500 text-center mb-4">{error}</Text>
            <Pressable onPress={refreshRecipes} className="bg-slate-950 rounded-full px-6 py-3">
              <Text className="text-white font-semibold">Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {!isGenerating && !error && recipes.length === 0 ? (
          <View className="items-center justify-center py-24 px-8">
            <ChefHat size={36} color={colors.textMuted} />
            <Text className="text-slate-950 font-bold text-lg mt-4 mb-1 text-center">
              No recipes yet
            </Text>
            <Text className="text-slate-500 text-center">
              Scan your fridge or tap refresh to generate ideas.
            </Text>
          </View>
        ) : null}

        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onPress={handleOpenRecipe} />
        ))}
      </ScrollView>
    </View>
  );
}
