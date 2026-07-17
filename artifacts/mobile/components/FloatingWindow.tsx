import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MarkdownView } from "@/components/MarkdownView";
import { useNotes } from "@/contexts/NotesContext";
import { usePanels, type FloatingWindow as FW } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

const MIN_WIDTH = 220;
const MIN_HEIGHT = 56;

type FloatingWindowsProps = {
  containerWidth: number;
  containerHeight: number;
};

export function FloatingWindowsLayer({
  containerWidth,
  containerHeight,
}: FloatingWindowsProps) {
  const { floatingWindows } = usePanels();
  return (
    <>
      {floatingWindows.map((w) => (
        <SingleWindow
          key={w.id}
          win={w}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}
    </>
  );
}

function SingleWindow({
  win,
  containerWidth,
  containerHeight,
}: {
  win: FW;
  containerWidth: number;
  containerHeight: number;
}) {
  const { activeTheme } = useTheme();
  const { notes } = useNotes();
  const { closeFloating, updateFloating, bringToFront } = usePanels();
  const c = activeTheme.colors;
  const note = notes.find((n) => n.id === win.noteId);

  const pos = useRef({ x: win.x, y: win.y }).current;
  const size = useRef({ width: win.width, height: win.height }).current;

  const translate = useRef(
    new Animated.ValueXY({ x: win.x, y: win.y }),
  ).current;
  const dim = useRef({
    width: new Animated.Value(win.width),
    height: new Animated.Value(win.collapsed ? MIN_HEIGHT : win.height),
  }).current;

  // Keep animated dims in sync if win.collapsed changes externally
  React.useEffect(() => {
    Animated.timing(dim.height, {
      toValue: win.collapsed ? MIN_HEIGHT : size.height,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [win.collapsed, dim.height, size.height]);

  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        bringToFront(win.id);
      },
      onPanResponderMove: (_, g) => {
        const screenW = containerWidth || Dimensions.get("window").width;
        const screenH = containerHeight || Dimensions.get("window").height;
        const nx = Math.max(
          -size.width + 80,
          Math.min(screenW - 60, pos.x + g.dx),
        );
        const ny = Math.max(0, Math.min(screenH - 60, pos.y + g.dy));
        translate.setValue({ x: nx, y: ny });
      },
      onPanResponderRelease: (_, g) => {
        const screenW = containerWidth || Dimensions.get("window").width;
        const screenH = containerHeight || Dimensions.get("window").height;
        pos.x = Math.max(
          -size.width + 80,
          Math.min(screenW - 60, pos.x + g.dx),
        );
        pos.y = Math.max(0, Math.min(screenH - 60, pos.y + g.dy));
        translate.setValue({ x: pos.x, y: pos.y });
        updateFloating(win.id, { x: pos.x, y: pos.y });
      },
    }),
  ).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        bringToFront(win.id);
      },
      onPanResponderMove: (_, g) => {
        const newW = Math.max(MIN_WIDTH, size.width + g.dx);
        const newH = Math.max(160, size.height + g.dy);
        dim.width.setValue(newW);
        dim.height.setValue(newH);
      },
      onPanResponderRelease: (_, g) => {
        size.width = Math.max(MIN_WIDTH, size.width + g.dx);
        size.height = Math.max(160, size.height + g.dy);
        dim.width.setValue(size.width);
        dim.height.setValue(size.height);
        updateFloating(win.id, { width: size.width, height: size.height });
      },
    }),
  ).current;

  if (!note) return null;

  const handleToggleCollapse = () => {
    bringToFront(win.id);
    updateFloating(win.id, { collapsed: !win.collapsed });
  };

  const handleClose = () => closeFloating(win.id);

  return (
    <Animated.View
      style={[
        styles.window,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          shadowColor: "#000",
          width: dim.width,
          height: dim.height,
          transform: translate.getTranslateTransform(),
          zIndex: win.z,
        },
      ]}
    >
      <View
        style={[
          styles.titleBar,
          { borderBottomColor: c.border, backgroundColor: c.toolbar },
        ]}
      >
        {/* Drag area: only the move icon + title text capture pan gestures */}
        <View
          {...dragResponder.panHandlers}
          style={styles.dragArea}
          collapsable={false}
        >
          <Feather name="move" size={12} color={c.mutedText} />
          <Text
            style={[styles.title, { color: c.toolbarText }]}
            numberOfLines={1}
          >
            {note.name}
          </Text>
        </View>
        {/* Buttons live OUTSIDE the drag responder so taps register cleanly */}
        <Pressable
          onPress={handleToggleCollapse}
          hitSlop={10}
          style={({ pressed }) => [
            styles.titleBtn,
            { backgroundColor: pressed ? c.background : "transparent" },
          ]}
        >
          <Feather
            name={win.collapsed ? "maximize-2" : "minimize-2"}
            size={14}
            color={c.text}
          />
        </Pressable>
        <Pressable
          onPress={handleClose}
          hitSlop={10}
          style={({ pressed }) => [
            styles.titleBtn,
            { backgroundColor: pressed ? c.background : "transparent" },
          ]}
        >
          <Feather name="x" size={15} color={c.text} />
        </Pressable>
      </View>

      {!win.collapsed ? (
        <>
          <View style={{ flex: 1 }}>
            <MarkdownView
              source={note.content}
              theme={{
                ...activeTheme,
                fontSize: Math.max(13, activeTheme.fontSize - 3),
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />
          </View>
          <View
            {...resizeResponder.panHandlers}
            style={[styles.resizeHandle, { backgroundColor: c.border }]}
          >
            <View
              style={[styles.resizeDot, { backgroundColor: c.mutedText }]}
            />
            <View
              style={[styles.resizeDot, { backgroundColor: c.mutedText }]}
            />
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    elevation: 14,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  dragArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  titleBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  resizeHandle: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: 6,
    opacity: 0.7,
  },
  resizeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});
