import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translate } from "../i18n";
import { DEFAULT_LANGUAGE_ID } from "../data/languageOptions";
import { log } from "../utils/log";
import { STORAGE_KEYS } from "../storage/keys";
import { SLATE, WHITE } from "../theme/palette";

// Reads the saved language straight from AsyncStorage (not through
// the app-state contexts / the hooks) on purpose, so the crash screen still renders in
// the user's language even if the crash happened inside the providers themselves.
// The key comes from storage/keys.js — a plain constants file with no
// dependencies — so it cannot drift from the key the app actually writes.
const RECIPE_LANGUAGE_STORAGE_KEY = STORAGE_KEYS.recipeLanguage;

/**
 * Root-level safety net. Keep it dependency-light (StyleSheet only, no app
 * context or themed components) so a crash elsewhere can never hide the real
 * error.
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
    log.error(
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
    backgroundColor: SLATE[50],
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
    color: SLATE[900],
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    color: SLATE[500],
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: SLATE[100],
    maxWidth: "100%",
  },
  errorText: {
    color: SLATE[400],
    fontSize: 12,
    fontFamily: "Courier",
  },
  button: {
    backgroundColor: SLATE[800],
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  buttonText: {
    color: WHITE,
    fontWeight: "700",
    fontSize: 14,
  },
});
