import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

const FEATURES: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  {
    icon: "edit-3",
    title: "Distraction-free editor",
    body: "Plain text and Markdown writing with autosave. Tap the eye icon for full Zen mode.",
  },
  {
    icon: "command",
    title: "Smart shortcut bar",
    body: "Customize the row above the keyboard. Pair characters auto-close, and pressing Enter inside a pair jumps you out.",
  },
  {
    icon: "folder",
    title: "Files & folders",
    body: "Browse .txt and .md notes with nested folders. Swipe in from the right edge to open the files panel.",
  },
  {
    icon: "copy",
    title: "Floating windows",
    body: "Open any note in a draggable, resizable window — perfect for quick reference while writing.",
  },
  {
    icon: "bookmark",
    title: "Pinned references",
    body: "Pin one note to the top half and another to the bottom half of the side panel for split reading.",
  },
  {
    icon: "droplet",
    title: "Themes you control",
    body: "Five built-in themes plus a full theme editor — colors, fonts, spacing, padding. Save your own.",
  },
];

export default function AboutScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 22, paddingBottom: 60, gap: 18 }}
    >
      <View style={{ alignItems: "center", marginTop: 4, marginBottom: 4 }}>
        <View
          style={[
            styles.logo,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Feather name="feather" size={36} color={c.accent} />
        </View>
        <Text style={[styles.brand, { color: c.text }]}>Scribe</Text>
        <Text style={[styles.tagline, { color: c.mutedText }]}>
          A quiet place to write
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.cardText, { color: c.text }]}>
          Scribe is a focused writing companion inspired by classic distraction-free
          editors. It lives entirely on your device — your notes are saved locally
          and never leave the app.
        </Text>
      </View>

      {/* Guide link */}
      <Pressable
        onPress={() => router.push("/guide")}
        style={({ pressed }) => [
          styles.guideBtn,
          {
            backgroundColor: pressed ? c.accent + "dd" : c.accent,
            borderColor: c.accent,
          },
        ]}
      >
        <Feather name="book-open" size={18} color={c.toolbar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.guideBtnTitle, { color: c.toolbar }]}>
            How to use Scribe
          </Text>
          <Text style={[styles.guideBtnSub, { color: c.toolbar + "cc" }]}>
            Writing, shortcuts, folders, projects, themes & more
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={c.toolbar + "aa"} />
      </Pressable>

      <Text style={[styles.section, { color: c.mutedText }]}>What's inside</Text>
      {FEATURES.map((f) => (
        <View
          key={f.title}
          style={[
            styles.feature,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View
            style={[styles.featureIcon, { backgroundColor: c.background }]}
          >
            <Feather name={f.icon} size={18} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: c.text }]}>
              {f.title}
            </Text>
            <Text style={[styles.featureBody, { color: c.mutedText }]}>
              {f.body}
            </Text>
          </View>
        </View>
      ))}

      <View
        style={[
          styles.tipBox,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Feather name="info" size={14} color={c.accent} />
        <Text style={[styles.tipText, { color: c.text }]}>
          On Android, swipe in from the right edge of the screen to open the
          files panel. Long-press a file for actions: open, float, pin, or
          delete.
        </Text>
      </View>

      <Text style={[styles.footer, { color: c.mutedText }]}>
        Made with care for writers.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  guideBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  guideBtnTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  guideBtnSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 4,
  },
  feature: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 16,
  },
});
