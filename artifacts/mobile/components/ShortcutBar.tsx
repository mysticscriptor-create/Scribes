import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useShortcuts, type Shortcut } from "@/contexts/ShortcutsContext";
import { useTheme } from "@/contexts/ThemeContext";

type ShortcutBarProps = {
  onApply: (shortcut: Shortcut) => void;
  visible: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

export function ShortcutBar({
  onApply,
  visible,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: ShortcutBarProps) {
  const { shortcuts } = useShortcuts();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const c = activeTheme.colors;

  if (!visible) return null;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.toolbar, borderTopColor: c.border },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
      >
        {onUndo ? (
          <Pressable
            onPress={() => {
              if (canUndo) Haptics.selectionAsync();
              onUndo();
            }}
            disabled={!canUndo}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: pressed ? c.surface : "transparent",
                borderColor: c.border,
                opacity: canUndo ? 1 : 0.35,
                minWidth: 40,
              },
            ]}
            accessibilityLabel="Undo"
          >
            <Feather name="rotate-ccw" size={16} color={c.toolbarText} />
          </Pressable>
        ) : null}
        {onRedo ? (
          <Pressable
            onPress={() => {
              if (canRedo) Haptics.selectionAsync();
              onRedo();
            }}
            disabled={!canRedo}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: pressed ? c.surface : "transparent",
                borderColor: c.border,
                opacity: canRedo ? 1 : 0.35,
                minWidth: 40,
              },
            ]}
            accessibilityLabel="Redo"
          >
            <Feather name="rotate-cw" size={16} color={c.toolbarText} />
          </Pressable>
        ) : null}
        {onUndo || onRedo ? (
          <View
            style={{
              width: StyleSheet.hairlineWidth,
              alignSelf: "stretch",
              backgroundColor: c.border,
              marginHorizontal: 4,
            }}
          />
        ) : null}
        {shortcuts.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => {
              Haptics.selectionAsync();
              onApply(s);
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: pressed ? c.surface : "transparent",
                borderColor: c.border,
              },
            ]}
          >
            <Text
              style={[styles.btnText, { color: c.toolbarText }]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push("/shortcuts")}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: pressed ? c.surface : "transparent",
              borderColor: c.border,
              minWidth: 40,
            },
          ]}
        >
          <Feather name="plus" size={18} color={c.toolbarText} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  scroll: {
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
  },
  btn: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
