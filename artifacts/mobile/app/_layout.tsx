import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CharactersProvider } from "@/contexts/CharactersContext";
import { NovelProjectsProvider } from "@/contexts/NovelProjectsContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { PanelsProvider } from "@/contexts/PanelsContext";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { WritingStatsProvider } from "@/contexts/WritingStatsContext";

function ThemedStack() {
  const { activeTheme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: activeTheme.colors.background }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: activeTheme.colors.toolbar },
          headerTintColor: activeTheme.colors.text,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: activeTheme.colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="themes"
          options={{ title: "Themes", presentation: "card" }}
        />
        <Stack.Screen
          name="theme-edit"
          options={{ title: "Edit Theme", presentation: "modal" }}
        />
        <Stack.Screen
          name="shortcuts"
          options={{ title: "Shortcut Bar", presentation: "card" }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: "Settings", presentation: "card" }}
        />
        <Stack.Screen
          name="sheets"
          options={{ title: "Characters & Locations", presentation: "card" }}
        />
        <Stack.Screen
          name="history"
          options={{ title: "Version History", presentation: "card" }}
        />
        <Stack.Screen
          name="about"
          options={{ title: "About", presentation: "card" }}
        />
        <Stack.Screen
          name="guide"
          options={{ title: "How to use Scribe", presentation: "card" }}
        />
      </Stack>
      <StatusBar style={activeTheme.isDark ? "light" : "dark"} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <NotesProvider>
              <ShortcutsProvider>
                <PanelsProvider>
                  <WritingStatsProvider>
                    <CharactersProvider>
                      <NovelProjectsProvider>
                        <ThemedStack />
                      </NovelProjectsProvider>
                    </CharactersProvider>
                  </WritingStatsProvider>
                </PanelsProvider>
              </ShortcutsProvider>
            </NotesProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
