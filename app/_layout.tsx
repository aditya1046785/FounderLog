import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { COLORS } from '../src/constants/theme';
import { useAppStore } from '../src/store/useAppStore';

export default function RootLayout() {
  const initialize = useAppStore((state) => state.initialize);
  const isLoading = useAppStore((state) => state.isLoading);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.root, styles.loadingContainer]}>
          <StatusBar style="light" />
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: styles.screenContent,
            headerStyle: styles.header,
            headerTintColor: COLORS.accent,
            headerTitleStyle: styles.headerTitle,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="problem/editor"
            options={{
              title: 'Problem Editor',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="problem/[id]"
            options={{
              title: 'Problem Detail',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="idea/editor"
            options={{
              title: 'Idea Editor',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenContent: {
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});
