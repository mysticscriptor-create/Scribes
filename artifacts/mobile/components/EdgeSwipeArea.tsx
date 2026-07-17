import React from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { usePanels } from "@/contexts/PanelsContext";

type Edge = "left" | "right";

type EdgeSwipeAreaProps = {
  edge: Edge;
  edgeWidth?: number;
  threshold?: number;
  // Vertical insets so this strip never overlaps floating chrome that lives
  // in the corners of the editor (the preview toggle top-right, the word
  // count widget bottom-right) — those must stay tappable.
  topInset?: number;
  bottomInset?: number;
};

// A true "edge swipe to open" zone. Kept intentionally slim (a fixed pixel
// width, not a fraction of the screen) so it only claims the outermost
// sliver — wide enough to reliably catch a thumb starting a swipe, but
// narrow enough that it never shadows buttons, the shortcut bar, or the
// editor's own vertical scrolling, all of which live just inside it.
//
// Built on react-native-gesture-handler (not the plain PanResponder used
// previously): a PanResponder-backed sibling View sitting on top of other
// content intercepts the *initial* touch for anything under it — even taps
// it never ends up claiming — because plain RN responder negotiation only
// walks back up the original hit-tested view's own ancestors, never sideways
// to a sibling. That silently ate taps/scrolls under the old wide (35%-of
// -screen) zone. Gesture Handler's native recognizers coexist properly with
// sibling touchables instead of pre-empting them.
//
// It only renders while BOTH drawers are closed. Once a drawer is open,
// dismissing it is handled by a dedicated swipe-to-close gesture on the
// drawer itself (see Menu.tsx / SidePanel.tsx) so the two gestures never
// compete for the same touch, and this strip can't sit on top of (and block)
// the open drawer's own scrim, close button, or content.
const DEFAULT_EDGE_WIDTH = 28;

export function EdgeSwipeArea({
  edge,
  edgeWidth = DEFAULT_EDGE_WIDTH,
  threshold = 50,
  topInset = 0,
  bottomInset = 0,
}: EdgeSwipeAreaProps) {
  const { rightPanelOpen, leftMenuOpen, setRightPanelOpen, setLeftMenuOpen } =
    usePanels();

  if (rightPanelOpen || leftMenuOpen) return null;

  const pan = Gesture.Pan()
    .activeOffsetX(edge === "right" ? [-12, 1000] : [-1000, 12])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      "worklet";
      if (edge === "right" && e.translationX < -threshold) {
        runOnJS(setRightPanelOpen)(true);
      }
      if (edge === "left" && e.translationX > threshold) {
        runOnJS(setLeftMenuOpen)(true);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[
          styles.area,
          edge === "right" ? { right: 0 } : { left: 0 },
          { width: edgeWidth, top: topInset, bottom: bottomInset },
        ]}
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  area: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
