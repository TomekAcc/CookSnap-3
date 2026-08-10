import React from "react";
import { Pressable, Text, ActivityIndicator, View } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  variant?: "dark" | "light";
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  loading,
  variant = "dark",
  disabled,
}: PrimaryButtonProps) {
  const isDark = variant === "dark";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-full py-4 flex-row items-center justify-center active:opacity-80 ${
        isDark ? "bg-slate-950" : "bg-white border border-slate-950/10"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? "#fff" : "#0F172A"} />
      ) : (
        <View className="flex-row items-center">
          {icon ? <View className="mr-2">{icon}</View> : null}
          <Text className={`font-semibold text-base ${isDark ? "text-white" : "text-slate-950"}`}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
