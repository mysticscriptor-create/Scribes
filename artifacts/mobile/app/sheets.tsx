import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SheetImagePicker } from "@/components/SheetImagePicker";
import { SheetTagEditor } from "@/components/SheetTagEditor";
import {
  type Sheet,
  type SheetType,
  useCharacters,
} from "@/contexts/CharactersContext";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Utility ────────────────────────────────────────────────────────────────

function sheetMatchesQuery(s: Sheet, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (s.name.toLowerCase().includes(lower)) return true;
  if (s.summary.toLowerCase().includes(lower)) return true;
  if (s.tags?.some((t) => t.toLowerCase().includes(lower))) return true;
  return false;
}

// ─── Root screen ────────────────────────────────────────────────────────────

export default function SheetsScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const { sheets, createSheet, updateSheet, deleteSheet, duplicateSheet } =
    useCharacters();
  const params = useLocalSearchParams<{ open?: string }>();

  const [tab, setTab] = useState<SheetType>("character");
  const [openId, setOpenId] = useState<string | null>(params.open ?? null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(
    () =>
      sheets
        .filter((s) => s.type === tab && sheetMatchesQuery(s, search))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sheets, tab, search],
  );

  const openSheet = openId ? sheets.find((s) => s.id === openId) : null;

  // ── Long-press action sheet ──────────────────────────────────────────────
  const handleLongPress = (sheet: Sheet) => {
    const options = ["Edit", "Duplicate", "Delete", "Cancel"];
    const destructiveIdx = 2;
    const cancelIdx = 3;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIdx,
          cancelButtonIndex: cancelIdx,
          title: sheet.name,
        },
        (idx) => {
          if (idx === 0) setOpenId(sheet.id);
          else if (idx === 1) duplicateSheet(sheet.id);
          else if (idx === 2)
            Alert.alert("Delete", `Delete "${sheet.name}"?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteSheet(sheet.id),
              },
            ]);
        },
      );
    } else {
      Alert.alert(sheet.name, undefined, [
        { text: "Edit", onPress: () => setOpenId(sheet.id) },
        { text: "Duplicate", onPress: () => duplicateSheet(sheet.id) },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert("Delete", `Delete "${sheet.name}"?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteSheet(sheet.id),
              },
            ]),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  if (openSheet) {
    return (
      <SheetDetail
        sheet={openSheet}
        onBack={() => setOpenId(null)}
        onUpdate={(partial) => updateSheet(openSheet.id, partial)}
        onDelete={() => {
          deleteSheet(openSheet.id);
          setOpenId(null);
        }}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(["character", "location"] as SheetType[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              {
                borderColor: c.border,
                backgroundColor: tab === t ? c.accent : "transparent",
              },
            ]}
          >
            <Text
              style={{
                color: tab === t ? c.toolbar : c.text,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {t === "character" ? "Characters" : "Locations"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search / filter bar */}
      <View style={[styles.searchRow, { borderColor: c.border }]}>
        <Feather name="search" size={14} color={c.mutedText} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, summary, or tag…"
          placeholderTextColor={c.mutedText}
          style={[styles.searchInput, { color: c.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS !== "ios" && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={14} color={c.mutedText} />
          </Pressable>
        )}
      </View>

      {/* Card list */}
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather
              name={tab === "character" ? "user" : "map-pin"}
              size={30}
              color={c.mutedText}
            />
            <Text style={[styles.emptyText, { color: c.mutedText }]}>
              {search
                ? "No results. Try a different search."
                : `No ${tab === "character" ? "characters" : "locations"} yet. Tap + to add one.`}
            </Text>
          </View>
        ) : (
          filtered.map((s) => (
            <SheetCard
              key={s.id}
              sheet={s}
              onPress={() => setOpenId(s.id)}
              onLongPress={() => handleLongPress(s)}
            />
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        style={[styles.fab, { backgroundColor: c.accent }]}
      >
        <Feather name="plus" size={22} color={c.toolbar} />
      </Pressable>

      {/* Create modal */}
      <CreateSheetModal
        visible={showCreate}
        defaultType={tab}
        onClose={() => setShowCreate(false)}
        onCreate={(type, name) => {
          const s = createSheet(type, name);
          setShowCreate(false);
          setOpenId(s.id);
        }}
      />
    </View>
  );
}

// ─── Sheet Card ──────────────────────────────────────────────────────────────

function SheetCard({
  sheet,
  onPress,
  onLongPress,
}: {
  sheet: Sheet;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardRow}>
        {/* Thumbnail */}
        {sheet.imageUri ? (
          <Image
            source={{ uri: sheet.imageUri }}
            style={[styles.cardThumb, { borderColor: c.border }]}
          />
        ) : (
          <View
            style={[
              styles.cardThumbPlaceholder,
              { backgroundColor: c.background, borderColor: c.border },
            ]}
          >
            <Feather
              name={sheet.type === "character" ? "user" : "map-pin"}
              size={16}
              color={c.mutedText}
            />
          </View>
        )}

        {/* Text content */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardName, { color: c.text }]}>{sheet.name}</Text>
          {sheet.summary ? (
            <Text
              style={[styles.cardSummary, { color: c.mutedText }]}
              numberOfLines={2}
            >
              {sheet.summary}
            </Text>
          ) : null}
          {sheet.tags && sheet.tags.length > 0 ? (
            <View style={styles.cardTags}>
              {sheet.tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  style={[styles.cardTag, { backgroundColor: c.background, borderColor: c.border }]}
                >
                  <Text style={[styles.cardTagText, { color: c.mutedText }]}>
                    {tag}
                  </Text>
                </View>
              ))}
              {sheet.tags.length > 3 && (
                <Text style={[styles.cardTagText, { color: c.mutedText }]}>
                  +{sheet.tags.length - 3}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Create Modal ────────────────────────────────────────────────────────────

function CreateSheetModal({
  visible,
  defaultType,
  onClose,
  onCreate,
}: {
  visible: boolean;
  defaultType: SheetType;
  onClose: () => void;
  onCreate: (type: SheetType, name: string) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [type, setType] = useState<SheetType>(defaultType);
  const [name, setName] = useState("");
  const inputRef = useRef<TextInput>(null);

  // Reset when opening
  React.useEffect(() => {
    if (visible) {
      setType(defaultType);
      setName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, defaultType]);

  const submit = () => {
    onCreate(type, name.trim());
    setName("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.modalTitle, { color: c.text }]}>New sheet</Text>

          {/* Type picker */}
          <View style={styles.modalTabs}>
            {(["character", "location"] as SheetType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[
                  styles.modalTab,
                  {
                    borderColor: c.border,
                    backgroundColor: type === t ? c.accent : "transparent",
                  },
                ]}
              >
                <Feather
                  name={t === "character" ? "user" : "map-pin"}
                  size={13}
                  color={type === t ? c.toolbar : c.mutedText}
                />
                <Text
                  style={{
                    color: type === t ? c.toolbar : c.text,
                    fontWeight: "600",
                    fontSize: 13,
                    marginLeft: 4,
                  }}
                >
                  {t === "character" ? "Character" : "Location"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Name input */}
          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            returnKeyType="done"
            placeholder={type === "character" ? "Character name…" : "Location name…"}
            placeholderTextColor={c.mutedText}
            style={[styles.modalInput, { color: c.text, borderColor: c.border }]}
          />

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalBtn, { borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}
            >
              <Text style={[styles.modalBtnText, { color: c.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={[styles.modalBtn, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.modalBtnText, { color: c.toolbar }]}>Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Sheet Detail ────────────────────────────────────────────────────────────

function SheetDetail({
  sheet,
  onBack,
  onUpdate,
  onDelete,
}: {
  sheet: Sheet;
  onBack: () => void;
  onUpdate: (partial: Partial<Sheet>) => void;
  onDelete: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [editMode, setEditMode] = useState(false);

  // Draft state — only committed on Save
  const [draftName, setDraftName] = useState(sheet.name);
  const [draftSummary, setDraftSummary] = useState(sheet.summary);
  const [draftFields, setDraftFields] = useState(sheet.fields);
  const [draftTags, setDraftTags] = useState<string[]>(sheet.tags ?? []);
  const [draftImage, setDraftImage] = useState<string | undefined>(sheet.imageUri);

  // Sync draft from live sheet when not editing (e.g., external update)
  React.useEffect(() => {
    if (!editMode) {
      setDraftName(sheet.name);
      setDraftSummary(sheet.summary);
      setDraftFields(sheet.fields);
      setDraftTags(sheet.tags ?? []);
      setDraftImage(sheet.imageUri);
    }
  }, [sheet, editMode]);

  const enterEdit = () => {
    // Reset draft from current sheet
    setDraftName(sheet.name);
    setDraftSummary(sheet.summary);
    setDraftFields(sheet.fields);
    setDraftTags(sheet.tags ?? []);
    setDraftImage(sheet.imageUri);
    setEditMode(true);
  };

  const save = () => {
    onUpdate({
      name: draftName.trim() || sheet.name,
      summary: draftSummary,
      fields: draftFields,
      tags: draftTags,
      imageUri: draftImage,
    });
    setEditMode(false);
  };

  const cancel = () => {
    // Discard draft — reset to live values
    setDraftName(sheet.name);
    setDraftSummary(sheet.summary);
    setDraftFields(sheet.fields);
    setDraftTags(sheet.tags ?? []);
    setDraftImage(sheet.imageUri);
    setEditMode(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.detailHeader, { borderColor: c.border }]}>
        <Pressable
          onPress={() => {
            if (editMode) {
              // Auto-save as safety net on back
              save();
            }
            onBack();
          }}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color={c.text} />
        </Pressable>
        <Text style={[styles.detailTitle, { color: c.text }]}>
          {sheet.type === "character" ? "Character" : "Location"}
        </Text>
        {editMode ? (
          <View style={styles.headerActions}>
            <Pressable onPress={cancel} hitSlop={8} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: c.mutedText }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              hitSlop={8}
              style={[styles.headerBtn, styles.saveBtn, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.headerBtnText, { color: c.toolbar }]}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <Pressable onPress={enterEdit} hitSlop={8} style={styles.headerBtn}>
              <Feather name="edit-2" size={17} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Delete", `Delete "${sheet.name}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: onDelete },
                ])
              }
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Feather name="trash-2" size={17} color={c.text} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Content */}
      {editMode ? (
        <EditView
          draftName={draftName}
          draftSummary={draftSummary}
          draftFields={draftFields}
          draftTags={draftTags}
          draftImage={draftImage}
          setDraftName={setDraftName}
          setDraftSummary={setDraftSummary}
          setDraftFields={setDraftFields}
          setDraftTags={setDraftTags}
          setDraftImage={setDraftImage}
        />
      ) : (
        <ReadView sheet={sheet} onEdit={enterEdit} />
      )}
    </View>
  );
}

// ─── Read View ───────────────────────────────────────────────────────────────

function ReadView({ sheet, onEdit }: { sheet: Sheet; onEdit: () => void }) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
      {/* Image */}
      <View style={styles.readImageRow}>
        <SheetImagePicker
          imageUri={sheet.imageUri}
          onImage={() => {}}
          editable={false}
        />
      </View>

      {/* Name */}
      <View style={styles.readSection}>
        <Text style={[styles.readName, { color: c.text }]}>{sheet.name}</Text>
      </View>

      {/* Tags */}
      {sheet.tags && sheet.tags.length > 0 && (
        <View style={styles.readTagRow}>
          {sheet.tags.map((tag) => (
            <View
              key={tag}
              style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Text style={[styles.chipText, { color: c.text }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Summary */}
      {sheet.summary ? (
        <View style={styles.readSection}>
          <Text style={[styles.readLabel, { color: c.mutedText }]}>Summary</Text>
          <Text style={[styles.readValue, { color: c.text }]}>{sheet.summary}</Text>
        </View>
      ) : null}

      {/* Fields */}
      {sheet.fields.map((f) =>
        f.value ? (
          <View key={f.label} style={styles.readSection}>
            <Text style={[styles.readLabel, { color: c.mutedText }]}>{f.label}</Text>
            <Text style={[styles.readValue, { color: c.text }]}>{f.value}</Text>
          </View>
        ) : null,
      )}

      {/* Edit button */}
      <Pressable
        onPress={onEdit}
        style={[styles.editFab, { backgroundColor: c.accent }]}
      >
        <Feather name="edit-2" size={16} color={c.toolbar} />
        <Text style={[styles.editFabText, { color: c.toolbar }]}>Edit</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Edit View ───────────────────────────────────────────────────────────────

function EditView({
  draftName,
  draftSummary,
  draftFields,
  draftTags,
  draftImage,
  setDraftName,
  setDraftSummary,
  setDraftFields,
  setDraftTags,
  setDraftImage,
}: {
  draftName: string;
  draftSummary: string;
  draftFields: Sheet["fields"];
  draftTags: string[];
  draftImage: string | undefined;
  setDraftName: (v: string) => void;
  setDraftSummary: (v: string) => void;
  setDraftFields: React.Dispatch<React.SetStateAction<Sheet["fields"]>>;
  setDraftTags: (v: string[]) => void;
  setDraftImage: (v: string | undefined) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      {/* Image picker */}
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <SheetImagePicker
          imageUri={draftImage}
          onImage={setDraftImage}
          editable
        />
      </View>

      {/* Name */}
      <View>
        <Text style={[styles.label, { color: c.mutedText }]}>Name</Text>
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          style={[styles.input, { color: c.text, borderColor: c.border }]}
        />
      </View>

      {/* Summary */}
      <View>
        <Text style={[styles.label, { color: c.mutedText }]}>Summary</Text>
        <TextInput
          value={draftSummary}
          onChangeText={setDraftSummary}
          multiline
          style={[styles.input, styles.multiline, { color: c.text, borderColor: c.border }]}
        />
      </View>

      {/* Tags */}
      <View>
        <Text style={[styles.label, { color: c.mutedText }]}>Tags</Text>
        <SheetTagEditor tags={draftTags} onChange={setDraftTags} editable />
      </View>

      {/* Template fields */}
      {draftFields.map((f, i) => (
        <View key={f.label}>
          <Text style={[styles.label, { color: c.mutedText }]}>{f.label}</Text>
          <TextInput
            value={f.value}
            onChangeText={(v) =>
              setDraftFields((prev) =>
                prev.map((pf, idx) => (idx === i ? { ...pf, value: v } : pf)),
              )
            }
            multiline
            style={[styles.input, styles.multiline, { color: c.text, borderColor: c.border }]}
          />
        </View>
      ))}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // List / tabs
  tabs: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },

  // Card
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  cardThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSummary: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  cardTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTagText: {
    fontSize: 10,
    fontWeight: "500",
  },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },

  // Create modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: 300,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  modalTabs: {
    flexDirection: "row",
    gap: 8,
  },
  modalTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Detail header
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saveBtn: {
    paddingHorizontal: 12,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Read view
  readImageRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  readSection: {
    gap: 4,
  },
  readName: {
    fontSize: 22,
    fontWeight: "700",
  },
  readLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  readValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  readTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  // Edit view
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },

  // Chip (read tag)
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

  // Edit FAB in read view
  editFab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  editFabText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
