import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /**
   * Modals rendered above the header (Golden Template) must never let the
   * header's shadow bleed through the slide transition — suppress it here.
   */
  suppressShadow?: boolean;
}

export function Header({ title, subtitle, rightSlot, suppressShadow }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className={`bg-offwhite px-6 pb-4 flex-row items-center justify-between ${
        suppressShadow ? "" : "border-b border-transparent"
      }`}
    >
      <View>
        <Text className="text-slate-950 text-3xl font-extrabold tracking-tight">{title}</Text>
        {subtitle ? <Text className="text-slate-500 text-base mt-0.5">{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}
