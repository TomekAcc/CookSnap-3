import React from "react";
import { View, Text } from "react-native";
import { Lock } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";

/**
 * One calm line under the camera / gallery buttons saying what happens to a
 * photo. People hesitate to point a camera at their home, and the photo does
 * leave the phone (it goes to Google's AI), so this says so plainly before
 * the first use instead of leaving it to a permission prompt. Callers show it
 * only until the first scan, so it never becomes permanent clutter.
 */
export default function PrivacyNote({ style }) {
  const { t } = useCookAI();
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 6,
          marginTop: 12,
          paddingHorizontal: 4,
        },
        style,
      ]}
    >
      <Lock size={12} color={colors.textSecondary} strokeWidth={2.25} style={{ marginTop: 2 }} />
      <Text
        style={{
          flexShrink: 1,
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "500",
          color: colors.textSecondary,
        }}
      >
        {t("scanner.privacyNote")}
      </Text>
    </View>
  );
}
