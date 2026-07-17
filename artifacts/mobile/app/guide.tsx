import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

type Section = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  items: string[];
};

const GUIDE_SECTIONS: Section[] = [
  {
    icon: "edit-3",
    title: "Writing & shortcuts",
    items: [
      "Tap anywhere on the editor to start writing. Scribe autosaves every few seconds.",
      "The shortcut bar above the keyboard gives quick access to Markdown formatting: bold, italic, code, headings, and more.",
      'Type ", (, [, {, or \' and Scribe inserts the closing character automatically.',
      "Press Enter while the cursor sits just before a closing bracket or quote and the cursor jumps past it — no need to tap.",
      "Open the menu → Shortcuts to add, remove, or reorder shortcut-bar buttons.",
      "Enable Typewriter mode (Settings → Writing & Editor) to keep your current line centered as you type.",
    ],
  },
  {
    icon: "folder",
    title: "Files & folders",
    items: [
      "Scribe stores notes in its built-in vault by default. Notes are saved locally on your device and never leave the app.",
      "Create folders from the file panel to organise your writing into projects, journals, or drafts.",
      "On Android you can connect a folder from your phone's storage: Settings → Storage & Folders → Connect a folder. Scribe reads and writes .txt and .md files directly.",
      "Tap Refresh to pick up changes made outside Scribe; tap Disconnect to go back to the built-in vault (your phone files stay where they are).",
      "In the file panel, use Tree view for nested folders, List view for a flat view of every note, or Folders view for a visual grid with cover images.",
    ],
  },
  {
    icon: "copy",
    title: "Pinning & floating windows",
    items: [
      "Long-press any note in the file panel to see the action menu.",
      'Choose "Pin top" or "Pin bottom" to dock a note as a read-only reference in the side panel — great for keeping an outline visible while you write.',
      'Choose "Float" to open the note in a draggable, resizable overlay window on top of the editor.',
      "You can have one floating window open at a time. Drag its title bar to reposition it; drag the bottom-right corner to resize.",
      "Swipe in from the right edge of the screen to open or close the side panel.",
    ],
  },
  {
    icon: "layers",
    title: "Projects (chapter-wise & scene-wise)",
    items: [
      "Projects are a structured way to manage long-form writing like novels, screenplays, or research reports.",
      "Chapter-wise projects: each chapter is a single file. Open a chapter to write it directly.",
      "Scene-wise projects: each chapter contains multiple scene files. This suits writers who draft scenes out of order and assemble them later.",
      "Long-press a chapter or scene card to pin it to the side panel or open it in a floating window.",
      "Access projects from the left panel (tap the Layers icon or swipe from the left edge).",
    ],
  },
  {
    icon: "users",
    title: "Characters & locations",
    items: [
      "Open the menu → Characters & Locations to create and manage character profiles and place descriptions.",
      "Each entry has a name, description, tags, and an optional image.",
      "Use tags to group related characters or locations (e.g. 'antagonist', 'chapter-3').",
      "Tap a card to see the full detail view; tap Edit to update it.",
      "Long-press a card to pin it to the side panel or open it as a floating reference window.",
    ],
  },
  {
    icon: "droplet",
    title: "Themes",
    items: [
      "Scribe ships with five built-in themes: Default, Dark, Sepia, Forest, and Ocean.",
      "Go to Settings → Appearance & Theme to switch themes instantly.",
      "Tap 'Open theme editor' to fully customise colours, fonts, line spacing, padding, and background.",
      "You can save your own custom themes and switch between them.",
      "Font size and line spacing can also be adjusted independently in Settings → Writing & Editor.",
    ],
  },
  {
    icon: "clock",
    title: "Version history",
    items: [
      "Scribe automatically saves a snapshot of your note every few minutes while you edit.",
      "Open the menu → Version History to browse all saved snapshots for the current note.",
      "Tap any snapshot card to preview its full content before restoring.",
      "The latest (most recent) snapshot is highlighted at the top.",
      "Tap 'Restore this version' on any snapshot to replace the current note content with that version. You will be asked to confirm before anything is changed.",
    ],
  },
];

export default function GuideScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 22, paddingBottom: 60, gap: 20 }}
    >
      <View style={{ alignItems: "center", marginTop: 4, marginBottom: 8 }}>
        <View
          style={[
            styles.logo,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Feather name="book-open" size={32} color={c.accent} />
        </View>
        <Text style={[styles.heading, { color: c.text }]}>
          How to use Scribe
        </Text>
        <Text style={[styles.subheading, { color: c.mutedText }]}>
          A quick guide to everything inside the app
        </Text>
      </View>

      {GUIDE_SECTIONS.map((section) => (
        <View key={section.title}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Feather name={section.icon} size={16} color={c.accent} />
            </View>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {section.title}
            </Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {section.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View
                  style={[styles.bullet, { backgroundColor: c.accent }]}
                />
                <Text style={[styles.itemText, { color: c.text }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={[styles.footer, { color: c.mutedText }]}>
        Your writing, on your device. Always.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subheading: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
});
