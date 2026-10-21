import React from "react";
import { View, Text, TouchableOpacity, Switch } from "react-native";
import { FULL_DIETARY_OPTIONS } from "../data/dietaryOptions";
import DietIcon from "./DietIcon";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";

/**
 * The dietary-restriction list — one component for Settings and Profile, so
 * the two can never look different again. One row per diet: icon disc, name,
 * optional description, switch. Rows are all the same height whatever the
 * label length, which the Profile tile grid it replaced could not manage
 * ("niskowęglowodanowa" made one tile taller than its neighbours, and nine
 * tiles in two columns left a lone one at the end).
 *
 * The whole row is the touch target, with the Switch's pointerEvents off so
 * a tap on it can't double-toggle (see the Settings history: tapping the
 * label used to do nothing).
 */
export default function DietList({ showDescriptions = true }) {
  const { t, dietaryRestrictions, toggleDietaryRestriction } = useCookAI();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 6,
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      {FULL_DIETARY_OPTIONS.map((item, index) => {
        const isEnabled = !!dietaryRestrictions[item.id];
        const isLast = index === FULL_DIETARY_OPTIONS.length - 1;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => toggleDietaryRestriction(item.id)}
            activeOpacity={0.7}
            accessibilityRole="switch"
            accessibilityState={{ checked: isEnabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: showDescriptions ? 14 : 11,
              paddingHorizontal: 12,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.cardBorder,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                flex: 1,
                paddingRight: 8,
              }}
            >
              <DietIcon id={item.id} size={36} active={isEnabled} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.textPrimary,
                  }}
                >
                  {t(`diet.${item.id}.name`)}
                </Text>
                {showDescriptions ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {t(`diet.${item.id}.desc`)}
                  </Text>
                ) : null}
              </View>
            </View>

            <Switch
              value={isEnabled}
              onValueChange={() => toggleDietaryRestriction(item.id)}
              pointerEvents="none"
              trackColor={{
                false: isDark ? "#334155" : "#E2E8F0",
                true: "#10B981",
              }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
