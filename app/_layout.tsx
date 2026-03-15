import 'react-native-reanimated';

import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import CelebrationModal from '../src/components/common/CelebrationModal';
import { COLORS } from '../src/constants/theme';
import { useAppStore } from '../src/store/useAppStore';
import { checkAndNotify, requestNotificationPermissions, scheduleDailyReminder } from '../src/utils/notifications';

function RootSkeleton() {
  const shimmer = useSharedValue(0);
  shimmer.value = withRepeat(
    withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
    -1,
    true
  );

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.22, 0.68]),
  }));

  return (
    <View style={styles.skeletonWrap}>
      <Animated.View style={[styles.skeletonHero, shimmerStyle]} />
      <View style={styles.skeletonRow}>
        <Animated.View style={[styles.skeletonPod, shimmerStyle]} />
        <Animated.View style={[styles.skeletonPod, shimmerStyle]} />
        <Animated.View style={[styles.skeletonPod, shimmerStyle]} />
      </View>
      <Animated.View style={[styles.skeletonLong, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLong, shimmerStyle]} />
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const initialize = useAppStore((state) => state.initialize);
  const isLoading = useAppStore((state) => state.isLoading);
  const currentCelebration = useAppStore((state) => state.currentCelebration);
  const dismissCelebration = useAppStore((state) => state.dismissCelebration);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const kind = response.notification.request.content.data?.kind;
      if (kind === 'daily-check') {
        void checkAndNotify();
      }
      router.push('/problem/editor');
    });

    const receivedSub = Notifications.addNotificationReceivedListener((event) => {
      const kind = event.request.content.data?.kind;
      if (kind === 'daily-check') {
        void checkAndNotify();
      }
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    void (async () => {
      try {
        await requestNotificationPermissions();
        await scheduleDailyReminder();
      } catch (error) {
        console.error('Failed to configure reminders:', error);
      }
    })();
  }, [isLoading]);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.root, styles.loadingContainer]}>
          <StatusBar style="light" />
          <RootSkeleton />
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
        <CelebrationModal
          celebration={currentCelebration}
          onDismiss={dismissCelebration}
          visible={Boolean(currentCelebration)}
        />
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
    justifyContent: 'flex-start',
  },
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 70,
    gap: 16,
  },
  skeletonHero: {
    height: 170,
    borderRadius: 20,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonPod: {
    flex: 1,
    height: 90,
    borderRadius: 14,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  skeletonLong: {
    height: 72,
    borderRadius: 14,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
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
