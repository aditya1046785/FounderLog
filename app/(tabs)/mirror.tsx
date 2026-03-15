import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { addDays, endOfMonth, endOfWeek, format, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  GLASS_STYLE,
  SHADOWS,
  SPACING,
} from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';

const DAILY_TARGET = 10;
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DOMAIN_COLORS: Record<string, string> = {
  tech: '#3742FA',
  health: '#2ED573',
  finance: '#FFB800',
  transport: '#FF6B35',
  education: '#A855F7',
  other: '#8B8B9E',
};

const DOMAIN_LABELS: Record<string, string> = {
  tech: 'Tech',
  health: 'Health',
  finance: 'Finance',
  transport: 'Transport',
  education: 'Education',
  food: 'Food',
  lifestyle: 'Lifestyle',
  real_estate: 'Real Estate',
  social: 'Social',
  enterprise: 'Enterprise',
  environment: 'Environment',
  other: 'Other',
};

function streakMilestoneBonus(streak: number): number {
  let bonus = 0;
  if (streak >= 7) {
    bonus += 50;
  }
  if (streak >= 30) {
    bonus += 200;
  }
  if (streak >= 100) {
    bonus += 500;
  }
  return bonus;
}

function localDateKeyFromIso(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

function useCountUp(target: number, animationSeed: number, duration: number = 900): number {
  const [displayValue, setDisplayValue] = useState(0);
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [animationSeed, animated, duration, target]);

  useDerivedValue(() => {
    runOnJS(setDisplayValue)(Math.round(animated.value));
  }, [animated]);

  return displayValue;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const WeeklyBar = memo(function WeeklyBar({
  index,
  value,
  maxValue,
  isToday,
  progress,
}: {
  index: number;
  value: number;
  maxValue: number;
  isToday: boolean;
  progress: SharedValue<number>;
}) {
  const heightRatio = maxValue <= 0 ? 0.04 : Math.max(value / maxValue, value === 0 ? 0.04 : 0.08);
  const barHeight = Math.round(132 * heightRatio);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
    opacity: value === 0 ? 0.5 : 1,
  }));

  const isTargetHit = value >= DAILY_TARGET;

  return (
    <View style={styles.weekBarColumn}>
      <Text style={styles.weekValueText}>{value}</Text>
      <View style={styles.weekTrack}>
        {value === 0 ? (
          <Animated.View style={[styles.stubBar, animatedStyle]} />
        ) : (
          <Animated.View style={[styles.weekBarAnimated, animatedStyle]}>
            <LinearGradient
              colors={
                isTargetHit
                  ? [COLORS.accent, COLORS.fire]
                  : ['rgba(255,184,0,0.55)', 'rgba(255,184,0,0.35)']
              }
              end={{ x: 0.5, y: 0 }}
              start={{ x: 0.5, y: 1 }}
              style={[
                styles.weekBar,
                {
                  height: barHeight,
                  ...(isToday ? SHADOWS.glowAmber : null),
                },
              ]}
            />
          </Animated.View>
        )}
      </View>
      <Text style={[styles.weekDayText, isToday && styles.weekDayToday]}>{WEEK_DAYS[index]}</Text>
    </View>
  );
});

