import React from "react";
import { View, Text, Pressable } from "react-native";
import { Clock } from "lucide-react-native";
import { Recipe } from "@/types";
import { colors } from "@/constants/theme";
import { getDishEmoji } from "@/utils/dishEmoji";

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const emoji = getDishEmoji(recipe.title);

  return (
    <Pressable
      onPress={() => onPress(recipe)}
      className="bg-amber-50/60 border border-amber-900/5 rounded-3xl mb-4 overflow-hidden active:opacity-80"
      style={{
        shadowColor: colors.slate,
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center p-4">
        <View
          className="w-20 h-20 rounded-xl items-center justify-center overflow-hidden border border-slate-950/10"
          style={{ backgroundColor: recipe.accentColor }}
        >
          <Text style={{ fontSize: 36 }}>{emoji}</Text>
        </View>
        <View className="flex-1 min-w-0 ml-3 justify-center">
          <Text className="text-slate-900 text-base font-extrabold mb-0.5" numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text className="text-slate-500 text-xs mb-1.5" numberOfLines={1}>
            {recipe.description}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <View className="flex-row items-center shrink-0">
              <Clock size={11} color={colors.textMuted} />
              <Text className="text-slate-400 text-xs ml-1" numberOfLines={1}>
                {recipe.cookTimeMinutes} min
              </Text>
            </View>
            <Text className="text-slate-400 text-xs shrink-0" numberOfLines={1}>
              Serves {recipe.servings}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full border border-slate-950/10 shrink-0"
              style={{ backgroundColor: recipe.accentColor }}
            >
              <Text className="text-slate-900 text-xs font-bold" numberOfLines={1}>
                {recipe.difficulty}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
