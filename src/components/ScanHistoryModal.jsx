import React, { useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { History, ChevronRight, Camera, Image as ImageIcon, Sparkles } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import StandardSmoothModal from "./StandardSmoothModal";
import EmptyStateSparkle from "./EmptyStateSparkle";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import { translateCount } from "../i18n";

const SOURCE_ICON = { camera: Camera, gallery: ImageIcon, demo: Sparkles };

// The source labels ship with a leading emoji ("📸 Camera"); the icon beside
// the text replaces it, in the same line-icon style as the rest of the app.
const stripLeadingEmoji = (label) => String(label || "").replace(/^[^\p{L}\p{N}]+/u, "");

const SOURCE_LABEL_KEY = {
  camera: "scanHistory.sourceCamera",
  gallery: "scanHistory.sourceGallery",
  demo: "scanHistory.sourceDemo",
};

/**
 * Scan History — StandardSmoothModal bottom-sheet.
 */
export default function ScanHistoryModal() {
  const { scanHistory, restoreScan, deleteScan, showToast, generatedRecipes, recipeLanguageId, t } =
    useCookAI();
  const { scanHistoryOpen, setScanHistoryOpen } = useModalState();
  const { colors } = useTheme();
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const handleClose = () => setScanHistoryOpen(false);

  const handleRestore = (scan) => {
    restoreScan(scan.id);
    handleClose();
    showToast(t("scanHistory.restoredToast", { date: scan.date }), "success", 2600);
  };

  // Restoring clears the recipes generated from the current scan, and for a free
  // user regenerating costs one of the day's generations. Ask first, but only
  // when there is something to lose: the current scan itself is already in this
  // history, so restoring never loses a scan.
  const hasRecipesToLose = Array.isArray(generatedRecipes) && generatedRecipes.length > 0;
  const handleRowPress = (scan) => {
    setOpenSwipeId(null);
    if (!hasRecipesToLose) {
      handleRestore(scan);
      return;
    }
    Alert.alert(t("scanHistory.confirmTitle"), t("scanHistory.confirmBody"), [
      { text: t("recipeDetail.cancel"), style: "cancel" },
      { text: t("scanHistory.confirmAction"), onPress: () => handleRestore(scan) },
    ]);
  };

  return (
    <StandardSmoothModal
      visible={!!scanHistoryOpen}
      onClose={handleClose}
      title={t("menu.scanHistory")}
      type="bottom-sheet"
      // This modal's header has no subtitle, so it's shorter than the
      // shared 110px drag-to-dismiss zone StandardModal defaults to — that
      // default would otherwise sit on top of the first history row and
      // swallow taps meant for it (confirmed directly: the row's onPress
      // never fired with the default height). Shrunk to just cover the
      // grab handle + title.
      dragZoneHeight={66}
    >
      {!scanHistory?.length ? (
        <View style={styles.emptyContainer}>
          {/* Icon chip rather than a bare 📸 emoji: the Shopping List sheet —
              this sheet's sibling, built on the same StandardSmoothModal —
              renders its empty state as a tinted chip with a lucide glyph, so
              a raw emoji here read as a different, less finished component. */}
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor: colors.accentGreenSoft || "#ECFDF5",
                borderColor: colors.accentGreenBorder || "#D1FAE5",
              },
            ]}
          >
            <History size={28} color={colors.accentGreen || "#10B981"} />
            <EmptyStateSparkle color={colors.accentGreen || "#10B981"} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t("scanHistory.emptyTitle")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t("scanHistory.emptySubtitle")}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t("scanHistory.tapToRestore")}
          </Text>
          {scanHistory.map((scan) => {
          const SourceIcon = SOURCE_ICON[scan.source] || Camera;
          const count = scan.itemCount || 0;
          return (
            <View key={scan.id} style={styles.rowGap}>
              <SwipeToDeleteRow
                isOpen={openSwipeId === scan.id}
                onOpenChange={(open) => setOpenSwipeId(open ? scan.id : null)}
                onDelete={() => deleteScan(scan.id)}
                borderRadius={16}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleRowPress(scan)}
                  style={[
                    styles.scanRow,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: scan.photoUri }}
                    style={styles.scanThumb}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scanTitle, { color: colors.textPrimary }]}>
                      {count === 1
                        ? t("scanner.itemsFoundOne", { count })
                        : translateCount(recipeLanguageId, count, {
                            few: "scanner.itemsFoundFew",
                            many: "scanner.itemsFoundMany",
                            fallback: "scanner.itemsFoundOther",
                          })}
                    </Text>
                    <View style={styles.metaRow}>
                      <SourceIcon size={13} color={colors.textSecondary} />
                      <Text
                        style={[styles.scanMeta, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {stripLeadingEmoji(
                          t(SOURCE_LABEL_KEY[scan.source] || "scanHistory.sourceCamera")
                        )}
                        {" · "}
                        {scan.date}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </SwipeToDeleteRow>
            </View>
          );
          })}
        </>
      )}
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  // Sheet-level empty-state scale, identical to ShoppingListModal's:
  // 56 chip / radius 16 / 28 glyph, 16-800--0.2 title, 13-500 body at
  // lineHeight 18. This was 14/700 over a 12/400 body with no lineHeight
  // set at all, which made the same state in two sibling sheets render at
  // noticeably different sizes.
  emptyContainer: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  hint: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 12,
  },
  rowGap: { marginBottom: 10 },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  scanThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 14,
  },
  scanTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  scanMeta: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});