const StatusProgressRow = memo(function StatusProgressRow({
  label,
  count,
  total,
  color,
  progress,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const fillStyle = useAnimatedStyle(() => ({
    width: `${percentage * progress.value}%`,
  }));

  return (
    <View style={styles.statusRowWrap}>
      <View style={styles.statusRowHeader}>
        <Text style={styles.statusRowLabel}>{label}</Text>
        <Text style={styles.statusRowStats}>
          {count} ({percentage}%)
        </Text>
      </View>
      <View style={styles.statusTrack}>
        <Animated.View style={[styles.statusFillAnimated, fillStyle]}>
          <LinearGradient
            colors={[`${color}CC`, color]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={styles.statusFillInner}
          />
        </Animated.View>
      </View>
    </View>
  );
});

export default function MirrorScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const problems = useAppStore((state) => state.problems);
  const ideas = useAppStore((state) => state.ideas);
  const currentStreak = useAppStore((state) => state.currentStreak);
  const bestStreak = useAppStore((state) => state.bestStreak);
  const totalScore = useAppStore((state) => state.totalScore);
  const scoreFromProblems = useAppStore((state) => state.scoreFromProblems);
  const scoreFromIdeas = useAppStore((state) => state.scoreFromIdeas);
  const scoreFromBonuses = useAppStore((state) => state.scoreFromBonuses);
  const refreshAll = useAppStore((state) => state.refreshAll);

  const [refreshing, setRefreshing] = useState(false);
  const [animationSeed, setAnimationSeed] = useState(0);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const revealProgress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      setAnimationSeed((prev) => prev + 1);
    }, [refreshAll])
  );

  useEffect(() => {
    revealProgress.value = 0;
    revealProgress.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [animationSeed, revealProgress]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      setAnimationSeed((prev) => prev + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeekEnd = addDays(weekStart, -1);

  const problemsByDate = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const problem of problems) {
      const dateKey = localDateKeyFromIso(problem.created_at);
      grouped.set(dateKey, (grouped.get(dateKey) ?? 0) + 1);
    }
    return grouped;
  }, [problems]);

  const ideasByDate = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const idea of ideas) {
      const dateKey = localDateKeyFromIso(idea.created_at);
      grouped.set(dateKey, (grouped.get(dateKey) ?? 0) + 1);
    }
    return grouped;
  }, [ideas]);

  const daysTargetHit = useMemo(() => {
    let count = 0;
    for (const value of problemsByDate.values()) {
      if (value >= DAILY_TARGET) {
        count += 1;
      }
    }
    return count;
  }, [problemsByDate]);

  const totalProblems = problems.length;
  const totalIdeas = ideas.length;
  const problemsWithoutIdeas = useMemo(
    () => problems.filter((item) => (item.linked_ideas_count ?? 0) === 0).length,
    [problems]
  );

  const daysActive = useMemo(() => {
    const dates = new Set<string>();
    for (const problem of problems) {
      dates.add(localDateKeyFromIso(problem.created_at));
    }
    for (const idea of ideas) {
      dates.add(localDateKeyFromIso(idea.created_at));
    }
    return dates.size;
  }, [ideas, problems]);

  const categoriesExplored = useMemo(() => {
    const domains = new Set<string>();
    for (const problem of problems) {
      if (problem.domain) {
        domains.add(problem.domain);
      }
    }
    return domains.size;
  }, [problems]);

  const ideaPerProblem = totalProblems > 0 ? totalIdeas / totalProblems : 0;

  const thisWeekProblems = useMemo(
    () =>
      problems.filter((item) => {
        const created = parseISO(item.created_at);
        return created >= weekStart && created <= weekEnd;
      }).length,
    [problems, weekEnd, weekStart]
  );

  const thisWeekIdeas = useMemo(
    () =>
      ideas.filter((item) => {
        const created = parseISO(item.created_at);
        return created >= weekStart && created <= weekEnd;
      }).length,
    [ideas, weekEnd, weekStart]
  );

  const previousWeekProblems = useMemo(
    () =>
      problems.filter((item) => {
        const created = parseISO(item.created_at);
        return created >= previousWeekStart && created <= previousWeekEnd;
      }).length,
    [previousWeekEnd, previousWeekStart, problems]
  );

  const previousWeekIdeas = useMemo(
    () =>
      ideas.filter((item) => {
        const created = parseISO(item.created_at);
        return created >= previousWeekStart && created <= previousWeekEnd;
      }).length,
    [ideas, previousWeekEnd, previousWeekStart]
  );

  const thisWeekTargetHits = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStart, i);
      const dateKey = format(day, 'yyyy-MM-dd');
      if ((problemsByDate.get(dateKey) ?? 0) >= DAILY_TARGET) {
        count += 1;
      }
    }
    return count;
  }, [problemsByDate, weekStart]);

  const previousWeekTargetHits = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(previousWeekStart, i);
      const dateKey = format(day, 'yyyy-MM-dd');
      if ((problemsByDate.get(dateKey) ?? 0) >= DAILY_TARGET) {
        count += 1;
      }
    }
    return count;
  }, [previousWeekStart, problemsByDate]);

  const thisWeekScore =
    thisWeekProblems * 5 +
    thisWeekIdeas * 10 +
    thisWeekTargetHits * 20 +
    streakMilestoneBonus(currentStreak);

  const previousWeekScore =
    previousWeekProblems * 5 +
    previousWeekIdeas * 10 +
    previousWeekTargetHits * 20 +
    streakMilestoneBonus(Math.max(currentStreak - 7, 0));

  const weeklyDelta = thisWeekScore - previousWeekScore;

  const animatedScore = useCountUp(totalScore, animationSeed, 1000);
  const animatedTotalProblems = useCountUp(totalProblems, animationSeed, 700);
  const animatedTotalIdeas = useCountUp(totalIdeas, animationSeed, 700);
  const animatedWithoutIdeas = useCountUp(problemsWithoutIdeas, animationSeed, 700);
  const animatedDaysActive = useCountUp(daysActive, animationSeed, 700);
  const animatedCategories = useCountUp(categoriesExplored, animationSeed, 700);

  const weeklyCounts = useMemo(() => {
    const values: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStart, i);
      const dateKey = format(day, 'yyyy-MM-dd');
      values.push(problemsByDate.get(dateKey) ?? 0);
    }
    return values;
  }, [problemsByDate, weekStart]);

  const weeklyMax = Math.max(DAILY_TARGET, ...weeklyCounts);
  const weeklyAverage = weeklyCounts.reduce((sum, value) => sum + value, 0) / 7;

  const domainStats = useMemo(() => {
    const domainCount = new Map<string, number>();

    for (const problem of problems) {
      const key = problem.domain ?? 'other';
      domainCount.set(key, (domainCount.get(key) ?? 0) + 1);
    }

    return Array.from(domainCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({
        domain,
        count,
        color: DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.other,
        label: DOMAIN_LABELS[domain] ?? 'Other',
      }));
  }, [problems]);

  const statusOverview = useMemo(() => {
    const open = problems.filter((item) => item.status === 'open').length;
    const exploring = problems.filter((item) => item.status === 'exploring').length;
    const solved = problems.filter((item) => item.status === 'solved').length;
    return {
      open,
      exploring,
      solved,
      total: Math.max(1, open + exploring + solved),
    };
  }, [problems]);

  const donutCircumference = 2 * Math.PI * 64;
  const donutSegments = useMemo(() => {
    const total = domainStats.reduce((sum, item) => sum + item.count, 0);
    let cumulativeRatio = 0;

    return domainStats.map((item) => {
      const ratio = total > 0 ? item.count / total : 0;
      const segment = {
        ...item,
        ratio,
        dashLength: donutCircumference * ratio,
        dashOffset: -donutCircumference * cumulativeRatio,
      };
      cumulativeRatio += ratio;
      return segment;
    });
  }, [domainStats, donutCircumference]);

  const donutAnimatedStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [
      { scale: 0.92 + revealProgress.value * 0.08 },
      { rotate: `${-12 + 12 * revealProgress.value}deg` },
    ],
  }));

  const weekChartAnimatedStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [{ translateY: 8 - revealProgress.value * 8 }],
  }));

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const heatmapDays = useMemo(() => {
    const days: Date[] = [];
    let cursor = calendarStart;
    while (cursor <= calendarEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [calendarEnd, calendarStart]);

  const heatmapRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < heatmapDays.length; i += 7) {
      rows.push(heatmapDays.slice(i, i + 7));
    }
    return rows;
  }, [heatmapDays]);

  const getHeatColor = (count: number): string => {
    if (count <= 0) {
      return COLORS.surfaceLight;
    }
    if (count <= 3) {
      return 'rgba(255,184,0,0.3)';
    }
    if (count <= 6) {
      return 'rgba(255,184,0,0.5)';
    }
    if (count <= 9) {
      return 'rgba(255,184,0,0.75)';
    }
    return COLORS.accent;
  };

  const hasSparseData = problems.length < 8;
  const newRecord = currentStreak > 0 && currentStreak === bestStreak;

  const contentWidth = Math.min(width - SPACING.lg * 2, 620);
  const weekColumnWidth = Math.max(38, Math.floor((contentWidth - 24) / 7));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.background, '#0F1019', COLORS.background]}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACING.md,
          paddingHorizontal: SPACING.lg,
          paddingBottom: 130 + insets.bottom,
          gap: SPACING.lg,
        }}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <Text style={styles.headerTitle}>THE MIRROR</Text>
          <Text style={styles.headerSubtitle}>See yourself clearly.</Text>
        </View>

        <View style={[styles.heroCard, GLASS_STYLE]}>
          <View style={styles.scoreGlow} />
          <Text style={styles.heroScore}>{animatedScore}</Text>
          <Text style={styles.heroLabel}>IDEA MUSCLE SCORE</Text>

          <Text
            style={[
              styles.heroTrend,
              weeklyDelta > 0
                ? styles.trendUp
                : weeklyDelta < 0
                  ? styles.trendDown
                  : styles.trendFlat,
            ]}
          >
            {weeklyDelta > 0
              ? `▲ +${weeklyDelta} this week`
              : weeklyDelta < 0
                ? `▼ ${weeklyDelta} this week`
                : '── No change'}
          </Text>

          <Pressable onPress={() => setShowScoreBreakdown((prev) => !prev)}>
            <Text style={styles.scoreBreakdownText}>
              {showScoreBreakdown
                ? 'Hide scoring details'
                : 'How it works: +5 per problem, +10 per idea, +20 daily target bonus, +50/+200/+500 streak milestones'}
            </Text>
          </Pressable>
          {showScoreBreakdown ? (
            <Text style={styles.scoreBreakdownText}>
              Lifetime score: {totalScore} points. Problems: {scoreFromProblems}, Ideas: {scoreFromIdeas}, Bonuses: {scoreFromBonuses}.
            </Text>
          ) : null}
        </View>

        <View style={styles.streakRow}>
          <View style={[styles.streakCard, GLASS_STYLE]}>
            <Text style={styles.streakNumber}>🔥 {currentStreak}</Text>
            <Text style={styles.streakLabel}>Current Streak</Text>
            {newRecord ? (
              <View style={styles.recordBadge}>
                <Text style={styles.recordBadgeText}>NEW RECORD!</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.streakCard, GLASS_STYLE]}>
            <Text style={styles.bestNumber}>🏆 {bestStreak}</Text>
            <Text style={styles.streakLabel}>Best Streak</Text>
          </View>
        </View>

        <View>
          <SectionTitle title="THIS WEEK'S ACTIVITY" />
          <Animated.View style={[styles.chartCard, GLASS_STYLE, weekChartAnimatedStyle]}>
            <View style={styles.weekChartWrap}>
              <View
                style={[
                  styles.targetLine,
                  {
                    bottom: Math.round((Math.min(DAILY_TARGET, weeklyMax) / weeklyMax) * 132) + 22,
                  },
                ]}
              />
              <View style={styles.weekBarsRow}>
                {weeklyCounts.map((value, index) => (
                  <View key={`week-${index}`} style={{ width: weekColumnWidth, alignItems: 'center' }}>
                    <WeeklyBar
                      index={index}
                      isToday={isSameDay(today, addDays(weekStart, index))}
                      maxValue={weeklyMax}
                      progress={revealProgress}
                      value={value}
                    />
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.targetHint}>Target line at {DAILY_TARGET} problems/day</Text>
            <Text style={styles.avgText}>Avg: {weeklyAverage.toFixed(1)} problems/day</Text>
            {weeklyCounts.every((item) => item === 0) ? (
              <Text style={styles.encouragingNote}>Your week is waiting. Capture one problem today to spark momentum.</Text>
            ) : null}
          </Animated.View>
        </View>

        <View>
          <SectionTitle title="WHERE YOUR EYES GO" />
          <View style={[styles.domainCard, GLASS_STYLE]}>
            {domainStats.length === 0 ? (
              <Text style={styles.encouragingNote}>Observe a few problems first. Your focus map will appear here.</Text>
            ) : (
              <>
                <Animated.View style={[styles.donutWrap, donutAnimatedStyle]}>
                  <Svg height={180} width={180}>
                    <Circle
                      cx={90}
                      cy={90}
                      fill="none"
                      r={64}
                      stroke={COLORS.surfaceLight}
                      strokeWidth={18}
                    />
                    {donutSegments.map((segment) => (
                      <Circle
                        key={segment.domain}
                        cx={90}
                        cy={90}
                        fill="none"
                        r={64}
                        rotation={-90}
                        origin="90,90"
                        stroke={segment.color}
                        strokeDasharray={`${segment.dashLength} ${donutCircumference}`}
                        strokeDashoffset={segment.dashOffset}
                        strokeWidth={18}
                      />
                    ))}
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutCenterValue}>{totalProblems}</Text>
                    <Text style={styles.donutCenterLabel}>Problems</Text>
                  </View>
                </Animated.View>

                <View style={styles.legendWrap}>
                  {domainStats.map((item) => {
                    const percent = totalProblems > 0 ? Math.round((item.count / totalProblems) * 100) : 0;
                    return (
                      <View key={item.domain} style={[styles.legendItem, GLASS_STYLE]}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.legendStats}>
                          {item.count} ({percent}%)
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
            {domainStats.length < 3 ? (
              <Text style={styles.encouragingNote}>Keep observing! More data = better insights.</Text>
            ) : null}
          </View>
        </View>

        <View>
          <SectionTitle title="PROBLEM STATUS" />
          <View style={[styles.statusCard, GLASS_STYLE]}>
            <StatusProgressRow
              color={COLORS.statusOpen}
              count={statusOverview.open}
              label="Open"
              progress={revealProgress}
              total={statusOverview.total}
            />
            <StatusProgressRow
              color={COLORS.statusExploring}
              count={statusOverview.exploring}
              label="Exploring"
              progress={revealProgress}
              total={statusOverview.total}
            />
            <StatusProgressRow
              color={COLORS.statusSolved}
              count={statusOverview.solved}
              label="Solved"
              progress={revealProgress}
              total={statusOverview.total}
            />
            {totalProblems === 0 ? <Text style={styles.encouragingNote}>No problems yet. Once you capture some, status patterns show up here.</Text> : null}
          </View>
        </View>

        <View>
          <SectionTitle title="KEY NUMBERS" />
          <View style={styles.keyGrid}>
            <View style={[styles.keyCard, GLASS_STYLE]}>
              <Text style={styles.keyValue}>{animatedTotalProblems}</Text>
              <Text style={styles.keyLabel}>Total Problems</Text>
            </View>

            <View style={[styles.keyCard, GLASS_STYLE]}>
              <Text style={styles.keyValue}>{animatedTotalIdeas}</Text>
              <Text style={styles.keyLabel}>Total Ideas</Text>
            </View>

            <Pressable
              onPress={() => router.push('/vault?withoutIdeas=1')}
              style={[styles.keyCard, GLASS_STYLE, problemsWithoutIdeas > 0 && styles.actionableCard]}
            >
              <Text style={styles.keyValue}>{animatedWithoutIdeas}</Text>
              <Text style={styles.keyLabel}>Problems w/o Ideas ⚠️</Text>
            </Pressable>

            <View style={[styles.keyCard, GLASS_STYLE]}>
              <Text style={styles.keyValue}>{ideaPerProblem.toFixed(1)}</Text>
              <Text style={styles.keyLabel}>Ideas per Problem</Text>
            </View>

            <View style={[styles.keyCard, GLASS_STYLE]}>
              <Text style={styles.keyValue}>{animatedDaysActive}</Text>
              <Text style={styles.keyLabel}>Days Active</Text>
            </View>

            <View style={[styles.keyCard, GLASS_STYLE]}>
              <Text style={styles.keyValue}>{animatedCategories}</Text>
              <Text style={styles.keyLabel}>Categories Explored</Text>
            </View>
          </View>
        </View>

        <View>
          <SectionTitle title="OBSERVATION CALENDAR" />
          <View style={[styles.heatmapCard, GLASS_STYLE]}>
            <Text style={styles.heatmapMonth}>{format(today, 'MMMM yyyy')}</Text>
            <View style={styles.heatmapWeekHeader}>
              {WEEK_DAYS.map((label, index) => (
                <Text key={`heat-day-${label}-${index}`} style={styles.heatmapWeekHeaderText}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.heatmapGrid}>
              {heatmapRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.heatmapRow}>
                  {row.map((date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const count = problemsByDate.get(dateKey) ?? 0;
                    const inCurrentMonth = date >= monthStart && date <= monthEnd;
                    const isBigDay = count >= DAILY_TARGET;

                    return (
                      <View
                        key={dateKey}
                        style={[
                          styles.heatSquare,
                          {
                            backgroundColor: getHeatColor(count),
                            opacity: inCurrentMonth ? 1 : 0.28,
                            ...(isBigDay ? SHADOWS.glowAmber : null),
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={styles.heatmapLegend}>0, 1-3, 4-6, 7-9, 10+</Text>
            {hasSparseData ? (
              <Text style={styles.encouragingNote}>Small streaks become powerful habits. Keep logging daily.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerWrap: {
    gap: 4,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 3,
  },
  headerSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.md,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 1.8,
    marginBottom: SPACING.sm,
  },
  heroCard: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  scoreGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,184,0,0.12)',
  },
  heroScore: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.giant,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
    ...SHADOWS.glowAmber,
  },
  heroLabel: {
    color: COLORS.textSecondary,
    marginTop: 6,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 2,
    fontWeight: FONT_WEIGHTS.bold,
  },
  heroTrend: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  trendUp: {
    color: COLORS.success,
  },
  trendDown: {
    color: COLORS.danger,
  },
  trendFlat: {
    color: COLORS.textTertiary,
  },
  scoreBreakdownText: {
    marginTop: SPACING.md,
    color: COLORS.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  streakRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  streakCard: {
    flex: 1,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
  },
  streakNumber: {
    color: COLORS.fire,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  bestNumber: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  streakLabel: {
    marginTop: 6,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  recordBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,184,0,0.16)',
    borderColor: 'rgba(255,184,0,0.5)',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...SHADOWS.glowAmber,
  },
  recordBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.8,
  },
  chartCard: {
    padding: SPACING.md,
  },
  weekChartWrap: {
    height: 180,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  weekBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  weekBarColumn: {
    alignItems: 'center',
    gap: 6,
  },
  weekValueText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    minHeight: 14,
  },
  weekTrack: {
    height: 138,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  weekBarAnimated: {
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: 20,
    borderRadius: 7,
  },
  stubBar: {
    width: 18,
    height: 6,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceLight,
  },
  weekDayText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  weekDayToday: {
    color: COLORS.accent,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.textTertiary,
    opacity: 0.7,
  },
  targetHint: {
    marginTop: 6,
    color: COLORS.textTertiary,
    fontSize: 11,
  },
  avgText: {
    marginTop: 6,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  domainCard: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  donutWrap: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  donutCenterLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  legendWrap: {
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 10,
  },
  legendLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  legendStats: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  statusCard: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statusRowWrap: {
    gap: 8,
  },
  statusRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRowLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  statusRowStats: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  statusTrack: {
    height: 24,
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  statusFillAnimated: {
    height: '100%',
    overflow: 'hidden',
  },
  statusFillInner: {
    height: '100%',
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  keyCard: {
    width: '47%',
    minHeight: 112,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  actionableCard: {
    backgroundColor: 'rgba(255,71,87,0.09)',
    borderColor: 'rgba(255,71,87,0.35)',
  },
  keyValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  keyLabel: {
    marginTop: 6,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 18,
  },
  heatmapCard: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  heatmapMonth: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  heatmapWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  heatmapWeekHeaderText: {
    color: COLORS.textTertiary,
    fontSize: 10,
    width: 16,
    textAlign: 'center',
  },
  heatmapGrid: {
    gap: 6,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  heatSquare: {
    width: 16,
    height: 16,
    borderRadius: 5,
  },
  heatmapLegend: {
    marginTop: 4,
    color: COLORS.textTertiary,
    fontSize: 11,
  },
  encouragingNote: {
    marginTop: 8,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 19,
  },
});
