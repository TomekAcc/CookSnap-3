import React from "react";
import { Tabs } from "expo-router";
import { Camera, ChefHat, Package } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { getTabBarStyle } from "@/constants/tabBarStyle";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.slate,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarStyle: getTabBarStyle(insets.bottom),
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          tabBarIcon: ({ color, size }) => <ChefHat color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
