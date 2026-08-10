import "../global.css";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PantryProvider } from "@/context/PantryContext";
import { RecipeProvider } from "@/context/RecipeContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <PantryProvider>
            <RecipeProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F8FAFC" } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="(modals)"
                  options={{
                    presentation: "transparentModal",
                    animation: "slide_from_bottom",
                    contentStyle: { backgroundColor: "transparent" },
                  }}
                />
              </Stack>
            </RecipeProvider>
          </PantryProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
