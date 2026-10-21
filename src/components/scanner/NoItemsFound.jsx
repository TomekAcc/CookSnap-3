import React from "react";
import { TextInput, Text, TouchableOpacity, View } from "react-native";
import { Camera, Image as ImageIcon, Plus, SearchX, X } from "../../icons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

/** Shown when a finished scan found no food: retry with another photo, or add items by hand. */
export default function NoItemsFound({
  handleOpenCamera,
  handlePickFromGallery,
  manualAdd,
}) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { handleAddItem, newItemName, setNewItemName, setShowAddInput, showAddInput } = manualAdd;
  return (
    <View
      style={{
        padding: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 24,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: colors.accentGreenSoft || "#ECFDF5",
          borderWidth: 1,
          borderColor: colors.accentGreenBorder || "#D1FAE5",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <SearchX size={26} color="#059669" />
      </View>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 17,
          fontWeight: "700",
          letterSpacing: -0.2,
          textAlign: "center",
        }}
      >
        {t("scanner.noItemsTitle")}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: "500",
          textAlign: "center",
          lineHeight: 20,
          marginTop: 6,
        }}
      >
        {t("scanner.noItemsTip")}
      </Text>

      {/* The message offers "add manually", so the way to do it has
          to be right here (the normal card's Add button only exists
          once there is a list). */}
      {showAddInput ? (
        <View
          style={{
            flexDirection: "row",
            alignSelf: "stretch",
            marginTop: 14,
            gap: 8,
          }}
        >
          <TextInput
            placeholder={t("scanner.addItemPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={newItemName}
            onChangeText={setNewItemName}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            autoFocus
            style={{
              flex: 1,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={handleAddItem}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#10B981",
              paddingHorizontal: 16,
              justifyContent: "center",
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
              {t("scanner.add")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowAddInput(false);
              setNewItemName("");
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("recipeDetail.cancel")}
            style={{
              width: 38,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
        <View
          style={{
            flexDirection: "row",
            alignSelf: "stretch",
            marginTop: 16,
            gap: 10,
          }}
        >
          <TouchableOpacity
            onPress={handleOpenCamera}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#059669",
              paddingVertical: 13,
              borderRadius: 16,
            }}
          >
            <Camera size={17} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: "700",
                marginLeft: 8,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {t("scanner.takePhoto")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePickFromGallery}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingVertical: 13,
              borderRadius: 16,
            }}
          >
            <ImageIcon size={17} color="#059669" />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: "700",
                marginLeft: 8,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {t("scanner.fromGallery")}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddInput(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <Plus size={15} color="#059669" />
          <Text
            style={{
              color: "#059669",
              fontSize: 14,
              fontWeight: "700",
              marginLeft: 5,
            }}
          >
            {t("scanner.add")}
          </Text>
        </TouchableOpacity>
        </>
      )}
    </View>
  );
}
