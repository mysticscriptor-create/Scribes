import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { ensureMediaLibraryPermission } from "@/lib/permissions";

type Props = {
  imageUri?: string;
  onImage: (uri: string | undefined) => void;
  editable?: boolean;
};

export function SheetImagePicker({ imageUri, onImage, editable = true }: Props) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  const pick = async () => {
    if (!editable) return;
    const granted = await ensureMediaLibraryPermission();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onImage(result.assets[0].uri);
    }
  };

  const remove = () => {
    Alert.alert("Remove image", "Remove the image from this sheet?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => onImage(undefined) },
    ]);
  };

  if (imageUri) {
    return (
      <View style={styles.container}>
        <Pressable onPress={pick} onLongPress={remove}>
          <Image source={{ uri: imageUri }} style={[styles.image, { borderColor: c.border }]} />
          {editable && (
            <View style={[styles.editBadge, { backgroundColor: c.accent }]}>
              <Feather name="camera" size={10} color={c.toolbar} />
            </View>
          )}
        </Pressable>
        <Text style={[styles.hint, { color: c.mutedText }]}>
          {editable ? "Tap to replace · Long-press to remove" : ""}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pick}
        style={[styles.placeholder, { borderColor: c.border, backgroundColor: c.surface }]}
        disabled={!editable}
      >
        <Feather name="camera" size={24} color={c.mutedText} />
        {editable && (
          <Text style={[styles.placeholderText, { color: c.mutedText }]}>Add photo</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: "600",
  },
  hint: {
    fontSize: 10,
    textAlign: "center",
  },
});
