import React from "react";
import { View, Text, Pressable } from "react-native";
import { PartyPopper } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { ModalSheet } from "@/components/ModalSheet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, accentPalette } from "@/constants/theme";
import { usePantry } from "@/context/PantryContext";
import { closeModal } from "@/utils/navigation";
import { getIngredientEmoji } from "@/utils/ingredientEmoji";

export default function ShoppingListModal() {
  const { shoppingList, setStock } = usePantry();

  const handleRestock = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStock(id, "in_stock");
  };

  return (
    <ModalSheet
      title="Shopping List"
      onClose={closeModal}
      footer={<PrimaryButton label="Done" onPress={closeModal} />}
    >
      {shoppingList.length === 0 ? (
        <View className="items-center justify-center py-16">
          <View className="w-16 h-16 rounded-full bg-accent-mint items-center justify-center mb-4">
            <PartyPopper size={28} color={colors.slate} />
          </View>
          <Text className="text-slate-950 text-xl font-extrabold mb-1">Congratulations!</Text>
          <Text className="text-slate-500 text-sm text-center px-8">
            Everything is stocked. Nothing left to buy.
          </Text>
        </View>
      ) : (
        shoppingList.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => handleRestock(item.id)}
            className="flex-row items-center bg-amber-50/60 border border-amber-900/5 rounded-2xl px-4 py-4 mb-3 active:opacity-80"
            style={{
              shadowColor: colors.slate,
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 1,
            }}
          >
            <View
              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: accentPalette[index % accentPalette.length] }}
            >
              <Text style={{ fontSize: 20 }}>{getIngredientEmoji(item.name, item.category)}</Text>
            </View>
            <Text className="flex-1 font-semibold text-slate-900">{item.name}</Text>
            <Text className="text-slate-400 text-xs">Tap to restock</Text>
          </Pressable>
        ))
      )}
    </ModalSheet>
  );
}
