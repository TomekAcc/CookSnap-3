import React from "react";
import { View, Text } from "react-native";

import { ModalSheet } from "@/components/ModalSheet";
import { Badge } from "@/components/Badge";
import { colors, accentPalette } from "@/constants/theme";
import { useRecipes } from "@/context/RecipeContext";
import { closeModal } from "@/utils/navigation";
import { getDishEmoji } from "@/utils/dishEmoji";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlannerModal() {
  const { recipes } = useRecipes();

  return (
    <ModalSheet title="Meal Planner" onClose={closeModal}>
      <Text className="text-slate-500 text-base mb-6">
        Drop this week's picks onto your calendar.
      </Text>

      {DAYS.map((day, index) => {
        const recipe = recipes[index % Math.max(recipes.length, 1)];
        return (
          <View
            key={day}
            className="flex-row items-center bg-amber-50/60 border border-amber-900/5 rounded-2xl px-4 py-3.5 mb-3"
            style={{
              shadowColor: colors.slate,
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 1,
            }}
          >
            <View className="w-12">
              <Badge label={day} color={accentPalette[index % accentPalette.length]} />
            </View>
            {recipe ? (
              <>
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center ml-2 mr-3"
                  style={{ backgroundColor: recipe.accentColor }}
                >
                  <Text style={{ fontSize: 20 }}>{getDishEmoji(recipe.title)}</Text>
                </View>
                <Text className="flex-1 text-slate-900 font-semibold" numberOfLines={1}>
                  {recipe.title}
                </Text>
              </>
            ) : (
              <Text className="flex-1 text-slate-400 ml-2">No recipe yet</Text>
            )}
          </View>
        );
      })}
    </ModalSheet>
  );
}
