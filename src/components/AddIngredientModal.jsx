import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Plus } from "lucide-react-native";
import { POPULAR_PANTRY } from "../data/recipes";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import StandardSmoothModal from "./StandardSmoothModal";
import PillTag from "./PillTag";

/**
 * Add Custom Ingredient — StandardSmoothModal center card (synced animation).
 */
export default function AddIngredientModal() {
  const { addIngredient, ingredients, t } = useCookAI();
  const { addIngredientOpen, setAddIngredientOpen } = useModalState();
  const { colors, isDark } = useTheme();

  const [customName, setCustomName] = useState("");

  const handleClose = () => {
    setCustomName("");
    setAddIngredientOpen(false);
  };

  const handleAddCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addIngredient({
      id: `custom-${trimmed.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: trimmed,
      emoji: "✨",
    });
    setCustomName("");
  };

  return (
    <StandardSmoothModal
      visible={!!addIngredientOpen}
      onClose={handleClose}
      title={t("addIngredient.title")}
      type="center"
      scroll={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.body}
      >
        <View style={styles.inputRow}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder={t("addIngredient.placeholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.cardBorder,
                color: colors.textPrimary,
              },
            ]}
            onSubmitEditing={handleAddCustom}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={handleAddCustom}
            disabled={!customName.trim()}
            style={[
              styles.addBtn,
              { opacity: customName.trim() ? 1 : 0.5 },
            ]}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t("addIngredient.hint")}
        </Text>

        <View style={styles.chipWrap}>
          {POPULAR_PANTRY.map((item) => {
            const alreadyAdded = ingredients.some((i) => i.id === item.id);
            return (
              <PillTag
                key={item.id}
                emoji={item.emoji || "🛒"}
                label={item.name}
                onPress={
                  alreadyAdded
                    ? undefined
                    : () => {
                        addIngredient(item);
                      }
                }
                style={alreadyAdded ? { opacity: 0.45 } : null}
              />
            );
          })}
        </View>
      </KeyboardAvoidingView>
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontWeight: "500",
    fontSize: 15,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontWeight: "500",
    fontSize: 14,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 15,
    marginRight: 6,
  },
  chipName: {
    fontWeight: "600",
    fontSize: 13,
  },
});
