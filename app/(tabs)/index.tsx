import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  LinearTransition,
  createAnimatedComponent,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  SPACING,
} from '../../src/constants/theme';
import QuickCaptureSheet from '../../src/components/home/QuickCaptureSheet';
import { Problem, useAppStore } from '../../src/store/useAppStore';
import { requestNotificationPermissions, scheduleDailyReminder } from '../../src/utils/notifications';

const MISSION_TARGET = 10;
const RING_SIZE = 160;
const RING_STROKE = 8;
const AnimatedCircle = createAnimatedComponent(Circle);

function getGreetingByTime(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Rise and observe. ☀️';
  }
  if (hour >= 12 && hour < 17) {
    return 'The world is full of problems. Find them. 👀';
  }
  if (hour >= 17 && hour < 21) {
    return 'Before the day ends - what did you notice? 🌅';
  }
  return 'Late night thinker? Respect. 🌙';
}

function getMissionMessage(todayCount: number): string {
  if (todayCount <= 0) {
    return "Let's begin. What did you notice today?";
  }
  if (todayCount <= 3) {
    return 'Good start. Keep observing.';
  }
  if (todayCount <= 6) {
    return 'Halfway there! Keep going.';
  }
  if (todayCount <= 9) {
    return 'Almost there! Push through.';
  }
  return '🎉 Mission complete! Founder muscles growing.';
}

function formatCompactRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getStatusColor(status: Problem['status']): string {
  if (status === 'exploring') {
    return COLORS.statusExploring;
  }
  if (status === 'solved') {
    return COLORS.statusSolved;
  }
  return COLORS.statusOpen;
}

function getStatusLabel(status: Problem['status']): string {
  if (status === 'exploring') {
    return 'Exploring';
  }
  if (status === 'solved') {
    return 'Solved';
  }
  return 'Open';
}

function showQuickToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('', message);
}

function useCountUp(target: number, animationTrigger: number): number {
  const [display, setDisplay] = useState(0);
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(target, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [animationTrigger, animated, target]);

  useDerivedValue(() => {
    runOnJS(setDisplay)(Math.round(animated.value));
  }, [animated]);

  return display;
}

