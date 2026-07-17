import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  editable?: boolean;
};

export function SheetTagEditor({ tags, onChange, editable = true }: Props) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {tags.map((tag) => (
          <View
            key={tag}
            style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.chipText, { color: c.text }]}>{tag}</Text>
            {editable && (
              <Pressable onPress={() => removeTag(tag)} hitSlop={6}>
                <Feather name="x" size={11} color={c.mutedText} />
              </Pressable>
            )}
          </View>
        ))}
        {tags.length === 0 && !editable && (
          <Text style={[styles.chipText, { color: c.mutedText }]}>No tags</Text>
        )}
      </ScrollView>
      {editable && (
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addTag}
            returnKeyType="done"
            placeholder="Add tag…"
            placeholderTextColor={c.mutedText}
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
          <Pressable
            onPress={addTag}
            style={[styles.addBtn, { backgroundColor: c.accent }]}
          >
            <Text style={[styles.addBtnText, { color: c.toolbar }]}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  chips: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    alignItems: "center",
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
