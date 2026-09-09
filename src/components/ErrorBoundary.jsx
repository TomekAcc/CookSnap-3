import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translate } from "../i18n";
import { DEFAULT_LANGUAGE_ID } from "../data/languageOptions";

// Same key CookAIContext persists recipeLanguageId under. Duplicated
// (not imported) on purpose — this class component deliberately reads
// AsyncStorage directly instead of going through CookAIContext/useCookAI,
// so the crash screen still renders correctly in the user's language even
// if the crash happened inside CookAIProvider itself (context unavailable).
const RECIPE_LANGUAGE_STORAGE_KEY = "cookai:recipeLanguage:v1";

/**
 * Root-level safety net. StyleSheet only — never rely on NativeWind here,
 * or a CSS crash would hide the real error.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, languageId: DEFAULT_LANGUAGE_ID };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    AsyncStorage.getItem(RECIPE_LANGUAGE_STORAGE_KEY)
      .then((raw) => {
        if (raw) this.setState({ languageId: raw });
      })
      .catch(() => {});
  }

  componentDidCatch(error, info) {
    console.error(
      "[Cook AI] Caught a render crash in ErrorBoundary:",
      error,
      info?.componentStack
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const t = (key, vars) => translate(this.state.languageId, key, vars);
      return (
        <View style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            style={styles.scrollMax}
          >
            <Text style={styles.emoji}>😵</Text>
            <Text style={styles.title}>{t("errorBoundary.title")}</Text>
            <Text style={styles.body}>{t("errorBoundary.body")}</Text>
            {this.state.error?.message ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} numberOfLines={6}>
                  {String(this.state.error.message)}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={this.handleReset}
              style={styles.button}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{t("errorBoundary.tryAgain")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    // Absolute + inset:0 instead of flex:1 — this boundary can be mounted as
    // a plain sibling inside a Fragment (no flex parent), where flex:1 alone
    // would collapse to zero size and hide a real crash instead of showing it.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scroll: {
    alignItems: "center",
    paddingVertical: 24,
  },
  scrollMax: {
    maxHeight: "80%",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    maxWidth: "100%",
  },
  errorText: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "Courier",
  },
  button: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
});
