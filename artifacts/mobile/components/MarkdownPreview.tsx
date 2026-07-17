import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type InlineToken = { text: string; bold?: boolean; italic?: boolean };

function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) tokens.push({ text: buf });
    buf = "";
  };
  while (i < line.length) {
    if (line.startsWith("***", i)) {
      const end = line.indexOf("***", i + 3);
      if (end !== -1) {
        flush();
        tokens.push({ text: line.slice(i + 3, end), bold: true, italic: true });
        i = end + 3;
        continue;
      }
    }
    if (line.startsWith("**", i)) {
      const end = line.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        tokens.push({ text: line.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "*" && line[i + 1] !== "*") {
      const end = line.indexOf("*", i + 1);
      if (end !== -1) {
        flush();
        tokens.push({ text: line.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    buf += line[i];
    i++;
  }
  flush();
  return tokens;
}

type Props = {
  content: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export function MarkdownPreview({
  content,
  textColor,
  mutedColor,
  accentColor,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
}: Props) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <View>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const key = `${idx}-${line.length}`;

        if (/^(---|\*\*\*)\s*$/.test(trimmed)) {
          return (
            <View
              key={key}
              style={[styles.hr, { borderBottomColor: mutedColor }]}
            />
          );
        }

        let headerLevel = 0;
        let body = line;
        const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line);
        if (headerMatch) {
          headerLevel = headerMatch[1].length;
          body = headerMatch[2];
        }

        let isQuote = false;
        if (/^>\s?/.test(line)) {
          isQuote = true;
          body = line.replace(/^>\s?/, "");
        }

        if (trimmed.length === 0) {
          return <View key={key} style={{ height: fontSize * lineHeight * 0.6 }} />;
        }

        const tokens = parseInline(body);

        const textStyle = {
          color: textColor,
          fontFamily,
          fontSize: headerLevel === 1 ? fontSize * 1.6 : headerLevel === 2 ? fontSize * 1.35 : headerLevel === 3 ? fontSize * 1.15 : fontSize,
          lineHeight: (headerLevel === 1 ? fontSize * 1.6 : headerLevel === 2 ? fontSize * 1.35 : headerLevel === 3 ? fontSize * 1.15 : fontSize) * lineHeight,
          letterSpacing,
          fontWeight: headerLevel > 0 ? ("700" as const) : ("400" as const),
        };

        const content = (
          <Text style={textStyle}>
            {tokens.map((t, tIdx) => (
              <Text
                key={tIdx}
                style={{
                  fontWeight: t.bold ? "700" : textStyle.fontWeight,
                  fontStyle: t.italic ? "italic" : "normal",
                }}
              >
                {t.text}
              </Text>
            ))}
          </Text>
        );

        if (isQuote) {
          return (
            <View
              key={key}
              style={[
                styles.quote,
                { borderLeftColor: accentColor, marginBottom: fontSize * 0.4 },
              ]}
            >
              {content}
            </View>
          );
        }

        return (
          <View key={key} style={{ marginBottom: fontSize * 0.35 }}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hr: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 2,
  },
});
