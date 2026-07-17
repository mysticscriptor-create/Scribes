import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { IconButton } from "@/components/IconButton";
import { FONT_FAMILY_MAP, type Theme } from "@/constants/defaultThemes";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemesScreen() {
  const router = useRouter();
  const {
    themes,
    activeTheme,
    setActiveTheme,
    duplicateTheme,
    deleteTheme,
    saveTheme,
  } = useTheme();
  const c = activeTheme.colors;
  const [newName, setNewName] = useState("");

  const handleDuplicate = (t: Theme) => {
    const copy = duplicateTheme(t.id);
    if (!copy) return;
    const desiredName = newName.trim();
    const finalCopy = desiredName ? { ...copy, name: desiredName } : copy;
    if (desiredName) saveTheme(finalCopy);
    setNewName("");
    router.push({ pathname: "/theme-edit", params: { themeId: finalCopy.id } });
  };

  const handleDelete = (t: Theme) => {
    if (t.builtIn) return;
    Alert.alert("Delete theme", `Delete "${t.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteTheme(t.id),
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
    >
      <Text style={[styles.intro, { color: c.mutedText }]}>
        Tap a theme to apply it. Duplicate any theme to create your own
        editable version.
      </Text>

      <View
        style={[
          styles.newRow,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New theme name (optional)"
          placeholderTextColor={c.mutedText}
          style={[styles.newInput, { color: c.text, borderColor: c.border }]}
        />
      </View>

      {themes.map((t) => (
        <View
          key={t.id}
          style={[
            styles.card,
            {
              backgroundColor: t.colors.background,
              borderColor: c.border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: t.colors.text,
                  fontSize: 18,
                  fontWeight: "700",
                  fontFamily: FONT_FAMILY_MAP[t.fontFamily],
                }}
              >
                {t.name}
              </Text>
              <Text
                style={{
                  color: t.colors.mutedText,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {t.builtIn ? "Built-in" : "Custom"} ·{" "}
                {Math.round(t.fontSize)}pt · {t.fontFamily}
              </Text>
            </View>
            {activeTheme.id === t.id ? (
              <View
                style={[
                  styles.activeBadge,
                  { backgroundColor: t.colors.accent },
                ]}
              >
                <Feather name="check" size={12} color={t.colors.background} />
                <Text
                  style={{
                    color: t.colors.background,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  Active
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={2}
            style={{
              color: t.colors.text,
              fontFamily: FONT_FAMILY_MAP[t.fontFamily],
              fontSize: t.fontSize,
              lineHeight: t.fontSize * t.lineHeight,
              marginTop: 12,
            }}
          >
            The quick brown fox jumps over the lazy dog. Cras at lacinia justo.
          </Text>

          <View style={styles.swatchRow}>
            <Swatch color={t.colors.background} label="bg" />
            <Swatch color={t.colors.surface} label="surf" />
            <Swatch color={t.colors.text} label="text" />
            <Swatch color={t.colors.accent} label="accent" />
          </View>

          <View style={styles.cardActions}>
            {activeTheme.id !== t.id ? (
              <IconButton
                icon="check-circle"
                label="Apply"
                onPress={() => setActiveTheme(t.id)}
                variant="solid"
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={{ flex: 1 }} />
            <IconButton
              icon="copy"
              label="Duplicate"
              onPress={() => handleDuplicate(t)}
              variant="outline"
            />
            {!t.builtIn ? (
              <IconButton
                icon="edit-2"
                onPress={() =>
                  router.push({
                    pathname: "/theme-edit",
                    params: { themeId: t.id },
                  })
                }
                variant="outline"
              />
            ) : null}
            {!t.builtIn ? (
              <IconButton
                icon="trash-2"
                onPress={() => handleDelete(t)}
                variant="outline"
              />
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatch}>
      <View
        style={[
          styles.swatchChip,
          { backgroundColor: color, borderColor: "rgba(0,0,0,0.15)" },
        ]}
      />
      <Text style={styles.swatchLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 13,
    lineHeight: 18,
  },
  newRow: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  newInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  activeBadge: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    flexWrap: "wrap",
  },
  swatch: {
    alignItems: "center",
    gap: 4,
  },
  swatchChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  swatchLabel: {
    fontSize: 10,
    color: "#999",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
  },
});
