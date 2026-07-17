import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useNotes } from "@/contexts/NotesContext";
import {
  DEFAULT_EDITOR_FONT_SIZE,
  usePanels,
  type FileViewMode,
  type LineSpacing,
} from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWritingStats } from "@/contexts/WritingStatsContext";

export default function SettingsScreen() {
  const router = useRouter();
  const { activeTheme, themes, setActiveTheme } = useTheme();
  const {
    vaultName,
    setVaultName,
    externalRoot,
    isSafSupported,
    connectExternalFolder,
    disconnectExternalFolder,
    refreshExternalFolder,
  } = useNotes();
  const {
    showWordCount,
    setShowWordCount,
    typewriterMode,
    setTypewriterMode,
    viewMode,
    setViewMode,
    lineSpacing,
    setLineSpacing,
    editorFontSize,
    setEditorFontSize,
  } = usePanels();
  const {
    dailyGoal,
    setDailyGoal,
    todayWords,
    currentStreak,
    longestStreak,
  } = useWritingStats();
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  const c = activeTheme.colors;

  const [vaultDraft, setVaultDraft] = useState(vaultName);

  const onSaveVault = () => {
    const name = vaultDraft.trim();
    if (name) setVaultName(name);
  };

  const onDisconnect = () => {
    Alert.alert(
      "Disconnect folder",
      `Stop using "${externalRoot?.name}"? Your phone files stay where they are; Scribe goes back to the built-in vault.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", onPress: disconnectExternalFolder },
      ],
    );
  };

  const viewOpts: { v: FileViewMode; label: string }[] = [
    { v: "tree", label: "Tree" },
    { v: "list", label: "List" },
    { v: "folders", label: "Folders" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── 1. Storage & Folders ── */}
      <Section
        label="Storage & Folders"
        description="Choose where your notes live — the built-in vault or a folder on your phone."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: c.text }]}>
                {externalRoot ? externalRoot.name : vaultName}
              </Text>
              <Text style={[styles.cardSub, { color: c.mutedText }]}>
                {externalRoot
                  ? "Connected phone folder · live"
                  : "Built-in vault — notes stored privately on this device"}
              </Text>
            </View>
            <Feather
              name={externalRoot ? "smartphone" : "hard-drive"}
              size={20}
              color={c.accent}
            />
          </View>
          <View style={{ height: 12 }} />
          {externalRoot ? (
            <View style={styles.actionRow}>
              <ActionBtn
                icon="refresh-ccw"
                label="Refresh"
                onPress={refreshExternalFolder}
              />
              <ActionBtn
                icon="log-out"
                label="Disconnect"
                onPress={onDisconnect}
              />
            </View>
          ) : (
            <ActionBtn
              icon="folder"
              label="Connect a folder on your phone"
              primary
              onPress={async () => {
                if (!isSafSupported) {
                  Alert.alert(
                    "Android only",
                    "Picking a phone folder works in the installed Android app.",
                  );
                  return;
                }
                await connectExternalFolder();
              }}
            />
          )}
        </View>

        {!externalRoot ? (
          <View
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.cardLabel, { color: c.text }]}>
              Vault name
            </Text>
            <Text style={[styles.cardSub, { color: c.mutedText }]}>
              Shown in the menu and side panel.
            </Text>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={vaultDraft}
                onChangeText={setVaultDraft}
                placeholder="My Vault"
                placeholderTextColor={c.mutedText}
                style={[
                  styles.input,
                  { color: c.text, borderColor: c.border },
                ]}
                onSubmitEditing={onSaveVault}
              />
              <ActionBtn icon="check" label="Save" onPress={onSaveVault} />
            </View>
          </View>
        ) : null}
      </Section>

      {/* ── 2. Appearance & Theme ── */}
      <Section
        label="Appearance & Theme"
        description="Pick a built-in theme or open the theme editor to create your own."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: c.text }]}>Theme</Text>
          <View style={{ height: 8 }} />
          <View style={{ gap: 6 }}>
            {themes.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setActiveTheme(t.id)}
                style={({ pressed }) => [
                  styles.themeRow,
                  {
                    backgroundColor: pressed ? c.background : "transparent",
                    borderColor: c.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themeSwatch,
                    {
                      backgroundColor: t.colors.background,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeSwatchInner,
                      { backgroundColor: t.colors.accent },
                    ]}
                  />
                </View>
                <Text
                  style={{
                    color: c.text,
                    fontSize: 15,
                    flex: 1,
                    fontWeight: activeTheme.id === t.id ? "700" : "400",
                  }}
                >
                  {t.name}
                </Text>
                {activeTheme.id === t.id ? (
                  <Feather name="check" size={16} color={c.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
          <View style={{ height: 12 }} />
          <ActionBtn
            icon="droplet"
            label="Open theme editor"
            onPress={() => router.push("/themes")}
          />
        </View>
      </Section>

      {/* ── 3. Writing & Editor ── */}
      <Section
        label="Writing & Editor"
        description="Adjust how the editor looks and behaves while you write."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: c.text }]}>
                Floating word count
              </Text>
              <Text style={[styles.cardSub, { color: c.mutedText }]}>
                A small word counter overlays the editor while you write.
              </Text>
            </View>
            <Switch
              value={showWordCount}
              onValueChange={setShowWordCount}
              thumbColor={showWordCount ? c.accent : undefined}
              trackColor={{ true: c.accent + "55", false: c.border }}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: c.text }]}>
                Typewriter scrolling
              </Text>
              <Text style={[styles.cardSub, { color: c.mutedText }]}>
                Keeps your cursor line centered as you type, so your eyes
                never have to chase the text.
              </Text>
            </View>
            <Switch
              value={typewriterMode}
              onValueChange={setTypewriterMode}
              thumbColor={typewriterMode ? c.accent : undefined}
              trackColor={{ true: c.accent + "55", false: c.border }}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: c.text }]}>
            Line spacing
          </Text>
          <Text style={[styles.cardSub, { color: c.mutedText }]}>
            Controls the breathing room between lines of text.
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(
              [
                { v: "compact", label: "Compact" },
                { v: "comfortable", label: "Comfortable" },
                { v: "spacious", label: "Spacious" },
              ] as { v: LineSpacing; label: string }[]
            ).map((o) => (
              <Pressable
                key={o.v}
                onPress={() => setLineSpacing(o.v)}
                style={({ pressed }) => [
                  styles.segBtn,
                  {
                    flex: 1,
                    backgroundColor:
                      lineSpacing === o.v
                        ? c.accent
                        : pressed
                          ? c.background
                          : "transparent",
                    borderColor: lineSpacing === o.v ? c.accent : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: lineSpacing === o.v ? c.toolbar : c.text,
                    fontWeight: "600",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: c.text }]}>
            Font size — {editorFontSize}px
          </Text>
          <Text style={[styles.cardSub, { color: c.mutedText }]}>
            Editor text size (14–22 px). Tap Reset to return to the default.
          </Text>
          <View style={{ height: 10 }} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Pressable
              onPress={() =>
                setEditorFontSize(Math.max(14, editorFontSize - 1))
              }
              style={({ pressed }) => [
                styles.segBtn,
                {
                  width: 40,
                  backgroundColor: pressed ? c.background : "transparent",
                  borderColor: c.border,
                },
              ]}
              accessibilityLabel="Decrease font size"
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                −
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  height: 4,
                  backgroundColor: c.border,
                  borderRadius: 2,
                }}
              >
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: c.accent,
                    width: `${((editorFontSize - 14) / (22 - 14)) * 100}%`,
                  }}
                />
              </View>
            </View>
            <Pressable
              onPress={() =>
                setEditorFontSize(Math.min(22, editorFontSize + 1))
              }
              style={({ pressed }) => [
                styles.segBtn,
                {
                  width: 40,
                  backgroundColor: pressed ? c.background : "transparent",
                  borderColor: c.border,
                },
              ]}
              accessibilityLabel="Increase font size"
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                +
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <Text style={{ color: c.mutedText, fontSize: 11 }}>14</Text>
            <Pressable
              onPress={() => setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)}
            >
              <Text style={{ color: c.accent, fontSize: 11 }}>Reset</Text>
            </Pressable>
            <Text style={{ color: c.mutedText, fontSize: 11 }}>22</Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardSub, { color: c.mutedText }]}>
            Add, remove, or reorder the buttons that appear above the keyboard.
          </Text>
          <View style={{ height: 8 }} />
          <ActionBtn
            icon="command"
            label="Customize shortcut bar"
            onPress={() => router.push("/shortcuts")}
          />
        </View>
      </Section>

      {/* ── 4. Files & Navigation ── */}
      <Section
        label="Files & Navigation"
        description="Control how notes and folders are displayed in the file panel."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: c.text }]}>
            Default view
          </Text>
          <Text style={[styles.cardSub, { color: c.mutedText }]}>
            Tree shows folder hierarchy. List shows every note flat. Folders
            shows a visual grid with cover.jpg images.
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {viewOpts.map((o) => (
              <Pressable
                key={o.v}
                onPress={() => setViewMode(o.v)}
                style={({ pressed }) => [
                  styles.segBtn,
                  {
                    backgroundColor:
                      viewMode === o.v
                        ? c.accent
                        : pressed
                          ? c.background
                          : "transparent",
                    borderColor:
                      viewMode === o.v ? c.accent : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: viewMode === o.v ? c.toolbar : c.text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Section>

      {/* ── 5. Goals & Streaks ── */}
      <Section
        label="Goals & Streaks"
        description="Set a daily word target and track your writing consistency."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: c.text }]}>
            Daily word goal
          </Text>
          <Text style={[styles.cardSub, { color: c.mutedText }]}>
            {todayWords.toLocaleString()} / {dailyGoal.toLocaleString()} words
            written today
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="number-pad"
              placeholder="500"
              placeholderTextColor={c.mutedText}
              style={[
                styles.input,
                { color: c.text, borderColor: c.border },
              ]}
              onSubmitEditing={() => {
                const n = parseInt(goalDraft, 10);
                if (!Number.isNaN(n) && n > 0) setDailyGoal(n);
              }}
            />
            <ActionBtn
              icon="check"
              label="Save"
              onPress={() => {
                const n = parseInt(goalDraft, 10);
                if (!Number.isNaN(n) && n > 0) setDailyGoal(n);
              }}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 22 }}>🔥</Text>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <Text style={[styles.cardLabel, { color: c.text }]}>
                {currentStreak} day{currentStreak === 1 ? "" : "s"} streak
              </Text>
              <Text style={[styles.cardSub, { color: c.mutedText }]}>
                Best: {longestStreak} day{longestStreak === 1 ? "" : "s"} —
                keep writing daily to grow your streak!
              </Text>
            </View>
          </View>
        </View>
      </Section>

      {/* ── 6. Help & About ── */}
      <Section
        label="Help & About"
        description="Learn how to use Scribe or find out more about the app."
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <ActionBtn
            icon="book-open"
            label="How to use Scribe — in-app guide"
            primary
            onPress={() => router.push("/guide")}
          />
          <View style={{ height: 8 }} />
          <ActionBtn
            icon="info"
            label="About Scribe"
            onPress={() => router.push("/about")}
          />
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
      <Text
        style={{
          color: c.mutedText,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: description ? 4 : 8,
          paddingHorizontal: 4,
        }}
      >
        {label}
      </Text>
      {description ? (
        <Text
          style={{
            color: c.mutedText,
            fontSize: 12,
            lineHeight: 17,
            paddingHorizontal: 4,
            marginBottom: 10,
          }}
        >
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: primary
            ? c.accent
            : pressed
              ? c.background
              : "transparent",
          borderColor: primary ? c.accent : c.border,
        },
      ]}
    >
      <Feather
        name={icon}
        size={15}
        color={primary ? c.toolbar : c.text}
      />
      <Text
        style={{
          color: primary ? c.toolbar : c.text,
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  themeSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  themeSwatchInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
});
