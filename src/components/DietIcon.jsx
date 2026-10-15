import React from "react";
import { View } from "react-native";
import {
  Salad,
  Sprout,
  WheatOff,
  MilkOff,
  Milk,
  Beef,
  NutOff,
  Fish,
  Droplet,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

// One vector icon per dietary restriction, replacing the emoji in
// data/dietaryOptions.js (which stays for any other consumer). Emoji glyphs
// are drawn differently by Apple and Google and never matched the app's own
// icon language; these share one stroke weight and take the theme's emerald.
const DIET_ICONS = {
  vegetarian: Salad,
  vegan: Sprout,
  gluten_free: WheatOff,
  lactose_free: MilkOff,
  dairy_free: Milk,
  keto: Beef,
  nut_free: NutOff,
  pescatarian: Fish,
  diabetic: Droplet,
};

/**
 * Icon in a round tinted disc. `active` flips it to a solid emerald disc with
 * a white icon — the selected state.
 */
export default function DietIcon({ id, size = 32, active = false }) {
  const { isDark } = useTheme();
  const Icon = DIET_ICONS[id] || Salad;
  const tint = isDark ? "#064E3B" : "#ECFDF5";
  const border = isDark ? "#065F46" : "#A7F3D0";
  const ink = isDark ? "#34D399" : "#059669";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? "#10B981" : tint,
        borderWidth: 1,
        borderColor: active ? "#10B981" : border,
      }}
    >
      <Icon
        size={Math.round(size * 0.5)}
        color={active ? "#FFFFFF" : ink}
        strokeWidth={2.2}
      />
    </View>
  );
}
