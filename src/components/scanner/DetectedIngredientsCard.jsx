import React from "react";
import { Animated, TextInput, Text, TouchableOpacity, View } from "react-native";
import { Plus, X } from "../../icons";
import PillTag from "../PillTag";
import { getIngredientStyle } from "../../utils/imageUtils";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useScan } from "../../context/ScanContext";
import { useInventory } from "../../context/InventoryContext";

// Placeholders the vision model is told never to use but sometimes does; a
// chip with no emoji reads better than a generic jar or box.
const GENERIC_EMOJI = new Set(["🫙", "🛒", "📦", "❓", "🍽️", "🍽"]);

// Detected-ingredient pills only — a scoped override on top of PillTag's
// shared defaults so PantryTab's category-filter pills stay untouched.
//
// This used to be visibly bigger AND a different shape from every other
// pill in the app: paddingVertical 8 (base is 6) and borderRadius 20 — a
// rounded rectangle, not the stadium/pill shape every other chip uses. On
// a detected-fridge scan that's routinely 10+ items wrapped across 5+
// rows, that extra 2px per side and the shape mismatch were both visible
// and both added real scroll height. Padding now matches the shared
// baseline; radius stays 999 (PillTag's own default, so no explicit value
// is even needed here) — background/border stay custom, since these tags
// need a visible boundary that a selectable filter pill doesn't.
function getDetectedPillStyle(isDark, colors) {
  return {
    paddingVertical: 5,
    paddingHorizontal: 11,
    backgroundColor: colors.chipBg,
    borderColor: colors.chipBorder,
  };
}

/** Hermes-safe: strip emoji/pictographs so pills show exactly one icon. */
function stripInlineEmojis(str) {
  return String(str || "")
    .replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF])/g, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The detected ingredients as removable chips, with the manual add-an-item input. */
export default function DetectedIngredientsCard({
  chipReveal,
  manualAdd,
}) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { scanHistory } = useScan();
  const { ingredients, removeIngredient, scanIsDemo } = useInventory();
  const { handleAddItem, newItemName, setNewItemName, setShowAddInput, showAddInput } = manualAdd;
  return (
    <View
      style={{
        // 14, matching MealPreferences' card padding — this
        // card sat directly above that screen at 16, one of
        // several small size mismatches between two cards a
        // user scrolls past in the same flow.
        padding: 14,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            paddingRight: 8,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              letterSpacing: -0.2,
            }}
          >
            {t("scanner.detectedIngredients")}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowAddInput(true)}
          activeOpacity={0.75}
          style={{
            backgroundColor: colors.inputBg,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Plus size={14} color={colors.textPrimary} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: "700",
              marginLeft: 4,
            }}
          >
            {t("scanner.add")}
          </Text>
        </TouchableOpacity>
      </View>

      {showAddInput && (
        <View
          style={{
            flexDirection: "row",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <TextInput
            placeholder={t("scanner.addItemPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={newItemName}
            onChangeText={setNewItemName}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            autoFocus
            style={{
              flex: 1,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={handleAddItem}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#10B981",
              paddingHorizontal: 16,
              justifyContent: "center",
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {t("scanner.add")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowAddInput(false);
              setNewItemName("");
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("recipeDetail.cancel")}
            style={{
              width: 38,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Real tester feedback: a top-down photo can't show an exact
          cut of meat, so the scan can be wrong. One short line,
          only for the first 3 scans (scanHistory is persisted):
          after that people know the list is editable (the × and
          Add are right there) and the line is just noise. */}
      {scanIsDemo ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "600",
            lineHeight: 18,
            marginBottom: 12,
          }}
        >
          {t("scanner.sampleNote")}
        </Text>
      ) : (scanHistory || []).length <= 3 ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: "500",
            lineHeight: 17,
            marginBottom: 12,
          }}
        >
          {t("scanner.verifyHint")}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 5,
        }}
      >
        {(ingredients || []).map((item, index, list) => {
          const count = list.length;
          const cleanName =
            stripInlineEmojis(item?.name) ||
            String(item?.name || "").trim() ||
            "Item";
          // Vision already returns an accurate, language-independent
          // emoji per item (see MASTER_VISION_SYSTEM_PROMPT) — prefer
          // that over the local English-keyword guesser, which can't
          // match a name that's now in the user's selected language.
          const aiIcon =
            (typeof item?.icon === "string" && item.icon.trim()) ||
            (typeof item?.emoji === "string" && item.emoji.trim());
          const style = getIngredientStyle(cleanName);
          const rawEmoji = aiIcon || style.emoji || "";
          const slot = Math.min(index, 11) / Math.min(Math.max(count, 1), 12);
          const revealStart = slot * 0.6;
          return (
            <Animated.View
              key={item.id}
              style={{
                width: "49%",
                opacity: chipReveal.interpolate({
                  inputRange: [revealStart, revealStart + 0.4],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    translateY: chipReveal.interpolate({
                      inputRange: [revealStart, revealStart + 0.4],
                      outputRange: [10, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            >
            <PillTag
              emoji={GENERIC_EMOJI.has(rawEmoji) ? "" : rawEmoji}
              label={cleanName}
              onRemove={() => removeIngredient(item.id)}
              // flexGrow: each row stretches to the card's edges, so
              // the chips end flush on the right instead of ragged.
              // Strict two-column grid: equal widths, content left-aligned,
              // × pinned to the right edge of each chip, so emoji,
              // names and × each line up in a column. Long names may
              // use a second line instead of being cut.
              labelLines={2}
              fitLabel
              reserveEmojiSpace
              style={{
                ...getDetectedPillStyle(isDark, colors),
                width: "100%",
                justifyContent: "flex-start",
              }}
              labelStyle={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                color: colors.inkSoft,
              }}
            />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
