import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = "cookai:theme:v1";

/** Ultimate Premium Native — #F5F5F7 spatial canvas, pure white cards, glass chrome */
const LIGHT_COLORS = {
  bg: "#F5F5F7",
  card: "#FFFFFF",
  cardBorder: "rgba(0, 0, 0, 0.06)",
  cardSurface: "#FFFFFF",
  cardSurfaceInner: "#F5F5F7",
  borderSubtle: "rgba(0, 0, 0, 0.08)",
  textPrimary: "#1D1D1F",
  textSecondary: "#6E6E73",
  textTertiary: "#86868B",
  inputBg: "#F5F5F7",
  chrome: "rgba(245, 245, 247, 0.72)",
  chromeBorder: "rgba(0, 0, 0, 0.08)",
  navBg: "rgba(255, 255, 255, 0.72)",
  navBorder: "rgba(0, 0, 0, 0.08)",
  // Emerald, matching GREEN in src/theme/tokens.js. These were iOS system
  // green (#34C759) while every component rendered Tailwind emerald — the
  // theme file and the UI disagreed about what "the app's green" was.
  accentGreen: "#10B981",
  accentGreenSoft: "#ECFDF5",
  accentGreenBorder: "#D1FAE5",
  accentPrimary: "#007AFF",
  accentPrimarySoft: "#EAF2FF",
  accentPrimaryBorder: "#B3D4FF",
  accentAmber: "#FF9F0A",
  accentCharcoal: "#1D1D1F",
  backdrop: "rgba(15, 23, 42, 0.58)",
  sheetHandle: "#D2D2D7",
  danger: "#FF3B30",
  dangerSoft: "#FFECEA",
  dangerBorder: "#FFC4C0",
  pillSelected: "#007AFF",
  pillSelectedText: "#FFFFFF",
  stockInBg: "#ECFDF5",
  stockInText: "#047857",
  stockOutBg: "#FFECEA",
  stockOutText: "#D70015",
};

const DARK_COLORS = {
  bg: "#000000",
  card: "#1C1C1E",
  cardBorder: "rgba(255, 255, 255, 0.12)",
  cardSurface: "#1C1C1E",
  cardSurfaceInner: "#2C2C2E",
  borderSubtle: "rgba(255, 255, 255, 0.16)",
  textPrimary: "#F5F5F7",
  textSecondary: "#A1A1A6",
  textTertiary: "#86868B",
  inputBg: "#2C2C2E",
  chrome: "rgba(28, 28, 30, 0.72)",
  chromeBorder: "rgba(255, 255, 255, 0.12)",
  navBg: "rgba(28, 28, 30, 0.72)",
  navBorder: "rgba(255, 255, 255, 0.12)",
  accentGreen: "#10B981",
  accentGreenSoft: "#064E3B",
  accentGreenBorder: "#065F46",
  accentPrimary: "#0A84FF",
  accentPrimarySoft: "#0A2540",
  accentPrimaryBorder: "#0A4A8A",
  accentAmber: "#FF9F0A",
  accentCharcoal: "#F5F5F7",
  backdrop: "rgba(15, 23, 42, 0.58)",
  sheetHandle: "#636366",
  danger: "#FF453A",
  dangerSoft: "#3A0A08",
  dangerBorder: "#8A1C16",
  pillSelected: "#0A84FF",
  pillSelectedText: "#FFFFFF",
  // darkInk, not the primary green: emerald-500 on an emerald-900 ground
  // is too low-contrast for small text — green TEXT in dark mode needs the
  // brighter tint even though green FILLS use the primary.
  stockInBg: "#064E3B",
  stockInText: "#6EE7B7",
  stockOutBg: "#3A0A08",
  stockOutText: "#FF453A",
};

export function ThemeProvider({ children }) {
  // This hook's result used to be called and thrown away, so a phone already
  // set to system-wide Dark still opened the app in Light every first launch
  // — the user had to go find the toggle in Settings to get what their OS
  // already said they wanted. An explicit stored choice still wins over the
  // device (see hasStoredChoice below); this only fills in the initial value
  // when the user has never picked a theme in-app at all.
  const deviceScheme = useDeviceColorScheme();
  const [theme, setTheme] = useState("light");
  // Set once hydration confirms a saved theme exists, so the device-scheme
  // effect below can never stomp a choice the user actually made.
  const hasStoredChoice = useRef(false);
  // Confirmed real failure, not a hypothetical: theme had zero AsyncStorage
  // wiring at all — a user who switched to Dark mode in Settings saw it
  // silently revert to Light every time the app restarted. Same hydrate-
  // once-then-persist-on-change pattern used throughout CookAIContext.
  const [themeHydrated, setThemeHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (raw === "light" || raw === "dark")) {
          hasStoredChoice.current = true;
          setTheme(raw);
        }
      } catch (err) {
        console.warn("[Cook AI] theme hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setThemeHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Adopt the device's dark-mode setting on a first launch that found no
  // saved theme. Runs after hydration so it can't race the stored value, and
  // bails the moment a stored choice exists — deliberately including when the
  // user later picks a theme in Settings, since an explicit in-app choice
  // should stick even if it disagrees with the OS.
  useEffect(() => {
    if (!themeHydrated || hasStoredChoice.current) return;
    if (deviceScheme === "light" || deviceScheme === "dark") {
      setTheme(deviceScheme);
    }
  }, [themeHydrated, deviceScheme]);

  useEffect(() => {
    if (!themeHydrated) return;
    AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch((err) =>
      console.warn("[Cook AI] theme persist failed:", err?.message)
    );
  }, [themeHydrated, theme]);

  const isDark = theme === "dark";

  const toggleTheme = useCallback((selectedTheme) => {
    if (selectedTheme === "light" || selectedTheme === "dark") {
      setTheme(selectedTheme);
    }
  }, []);

  const colors = useMemo(
    () => (isDark ? DARK_COLORS : LIGHT_COLORS),
    [isDark]
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark,
      colors,
    }),
    [theme, toggleTheme, isDark, colors]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
