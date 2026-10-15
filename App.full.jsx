import "./global.css";
import React from "react";
import { View, StatusBar, LogBox, Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { CookAIProvider, useCookAI } from "./src/context/CookAIContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import ErrorBoundary from "./src/components/ErrorBoundary";
import Header, { HEADER_SHADOW_KILL } from "./src/components/Header";
import BottomNav from "./src/components/BottomNav";
import MenuDrawer from "./src/components/MenuDrawer";
import NotificationsDrawer from "./src/components/NotificationsDrawer";
import AddIngredientModal from "./src/components/AddIngredientModal";
import ProSubscriptionModal from "./src/components/ProSubscriptionModal";
import RecipeDetailModal from "./src/components/RecipeDetailModal";
import ScanHistoryModal from "./src/components/ScanHistoryModal";
import MealPlannerModal from "./src/components/MealPlannerModal";
import HelpFeedbackModal from "./src/components/HelpFeedbackModal";
import Toast from "./src/components/Toast";
import ScannerScreen from "./src/screens/ScannerScreen";
import PantryTab from "./src/components/PantryTab";
import SavedScreen from "./src/screens/SavedScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

try {
  LogBox.ignoreLogs([
    "Failed to load",
    "Image",
    "Network request failed",
    "Possible Unhandled Promise Rejection",
    "Unable to download",
  ]);
} catch {
  // LogBox may be unavailable in some builds — ignore.
}

function MainContent() {
  try {
    const { activeTab } = useCookAI();

    switch (activeTab) {
      case "pantry":
        return <PantryTab />;
      case "saved":
        return <SavedScreen />;
      case "profile":
        return <ProfileScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <ScannerScreen />;
    }
  } catch (err) {
    console.error("[Cook AI] MainContent render failed:", err?.message);
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          backgroundColor: "#F8FAFC",
        }}
      >
        <Text
          style={{
            color: "#0F172A",
            fontWeight: "700",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Something went wrong loading this screen
        </Text>
        <Text
          style={{
            color: "#64748B",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Pull to refresh or restart the app. Your recipes are safe.
        </Text>
      </View>
    );
  }
}

/**
 * Mount at most one native Modal tree at a time.
 * Mounting 8+ RN <Modal>s on boot (even visible=false) can crash Expo Go on iOS.
 */
function OverlayHost() {
  const {
    menuOpen,
    notificationsOpen,
    addIngredientOpen,
    proModalOpen,
    selectedRecipe,
    scanHistoryOpen,
    mealPlannerOpen,
    helpModalOpen,
  } = useCookAI();

  return (
    <>
      {menuOpen ? <MenuDrawer /> : null}
      {notificationsOpen ? <NotificationsDrawer /> : null}
      {addIngredientOpen ? <AddIngredientModal /> : null}
      {proModalOpen ? <ProSubscriptionModal /> : null}
      {selectedRecipe ? (
        <ErrorBoundary>
          <RecipeDetailModal />
        </ErrorBoundary>
      ) : null}
      {scanHistoryOpen ? <ScanHistoryModal /> : null}
      {mealPlannerOpen ? <MealPlannerModal /> : null}
      {helpModalOpen ? <HelpFeedbackModal /> : null}
    </>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const { isAnyModalOpen } = useCookAI();

  return (
    <>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["left", "right"]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <Toast />
        <ErrorBoundary>
          <View
            style={[
              { zIndex: 10, backgroundColor: colors.bg },
              isAnyModalOpen ? HEADER_SHADOW_KILL : null,
            ]}
            collapsable={false}
          >
            <Header />
          </View>
        </ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ErrorBoundary>
            <MainContent />
          </ErrorBoundary>
        </View>
        <ErrorBoundary>
          <BottomNav />
        </ErrorBoundary>
      </SafeAreaView>
      <OverlayHost />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <CookAIProvider>
              <AppShell />
            </CookAIProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
