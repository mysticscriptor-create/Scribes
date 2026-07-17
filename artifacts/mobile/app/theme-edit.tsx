import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { IconButton } from "@/components/IconButton";
import { MarkdownView } from "@/components/MarkdownView";
import { ensureMediaLibraryPermission } from "@/lib/permissions";
import {
  FONT_FAMILY_GROUPS,
  FONT_FAMILY_LABELS,
  FONT_FAMILY_MAP,
  type FontFamilyKey,
  type Theme,
  type ThemeColors,
} from "@/constants/defaultThemes";
import { useTheme } from "@/contexts/ThemeContext";

const PREVIEW_MD = `# Preview heading

Crafting a theme is a private ritual. **Bold strokes**, *delicate italics*, and \`monospace\` punctuation all live together.

> "Choose colors that quiet the room."

- One thing at a time
- Two thoughts to keep
- Three lines for breath`;

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "mutedText", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "border", label: "Border" },
  { key: "selection", label: "Selection" },
  { key: "toolbar", label: "Toolbar" },
  { key: "toolbarText", label: "Toolbar text" },
];

export default function ThemeEditScreen() {
  const params = useLocalSearchParams<{ themeId?: string }>();
  const router = useRouter();
  const { themes, saveTheme, setActiveTheme } = useTheme();
  const initial = useMemo(
    () => themes.find((t) => t.id === params.themeId) ?? null,
    [themes, params.themeId],
  );
  const [draft, setDraft] = useState<Theme | null>(initial);

  if (!draft) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: "#666" }}>Theme not found.</Text>
      </View>
    );
  }

  if (draft.builtIn) {
    return (
      <View style={styles.empty}>
        <Feather name="lock" size={20} color="#999" />
        <Text style={{ color: "#666", textAlign: "center", maxWidth: 280 }}>
          Built-in themes can't be edited. Duplicate this theme from the
          Themes screen to create an editable copy.
        </Text>
        <IconButton
          icon="arrow-left"
          label="Back"
          onPress={() => router.back()}
          variant="outline"
        />
      </View>
    );
  }

  const c = draft.colors;
  const update = (partial: Partial<Theme>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));
  const updateColor = (key: keyof ThemeColors, value: string) =>
    setDraft((d) =>
      d ? { ...d, colors: { ...d.colors, [key]: value } } : d,
    );

  const handleSave = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      Alert.alert("Name required", "Please give the theme a name.");
      return;
    }
    saveTheme(draft);
    setActiveTheme(draft.id);
    router.back();
  };

  const handlePickBackgroundImage = async () => {
    const granted = await ensureMediaLibraryPermission();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      update({ backgroundImageUri: result.assets[0]!.uri });
    }
  };

  const handleRemoveBackgroundImage = () => {
    update({ backgroundImageUri: undefined, backgroundImageOpacity: undefined });
  };

  const bgOpacity = draft.backgroundImageOpacity ?? 0.3;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 80 }}
    >
      {/* Live Preview */}
      <View
        style={[
          styles.previewBox,
          { backgroundColor: c.background, borderColor: c.border },
        ]}
      >
        <View style={{ height: 220 }}>
          {draft.backgroundImageUri ? (
            <Image
              source={{ uri: draft.backgroundImageUri }}
              style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}
              resizeMode="cover"
            />
          ) : null}
          <MarkdownView source={PREVIEW_MD} theme={draft} />
        </View>
      </View>

      <SectionTitle color={c.text}>Identity</SectionTitle>
      <Field label="Name" textColor={c.text}>
        <TextInput
          value={draft.name}
          onChangeText={(v) => update({ name: v })}
          style={[
            styles.textInput,
            { color: c.text, borderColor: c.border, backgroundColor: c.surface },
          ]}
        />
      </Field>
      <Row>
        <Text style={{ color: c.text, flex: 1 }}>Dark mode</Text>
        <Switch
          value={draft.isDark}
          onValueChange={(v) => update({ isDark: v })}
        />
      </Row>

      {/* Background Image */}
      <SectionTitle color={c.text}>Background Image</SectionTitle>
      <View style={{ gap: 10 }}>
        {draft.backgroundImageUri ? (
          <View style={styles.bgImagePreviewRow}>
            <Image
              source={{ uri: draft.backgroundImageUri }}
              style={styles.bgImageThumb}
              resizeMode="cover"
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: c.mutedText, fontSize: 12 }}>
                Image selected
              </Text>
              <Pressable
                onPress={handlePickBackgroundImage}
                style={[
                  styles.bgImageBtn,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Feather name="image" size={14} color={c.text} />
                <Text style={{ color: c.text, fontSize: 13 }}>Replace</Text>
              </Pressable>
              <Pressable
                onPress={handleRemoveBackgroundImage}
                style={[
                  styles.bgImageBtn,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Feather name="trash-2" size={14} color={c.text} />
                <Text style={{ color: c.text, fontSize: 13 }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handlePickBackgroundImage}
            style={[
              styles.bgImagePickBtn,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Feather name="image" size={18} color={c.mutedText} />
            <Text style={{ color: c.mutedText, fontSize: 13 }}>
              Pick background image from library
            </Text>
          </Pressable>
        )}

        {draft.backgroundImageUri ? (
          <SteppedField
            label="Image opacity"
            value={Math.round(bgOpacity * 100)}
            unit="%"
            min={0}
            max={100}
            step={5}
            onChange={(v) => update({ backgroundImageOpacity: v / 100 })}
            textColor={c.text}
            accent={c.accent}
            surface={c.surface}
            border={c.border}
          />
        ) : null}
      </View>

      {/* Typography */}
      <SectionTitle color={c.text}>Typography</SectionTitle>
      <Field label="Font family" textColor={c.text}>
        <View style={{ gap: 10 }}>
          {FONT_FAMILY_GROUPS.map((group) => (
            <View key={group.label} style={{ gap: 6 }}>
              <Text style={{ color: c.mutedText, fontSize: 11, letterSpacing: 0.5 }}>
                {group.label}
              </Text>
              <View style={styles.choiceRow}>
                {group.keys.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => update({ fontFamily: k })}
                    style={[
                      styles.choice,
                      {
                        borderColor:
                          draft.fontFamily === k ? c.accent : c.border,
                        backgroundColor:
                          draft.fontFamily === k ? c.accent : c.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          draft.fontFamily === k ? c.background : c.text,
                        fontWeight: "600",
                        fontSize: 12,
                        fontFamily: FONT_FAMILY_MAP[k],
                      }}
                    >
                      {FONT_FAMILY_LABELS[k]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Field>
      <SteppedField
        label="Font size"
        value={draft.fontSize}
        unit="pt"
        min={12}
        max={28}
        step={1}
        onChange={(v) => update({ fontSize: v })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />
      <SteppedField
        label="Line height"
        value={draft.lineHeight}
        unit="x"
        min={1.2}
        max={2.4}
        step={0.05}
        onChange={(v) => update({ lineHeight: round(v, 2) })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />
      <SteppedField
        label="Letter spacing"
        value={draft.letterSpacing}
        unit="px"
        min={-1}
        max={2}
        step={0.1}
        onChange={(v) => update({ letterSpacing: round(v, 2) })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />
      <SteppedField
        label="Paragraph spacing"
        value={draft.paragraphSpacing}
        unit="px"
        min={4}
        max={32}
        step={1}
        onChange={(v) => update({ paragraphSpacing: v })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />

      <SectionTitle color={c.text}>Layout</SectionTitle>
      <SteppedField
        label="Side padding"
        value={draft.paddingHorizontal}
        unit="px"
        min={8}
        max={64}
        step={2}
        onChange={(v) => update({ paddingHorizontal: v })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />
      <SteppedField
        label="Vertical padding"
        value={draft.paddingVertical}
        unit="px"
        min={8}
        max={64}
        step={2}
        onChange={(v) => update({ paddingVertical: v })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />
      <SteppedField
        label="Max content width"
        value={draft.maxWidth}
        unit="px"
        min={320}
        max={900}
        step={20}
        onChange={(v) => update({ maxWidth: v })}
        textColor={c.text}
        accent={c.accent}
        surface={c.surface}
        border={c.border}
      />

      <SectionTitle color={c.text}>Colors</SectionTitle>
      {COLOR_FIELDS.map((cf) => (
        <ColorField
          key={cf.key}
          label={cf.label}
          value={draft.colors[cf.key]}
          onChange={(v) => updateColor(cf.key, v)}
          textColor={c.text}
          surface={c.surface}
          border={c.border}
        />
      ))}

      <View style={styles.actionsBar}>
        <IconButton
          icon="x"
          label="Cancel"
          variant="outline"
          onPress={() => router.back()}
        />
        <View style={{ flex: 1 }} />
        <IconButton
          icon="save"
          label="Save & apply"
          variant="solid"
          onPress={handleSave}
        />
      </View>
    </ScrollView>
  );
}

function SectionTitle({
  color,
  children,
}: {
  color: string;
  children: string;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginTop: 8,
        opacity: 0.7,
      }}
    >
      {children}
    </Text>
  );
}

function Field({
  label,
  children,
  textColor,
}: {
  label: string;
  children: React.ReactNode;
  textColor: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: textColor, fontSize: 13 }}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function SteppedField({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  textColor,
  accent,
  surface,
  border,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  textColor: string;
  accent: string;
  surface: string;
  border: string;
}) {
  const dec = () => onChange(Math.max(min, round(value - step, 2)));
  const inc = () => onChange(Math.min(max, round(value + step, 2)));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: textColor, flex: 1, fontSize: 13 }}>{label}</Text>
      <Pressable
        onPress={dec}
        style={[styles.stepBtn, { backgroundColor: surface, borderColor: border }]}
      >
        <Feather name="minus" size={14} color={textColor} />
      </Pressable>
      <Text
        style={{
          color: accent,
          minWidth: 64,
          textAlign: "center",
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {formatNumber(value)} {unit}
      </Text>
      <Pressable
        onPress={inc}
        style={[styles.stepBtn, { backgroundColor: surface, borderColor: border }]}
      >
        <Feather name="plus" size={14} color={textColor} />
      </Pressable>
    </View>
  );
}

function ColorField({
  label,
  value,
  onChange,
  textColor,
  surface,
  border,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textColor: string;
  surface: string;
  border: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: textColor, flex: 1, fontSize: 13 }}>{label}</Text>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: value,
          borderWidth: 1,
          borderColor: border,
        }}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{
          width: 110,
          height: 36,
          paddingHorizontal: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 8,
          color: textColor,
          borderColor: border,
          backgroundColor: surface,
          fontFamily: "JetBrainsMono_400Regular",
          fontSize: 13,
        }}
      />
    </View>
  );
}

function round(n: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function formatNumber(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  bgImagePickBtn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  bgImagePreviewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  bgImageThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  bgImageBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
});
