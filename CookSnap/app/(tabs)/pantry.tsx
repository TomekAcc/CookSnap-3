import React, { useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { router } from "expo-router";
import { ShoppingCart, CalendarDays, Crown } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Header } from "@/components/Header";
import { colors } from "@/constants/theme";
import { usePantry } from "@/context/PantryContext";
import { Ingredient } from "@/types";
import { getIngredientEmoji } from "@/utils/ingredientEmoji";

function IngredientRow({
  item,
  onToggle,
}: {
  item: Ingredient;
  onToggle: (id: string) => void;
}) {
  return (
    <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2">
      <View className="w-10 h-10 rounded-full bg-slate-950/5 items-center justify-center mr-3">
        <Text style={{ fontSize: 18 }}>{getIngredientEmoji(item.name, item.category)}</Text>
      </View>
      <Text
        className={`flex-1 font-semibold ${
          item.status === "in_stock" ? "text-slate-950" : "text-slate-400"
        }`}
      >
        {item.name}
      </Text>
      <Switch
        value={item.status === "in_stock"}
        onValueChange={() => onToggle(item.id)}
        trackColor={{ false: "#E2E8F0", true: colors.slate }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function PantryScreen() {
  const { ingredients, toggleStock, shoppingList } = usePantry();
  const inStockCount = ingredients.filter((i) => i.status === "in_stock").length;

  const staples = useMemo(() => ingredients.filter((i) => i.isStaple), [ingredients]);
  const fresh = useMemo(() => ingredients.filter((i) => !i.isStaple), [ingredients]);

  const handleToggle = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleStock(id);
    },
    [toggleStock]
  );

  return (
    <View className="flex-1 bg-offwhite">
      <Header
        title="Pantry"
        subtitle={`${inStockCount} of ${ingredients.length} items in stock`}
        rightSlot={
          <Pressable
            onPress={() => router.push("/(modals)/pro")}
            className="w-11 h-11 rounded-full bg-accent-butter items-center justify-center active:opacity-80"
          >
            <Crown size={18} color={colors.slate} />
          </Pressable>
        }
      />

      <View className="flex-row px-5 pb-4" style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push("/(modals)/shopping-list")}
          className="flex-1 bg-white rounded-2xl p-4 flex-row items-center active:opacity-80"
        >
          <View className="w-9 h-9 rounded-full bg-accent-coral items-center justify-center mr-3">
            <ShoppingCart size={16} color={colors.slate} />
          </View>
          <View>
            <Text className="text-slate-950 font-bold">Shopping List</Text>
            <Text className="text-slate-400 text-xs">{shoppingList.length} to buy</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(modals)/planner")}
          className="flex-1 bg-white rounded-2xl p-4 flex-row items-center active:opacity-80"
        >
          <View className="w-9 h-9 rounded-full bg-accent-sky items-center justify-center mr-3">
            <CalendarDays size={16} color={colors.slate} />
          </View>
          <View>
            <Text className="text-slate-950 font-bold">Planner</Text>
            <Text className="text-slate-400 text-xs">This week</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {staples.length > 0 ? (
          <View className="mb-6">
            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wide mb-3">
              Staples
            </Text>
            {staples.map((item) => (
              <IngredientRow key={item.id} item={item} onToggle={handleToggle} />
            ))}
          </View>
        ) : null}

        {fresh.length > 0 ? (
          <View className="mb-6">
            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wide mb-3">
              Fresh Ingredients
            </Text>
            {fresh.map((item) => (
              <IngredientRow key={item.id} item={item} onToggle={handleToggle} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
