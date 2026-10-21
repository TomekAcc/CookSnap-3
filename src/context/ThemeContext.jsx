import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";
import { enumCodec } from "../storage/codecs";
import { STORAGE_KEYS } from "../storage/keys";
import { usePersistedState } from "../hooks/usePersistedState";
import { DARK_COLORS, LIGHT_COLORS } from "../theme/colors";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // This hook's result used to be called and thrown away, so a phone already
  // set to system-wide Dark still opened the app in Light every first launch
  // — the user had to go find the toggle in Settings to get what their OS
  // already said they wanted. An explicit stored choice still wins over the
  // device (see hasStoredChoice below); this only fills in the initial value
  // when the user has never picked a theme in-app at all.
  const deviceScheme = useDeviceColorScheme();
  // An explicit stored choice always wins. `fallback` runs only when nothing
  // valid is stored (a first launch) and adopts the device setting once; after
  // that the choice is the user's and the OS flipping later does not override
  // it. Confirmed real failure that motivated persisting at all: theme had no
  // storage wiring, so a user who switched to Dark in Settings saw it revert to
  // Light on every restart.
  const [theme, setTheme] = usePersistedState(STORAGE_KEYS.theme, {
    initial: "light",
    codec: enumCodec("light", "dark"),
    fallback: () => (deviceScheme === "light" || deviceScheme === "dark" ? deviceScheme : "light"),
  });

  const isDark = theme === "dark";

  const toggleTheme = useCallback((selectedTheme) => {
    if (selectedTheme === "light" || selectedTheme === "dark") {
      setTheme(selectedTheme);
    }
  }, [setTheme]);

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
    [theme, setTheme, toggleTheme, isDark, colors]
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
