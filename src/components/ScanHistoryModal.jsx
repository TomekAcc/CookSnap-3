import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { History, ChevronRight } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import StandardSmoothModal from "./StandardSmoothModal";
import EmptyStateSparkle from "./EmptyStateSparkle";

const SOURCE_LABEL_KEY = {
  camera: "scanHistory.sourceCamera",
  gallery: "scanHistory.sourceGallery",
  demo: "scanHistory.sourceDemo",
};

/**
 * Scan History — StandardSmoothModal bottom-sheet.
 */
export default function ScanHistoryModal() {
  const { scanHistory, restoreScan, showToast, t } = useCookAI();
  const { scanHistoryOpen, setScanHistoryOpen } = useModalState();
  const { colors, isDark } = useTheme();
  const handleClose = () => setScanHistoryOpen(false);

  const handleRestore = (scan) => {
    restoreScan(scan.id);
    handleClose();
    showToast(t("scanHistory.restoredToast", { date: scan.date }), "success", 2600);
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
      headerLeft={
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
          ]}
        >
          <History size={18} color="#10B981" />
        </View>
      }
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
        scanHistory.map((scan) => (
          <TouchableOpacity
            key={scan.id}
            activeOpacity={0.7}
            onPress={() => handleRestore(scan)}
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
                {t("scanHistory.ingredientsDetected", { count: scan.itemCount })}
              </Text>
              <Text style={[styles.scanMeta, { color: colors.textSecondary }]}>
                {t(SOURCE_LABEL_KEY[scan.source] || "scanHistory.sourceCamera")} · {scan.date}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))
      )}
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
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
    fontWeight: "800",
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
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  scanThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    marginRight: 10,
  },
  scanTitle: { fontSize: 13, fontWeight: "700" },
  scanMeta: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});
