import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type FindMatch = { start: number; end: number };

type Props = {
  content: string;
  onClose: () => void;
  onJump: (match: FindMatch) => void;
  onReplaceOne: (match: FindMatch, replacement: string) => void;
  onReplaceAll: (query: string, replacement: string, caseSensitive: boolean) => number;
};

export function FindReplaceBar({
  content,
  onClose,
  onJump,
  onReplaceOne,
  onReplaceAll,
}: Props) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showReplace, setShowReplace] = useState(false);

  const matches = useMemo<FindMatch[]>(() => {
    if (!query) return [];
    const flags = "g" + (caseSensitive ? "" : "i");
    let re: RegExp;
    try {
      re = new RegExp(escapeRe(query), flags);
    } catch {
      return [];
    }
    const out: FindMatch[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      out.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }, [content, query, caseSensitive]);

  const clampedIdx = matches.length ? activeIdx % matches.length : 0;

  const goTo = (idx: number) => {
    if (matches.length === 0) return;
    const next = ((idx % matches.length) + matches.length) % matches.length;
    setActiveIdx(next);
    onJump(matches[next]!);
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.row}>
        <Feather name="search" size={14} color={c.mutedText} />
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setActiveIdx(0);
          }}
          placeholder="Find…"
          placeholderTextColor={c.mutedText}
          style={[styles.input, { color: c.text }]}
          autoFocus
        />
        <Text style={[styles.count, { color: c.mutedText }]}>
          {matches.length > 0 ? `${clampedIdx + 1}/${matches.length}` : "0/0"}
        </Text>
        <Pressable onPress={() => setCaseSensitive((v) => !v)} hitSlop={8}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: caseSensitive ? c.accent : c.mutedText,
            }}
          >
            Aa
          </Text>
        </Pressable>
        <Pressable onPress={() => goTo(clampedIdx - 1)} hitSlop={8}>
          <Feather name="chevron-up" size={16} color={c.text} />
        </Pressable>
        <Pressable onPress={() => goTo(clampedIdx + 1)} hitSlop={8}>
          <Feather name="chevron-down" size={16} color={c.text} />
        </Pressable>
        <Pressable onPress={() => setShowReplace((v) => !v)} hitSlop={8}>
          <Feather
            name="repeat"
            size={16}
            color={showReplace ? c.accent : c.text}
          />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={18} color={c.text} />
        </Pressable>
      </View>
      {showReplace ? (
        <View style={[styles.row, { paddingTop: 8 }]}>
          <Feather name="repeat" size={14} color={c.mutedText} />
          <TextInput
            value={replacement}
            onChangeText={setReplacement}
            placeholder="Replace with…"
            placeholderTextColor={c.mutedText}
            style={[styles.input, { color: c.text }]}
          />
          <Pressable
            disabled={matches.length === 0}
            onPress={() => {
              onReplaceOne(matches[clampedIdx]!, replacement);
            }}
            style={[
              styles.btn,
              { borderColor: c.border, opacity: matches.length ? 1 : 0.4 },
            ]}
          >
            <Text style={{ color: c.text, fontSize: 12 }}>Replace</Text>
          </Pressable>
          <Pressable
            disabled={matches.length === 0}
            onPress={() => {
              onReplaceAll(query, replacement, caseSensitive);
              setActiveIdx(0);
            }}
            style={[
              styles.btn,
              { borderColor: c.border, opacity: matches.length ? 1 : 0.4 },
            ]}
          >
            <Text style={{ color: c.text, fontSize: 12 }}>All</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  count: {
    fontSize: 11,
    minWidth: 34,
    textAlign: "center",
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