export default function MissionControlScreen() {
  const insets = useSafeAreaInsets();
  const problems = useAppStore((state) => state.problems);
  const ideas = useAppStore((state) => state.ideas);
  const currentStreak = useAppStore((state) => state.currentStreak);
  const bestStreak = useAppStore((state) => state.bestStreak);
  const totalScore = useAppStore((state) => state.totalScore);
  const todayProblemsCount = useAppStore((state) => state.todayProblemsCount);
  const todayIdeasCount = useAppStore((state) => state.todayIdeasCount);
  const addProblem = useAppStore((state) => state.addProblem);
  const refreshAll = useAppStore((state) => state.refreshAll);
  const remindersEnabled = useAppStore((state) => state.remindersEnabled);

  const [refreshing, setRefreshing] = useState(false);
  const [quickCaptureVisible, setQuickCaptureVisible] = useState(false);
  const [savingQuickCapture, setSavingQuickCapture] = useState(false);
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [revisitIndexSeed, setRevisitIndexSeed] = useState(0);

  const ctaPressScale = useSharedValue(1);
  const ctaPulse = useSharedValue(0);
  const missionRingProgress = useSharedValue(0);
  const missionGlowPulse = useSharedValue(0);
  const longPressTriggeredRef = useRef(false);

  const greeting = getGreetingByTime();
  const todayCountClamped = Math.max(0, Math.min(MISSION_TARGET, todayProblemsCount));
  const missionMessage = getMissionMessage(todayCountClamped);
  const remainingCount = Math.max(0, MISSION_TARGET - todayCountClamped);
  const problemsNeedingIdeas = useMemo(
    () => problems.filter((item) => (item.linked_ideas_count ?? 0) === 0).length,
    [problems]
  );
  const recentProblems = useMemo(
    () => problems.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [problems]
  );

  const revisitCandidates = useMemo(() => {
    const now = Date.now();
    return problems.filter((item) => {
      const olderThanThreeDays = now - new Date(item.created_at).getTime() > 3 * 24 * 60 * 60 * 1000;
      const noIdeas = (item.linked_ideas_count ?? 0) === 0;
      return olderThanThreeDays && noIdeas;
    });
  }, [problems]);

  const revisitProblem = useMemo(() => {
    if (revisitCandidates.length === 0) {
      return null;
    }
    const index = Math.abs(revisitIndexSeed) % revisitCandidates.length;
    return revisitCandidates[index];
  }, [revisitCandidates, revisitIndexSeed]);

  const animatedStreak = useCountUp(currentStreak, animationTrigger);
  const animatedProblems = useCountUp(problems.length, animationTrigger);
  const animatedIdeas = useCountUp(ideas.length, animationTrigger);
  const animatedScore = useCountUp(totalScore, animationTrigger);
  const animatedToday = useCountUp(todayCountClamped, animationTrigger);

  const topDomains = useMemo(() => {
    const domainCounts = new Map<string, number>();
    for (const problem of problems) {
      const key = problem.domain || 'other';
      domainCounts.set(key, (domainCounts.get(key) ?? 0) + 1);
    }

    return Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain]) => domain);
  }, [problems]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      setAnimationTrigger((prev) => prev + 1);
      setRevisitIndexSeed(Math.floor(Math.random() * 100000));
    }, [refreshAll])
  );

  useEffect(() => {
    missionRingProgress.value = 0;
    missionRingProgress.value = withSpring(todayCountClamped / MISSION_TARGET, {
      damping: 14,
      stiffness: 110,
      mass: 0.9,
    });
  }, [missionRingProgress, todayCountClamped]);

  useEffect(() => {
    if (todayCountClamped < MISSION_TARGET) {
      missionGlowPulse.value = 0;
      return;
    }

    missionGlowPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1,
      false
    );
  }, [missionGlowPulse, todayCountClamped]);

  useEffect(() => {
    if (todayCountClamped >= MISSION_TARGET) {
      ctaPulse.value = 0;
      return;
    }

    ctaPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [ctaPulse, todayCountClamped]);

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - missionRingProgress.value),
  }));

  const missionCardAnimatedStyle = useAnimatedStyle(() => {
    const glow = interpolate(missionGlowPulse.value, [0, 1], [0.16, 0.42]);
    return {
      borderColor: todayCountClamped >= MISSION_TARGET ? `rgba(255,184,0,${glow})` : COLORS.glassBorder,
      shadowOpacity: todayCountClamped >= MISSION_TARGET ? glow : 0,
      shadowColor: COLORS.accent,
    };
  });

  const ctaAnimatedStyle = useAnimatedStyle(() => {
    const pulseScale = todayCountClamped < MISSION_TARGET ? interpolate(ctaPulse.value, [0, 1], [1, 1.018]) : 1;
    return {
      transform: [{ scale: ctaPressScale.value * pulseScale }],
    };
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      setAnimationTrigger((prev) => prev + 1);
      setRevisitIndexSeed(Math.floor(Math.random() * 100000));
    } finally {
      setRefreshing(false);
    }
  };

  const handlePressCta = async () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('CTA haptic failed:', error);
    }
    router.push('/problem/editor');
  };

  const handleLongPressCta = async () => {
    longPressTriggeredRef.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Long press haptic failed:', error);
    }
    setQuickCaptureVisible(true);
  };

  const handleSaveQuickCapture = async (title: string, domain: string) => {
    const trimmed = title.trim();
    if (!trimmed || savingQuickCapture) {
      return;
    }

    setSavingQuickCapture(true);
    try {
      await addProblem({
        title: trimmed,
        domain: domain || 'other',
        status: 'open',
        is_quick_capture: true,
      });
      setQuickCaptureVisible(false);
      showQuickToast('Captured! Add details later ✏️');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnimationTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to save quick capture:', error);
    } finally {
      setSavingQuickCapture(false);
    }
  };

  const handleEnableReminders = async () => {
    try {
      const status = await requestNotificationPermissions();
      if (status === 'granted') {
        await scheduleDailyReminder();
        await refreshAll();
        showQuickToast('Reminders enabled. You are covered tonight.');
        return;
      }

      showQuickToast('Enable notifications in settings to receive reminders.');
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to enable reminders:', error);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingTop: insets.top + SPACING.md,
          paddingBottom: 120 + insets.bottom,
        }}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topWrap}>
          <Text style={styles.greeting}>{greeting}</Text>
          {currentStreak > 0 ? (
            <Text style={styles.streakText}>🔥 {animatedStreak} day streak</Text>
          ) : (
            <Text style={styles.noStreakText}>Start your streak today</Text>
          )}
          {!remindersEnabled ? (
            <Pressable onPress={() => void handleEnableReminders()} style={styles.reminderOffChip}>
              <Text style={styles.reminderOffText}>🔕 Reminders are off. Enable in settings?</Text>
            </Pressable>
          ) : null}
        </View>

        <Animated.View layout={LinearTransition.springify().damping(16)} style={[styles.missionCard, missionCardAnimatedStyle]}>
          <Text style={styles.missionLabel}>TODAY&apos;S MISSION</Text>

          <View style={styles.ringWrap}>
            <Svg height={RING_SIZE} style={styles.ringSvg} width={RING_SIZE}>
              <Defs>
                <SvgGradient id="missionGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                  <Stop offset="0%" stopColor={COLORS.accent} />
                  <Stop offset="100%" stopColor={COLORS.fire} />
                </SvgGradient>
              </Defs>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke={COLORS.surfaceLight}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                animatedProps={ringAnimatedProps}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke="url(#missionGradient)"
                strokeDasharray={`${circumference}`}
                strokeLinecap="round"
                strokeWidth={RING_STROKE}
                fill="none"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>

            <View pointerEvents="none" style={styles.ringCenterTextWrap}>
              <Text style={styles.ringCenterPrimary}>{animatedToday}</Text>
              <Text style={styles.ringCenterSecondary}>/ {MISSION_TARGET}</Text>
            </View>
          </View>

          <Text style={styles.missionMessage}>{missionMessage}</Text>
          {todayCountClamped < MISSION_TARGET ? (
            <Text style={styles.missionSubtext}>{remainingCount} more to go</Text>
          ) : null}
        </Animated.View>

        <Text style={styles.missionHelperText}>Problems observed today</Text>

        <View style={styles.statsRow}>
          <View style={styles.statPod}>
            <Text style={styles.statValue}>{animatedProblems}</Text>
            <Text style={styles.statLabel}>Problems</Text>
          </View>
          <View style={styles.statPod}>
            <Text style={styles.statValue}>{animatedIdeas}</Text>
            <Text style={styles.statLabel}>Ideas</Text>
          </View>
          <View style={styles.statPod}>
            <Text style={styles.statValue}>{animatedScore}</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
        </View>

        <Animated.View style={[styles.ctaWrap, ctaAnimatedStyle]}>
          <Pressable
            delayLongPress={500}
            onLongPress={() => {
              void handleLongPressCta();
            }}
            onPress={() => {
              void handlePressCta();
            }}
            onPressIn={() => {
              ctaPressScale.value = withTiming(0.96, { duration: 110 });
            }}
            onPressOut={() => {
              ctaPressScale.value = withTiming(1, { duration: 140 });
              setTimeout(() => {
                longPressTriggeredRef.current = false;
              }, 0);
            }}
          >
            <LinearGradient
              colors={[COLORS.accent, COLORS.fire]}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaButtonText}>⚡ OBSERVE A PROBLEM</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>RECENT</Text>
          <ScrollView contentContainerStyle={styles.recentRow} horizontal showsHorizontalScrollIndicator={false}>
            {recentProblems.length > 0 ? (
              recentProblems.map((problem) => {
                const statusColor = getStatusColor(problem.status);
                return (
                  <Pressable
                    key={problem.id}
                    onPress={() => router.push(`/problem/${problem.id}`)}
                    style={styles.recentCard}
                  >
                    <View style={[styles.recentCardEdge, { backgroundColor: statusColor }]} />
                    <Text numberOfLines={2} style={styles.recentTitle}>
                      {problem.title}
                    </Text>
                    <Text style={styles.recentMeta}>💡 {problem.linked_ideas_count ?? 0}  • {formatCompactRelativeTime(problem.created_at)}</Text>
                    <View style={styles.recentStatusRow}>
                      <View style={[styles.recentStatusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.recentStatusText, { color: statusColor }]}>{getStatusLabel(problem.status)}</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.recentCard, styles.recentEmptyCard]}>
                <Text style={styles.recentEmptyText}>Your first observation awaits...</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {revisitProblem ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>🔄 REVISIT THIS</Text>
            <Pressable onPress={() => router.push(`/problem/${revisitProblem.id}`)} style={styles.revisitCard}>
              <Text style={styles.revisitAge}>🔄 FROM {formatCompactRelativeTime(revisitProblem.created_at).toUpperCase()} AGO</Text>
              <Text numberOfLines={2} style={styles.revisitTitle}>
                "{revisitProblem.title}"
              </Text>
              <Text style={styles.revisitHint}>Any new ideas? → TAP TO REVISIT</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickStatsStrip}>
          <Text numberOfLines={1} style={styles.quickStatsText}>
            Today&apos;s ideas: {todayIdeasCount} | Best streak: {bestStreak} days | Problems needing ideas: {problemsNeedingIdeas}
          </Text>
        </View>
      </ScrollView>
      <QuickCaptureSheet
        domainOptions={topDomains}
        onClose={() => setQuickCaptureVisible(false)}
        onSave={(title, domain) => {
          void handleSaveQuickCapture(title, domain);
        }}
        saving={savingQuickCapture}
        visible={quickCaptureVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topWrap: {
    gap: SPACING.sm,
  },
  greeting: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 24,
  },
  streakText: {
    color: COLORS.fire,
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 38,
  },
  noStreakText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.md,
  },
  reminderOffChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.35)',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reminderOffText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  missionCard: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.cardShadow,
  },
  missionLabel: {
    color: COLORS.textAccent,
    fontSize: FONT_SIZES.sm,
    letterSpacing: 2.2,
    fontWeight: FONT_WEIGHTS.heavy,
    marginBottom: SPACING.md,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
  },
  ringCenterTextWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ringCenterPrimary: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.giant,
    fontWeight: FONT_WEIGHTS.heavy,
    lineHeight: 44,
  },
  ringCenterSecondary: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xl,
    lineHeight: 30,
    marginBottom: 3,
    marginLeft: 4,
  },
  missionMessage: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    textAlign: 'center',
  },
  missionSubtext: {
    marginTop: 6,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  missionHelperText: {
    marginTop: SPACING.sm,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statsRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    gap: 12,
  },
  statPod: {
    flex: 1,
    minHeight: 102,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 33,
  },
  statLabel: {
    marginTop: 4,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 0.5,
  },
  ctaWrap: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.glowAmber,
  },
  ctaButton: {
    height: 64,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#0A0A0F',
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1.1,
  },
  sectionWrap: {
    marginTop: 28,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.7,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: SPACING.md,
  },
  recentRow: {
    gap: SPACING.sm,
  },
  recentCard: {
    width: 160,
    minHeight: 118,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.glassBg,
    paddingHorizontal: 11,
    paddingVertical: 11,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  recentCardEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.95,
  },
  recentTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: 18,
  },
  recentMeta: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 8,
  },
  recentStatusRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentStatusDot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  recentStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  recentEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmptyText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  revisitCard: {
    backgroundColor: 'rgba(255,184,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.28)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  revisitAge: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.4,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  revisitTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    lineHeight: 24,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  revisitHint: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  quickStatsStrip: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickStatsText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
});
