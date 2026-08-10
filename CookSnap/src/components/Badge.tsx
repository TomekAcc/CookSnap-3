import React from "react";
import { View, Text } from "react-native";

interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color = "#B8F2E6" }: BadgeProps) {
  return (
    <View
      style={{ backgroundColor: color }}
      className="px-3 py-1.5 rounded-full self-start"
    >
      <Text className="text-slate-950 text-xs font-bold">{label}</Text>
    </View>
  );
}
