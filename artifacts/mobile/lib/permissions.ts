import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

// Shared just-in-time permission helper for photo library access.
//
// The bug this fixes: both call sites used to call
// requestMediaLibraryPermissionsAsync() and, on anything other than
// "granted", show a plain "Permission needed" alert with no way forward.
// Android only shows the OS permission dialog the *first* time a permission
// is requested (or while canAskAgain is still true) -- once a user denies
// it once (including an accidental tap), canAskAgain flips to false and
// every subsequent call silently resolves to "denied" with no dialog at
// all. From the user's side that reads as "the app never asks for
// permission" and the only way to actually grant it is to find Scribe in
// the OS app settings manually, which is exactly what was reported.
//
// This helper checks the current status first, only calls the OS request
// (which can prompt) while it's still allowed to, and falls back to a
// direct "Open Settings" deep link once Android has stopped offering its
// own dialog -- so the user always has an in-app path to grant access
// instead of having to go hunting for it themselves.
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.status === "granted") return true;

  if (current.canAskAgain) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requested.status === "granted") return true;
    if (requested.canAskAgain) {
      // User dismissed/denied but can still be asked again later -- a
      // plain heads-up is enough, no need to send them to Settings yet.
      Alert.alert("Permission needed", "Allow photo access to continue.");
      return false;
    }
  }

  offerOpenSettings(
    "Photo access needed",
    "Scribe needs permission to access your photos. Grant it in Settings, then try again.",
  );
  return false;
}

function offerOpenSettings(title: string, message: string) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Open Settings", onPress: () => Linking.openSettings() },
  ]);
}
