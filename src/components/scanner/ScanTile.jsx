import React from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Camera } from "../../icons";
import { useTheme } from "../../context/ThemeContext";
import { EMERALD } from "../../theme/palette";

const SIZE = 56;

/**
 * The round-cornered camera icon on the scan card. It is also a button: it opens the camera like "Take Photo".
 * It stays still (an earlier version had a scanner line sweeping over it, which people did not like).
 */
export default function ScanTile({ onPress, label }) {
  const { colors, isDark } = useTheme();

  const fill = (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Camera size={24} color={isDark ? EMERALD[400] : colors.greenStrong} />
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ marginBottom: 12, opacity: pressed ? 0.8 : 1 })}
      hitSlop={6}
    >
      {isDark ? (
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: 17,
            overflow: "hidden",
            backgroundColor: EMERALD[900],
            borderWidth: 1,
            borderColor: EMERALD[800],
          }}
        >
          {fill}
        </View>
      ) : (
        // Shadow on a plain outer view: the gradient clips its children, and a clip would also cut the shadow off.
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: 17,
            shadowColor: EMERALD[600],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <LinearGradient
            colors={[EMERALD[100], EMERALD[200]]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{ width: SIZE, height: SIZE, borderRadius: 17, overflow: "hidden" }}
          >
            {fill}
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}
