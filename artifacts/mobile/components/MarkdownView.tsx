import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { Theme } from "@/constants/defaultThemes";
import { FONT_FAMILY_MAP } from "@/constants/defaultThemes";
import {
  type Block,
  type InlineSpan,
  parseMarkdown,
} from "@/lib/markdown";

type MarkdownViewProps = {
  source: string;
  theme: Theme;
};

function renderInline(spans: InlineSpan[], theme: Theme, baseSize: number) {
  return spans.map((span, idx) => {
    if (span.type === "bold") {
      return (
        <Text
          key={idx}
          style={{
            color: theme.colors.text,
            fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
            fontSize: baseSize,
            fontWeight: "700",
          }}
        >
          {span.text}
        </Text>
      );
    }
    if (span.type === "italic") {
      return (
        <Text
          key={idx}
          style={{
            color: theme.colors.text,
            fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
            fontSize: baseSize,
            fontStyle: "italic",
          }}
        >
          {span.text}
        </Text>
      );
    }
    if (span.type === "code") {
      return (
        <Text
          key={idx}
          style={{
            color: theme.colors.accent,
            fontFamily: FONT_FAMILY_MAP.mono,
            fontSize: baseSize - 1,
            backgroundColor: theme.colors.surface,
          }}
        >
          {" "}{span.text}{" "}
        </Text>
      );
    }
    if (span.type === "link") {
      return (
        <Text
          key={idx}
          style={{
            color: theme.colors.accent,
            fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
            fontSize: baseSize,
            textDecorationLine: "underline",
          }}
        >
          {span.text}
        </Text>
      );
    }
    return (
      <Text
        key={idx}
        style={{
          color: theme.colors.text,
          fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
          fontSize: baseSize,
        }}
      >
        {span.text}
      </Text>
    );
  });
}

function BlockRenderer({ block, theme }: { block: Block; theme: Theme }) {
  const baseSize = theme.fontSize;
  const spacing = theme.paragraphSpacing;
  if (block.type === "h1") {
    return (
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
          fontSize: baseSize * 1.85,
          fontWeight: "700",
          letterSpacing: theme.letterSpacing,
          marginTop: spacing * 1.4,
          marginBottom: spacing * 0.8,
          lineHeight: baseSize * 1.85 * 1.25,
        }}
      >
        {block.spans.map((s) => s.type === "text" ? s.text : (s as { text: string }).text).join("")}
      </Text>
    );
  }
  if (block.type === "h2") {
    return (
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
          fontSize: baseSize * 1.45,
          fontWeight: "700",
          marginTop: spacing * 1.2,
          marginBottom: spacing * 0.6,
          lineHeight: baseSize * 1.45 * 1.3,
        }}
      >
        {block.spans.map((s) => s.type === "text" ? s.text : (s as { text: string }).text).join("")}
      </Text>
    );
  }
  if (block.type === "h3") {
    return (
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
          fontSize: baseSize * 1.2,
          fontWeight: "600",
          marginTop: spacing,
          marginBottom: spacing * 0.5,
          lineHeight: baseSize * 1.2 * 1.35,
        }}
      >
        {block.spans.map((s) => s.type === "text" ? s.text : (s as { text: string }).text).join("")}
      </Text>
    );
  }
  if (block.type === "h4") {
    return (
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
          fontSize: baseSize * 1.05,
          fontWeight: "600",
          marginTop: spacing,
          marginBottom: spacing * 0.4,
        }}
      >
        {block.spans.map((s) => s.type === "text" ? s.text : (s as { text: string }).text).join("")}
      </Text>
    );
  }
  if (block.type === "paragraph") {
    return (
      <Text
        style={{
          marginBottom: spacing,
          lineHeight: baseSize * theme.lineHeight,
          letterSpacing: theme.letterSpacing,
        }}
      >
        {renderInline(block.spans, theme, baseSize)}
      </Text>
    );
  }
  if (block.type === "quote") {
    return (
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.accent,
          paddingLeft: 14,
          marginVertical: spacing * 0.8,
        }}
      >
        <Text
          style={{
            color: theme.colors.mutedText,
            fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
            fontSize: baseSize,
            fontStyle: "italic",
            lineHeight: baseSize * theme.lineHeight,
          }}
        >
          {renderInline(block.spans, theme, baseSize)}
        </Text>
      </View>
    );
  }
  if (block.type === "code") {
    return (
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
          padding: 12,
          marginVertical: spacing * 0.8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: FONT_FAMILY_MAP.mono,
            fontSize: baseSize - 2,
            lineHeight: (baseSize - 2) * 1.55,
          }}
        >
          {block.text}
        </Text>
      </View>
    );
  }
  if (block.type === "list") {
    return (
      <View style={{ marginVertical: spacing * 0.4 }}>
        {block.items.map((item, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: "row",
              marginBottom: 4,
              paddingLeft: 4,
            }}
          >
            <Text
              style={{
                color: theme.colors.accent,
                fontFamily: FONT_FAMILY_MAP[theme.fontFamily],
                fontSize: baseSize,
                width: 22,
                lineHeight: baseSize * theme.lineHeight,
              }}
            >
              {block.ordered ? `${idx + 1}.` : "•"}
            </Text>
            <Text
              style={{
                flex: 1,
                lineHeight: baseSize * theme.lineHeight,
              }}
            >
              {renderInline(item, theme, baseSize)}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "hr") {
    return (
      <View
        style={{
          height: 1,
          backgroundColor: theme.colors.border,
          marginVertical: spacing * 1.2,
        }}
      />
    );
  }
  return <View style={{ height: spacing * 0.4 }} />;
}

export function MarkdownView({ source, theme }: MarkdownViewProps) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingHorizontal: theme.paddingHorizontal,
        paddingVertical: theme.paddingVertical,
      }}
      showsVerticalScrollIndicator={false}
    >
      {blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} theme={theme} />
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
