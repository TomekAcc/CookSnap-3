import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useInventory } from "../context/InventoryContext";
import { buildSamplePantry } from "../constants/samplePantry";
import PillTag from "./PillTag";

/**
 * The sample pantry, read-only: shown while the onboarding sample fridge is on screen and the person
 * has stocked nothing themselves, so the staples the first recipes use are visible instead of
 * appearing from nowhere (see pantryForGeneration). Renders nothing otherwise.
 */
export default function SamplePantryCard({ style }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { scanIsDemo, pantryItems } = useInventory();
  const visible = scanIsDemo && !(pantryItems || []).some((item) => item.inStock);
  const items = useMemo(() => (visible ? buildSamplePantry(t) : []), [visible, t]);
  if (!visible) return null;
  return (
    <View
      style={[
        {
          padding: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: 24,
        },
        style,
      ]}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 4 }}>
        {t("onboarding.samplePantryLabel")}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500", lineHeight: 18, marginBottom: 12 }}>
        {t("scanner.samplePantryNote")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <PillTag key={item.id} emoji={item.emoji} label={item.name} />
        ))}
      </View>
    </View>
  );
}
