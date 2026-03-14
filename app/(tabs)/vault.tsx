import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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
import { Problem, useAppStore } from '../../src/store/useAppStore';

type VaultSection = {
  title: string;
  dateKey: string;
  data: Problem[];
};

type TimeFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'open' | 'exploring' | 'solved';

const DOMAIN_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: '💻 Tech', value: 'tech' },
  { label: '🏥 Health', value: 'health' },
  { label: '💰 Finance', value: 'finance' },
  { label: '📚 Education', value: 'education' },
  { label: '🚗 Transport', value: 'transport' },
  { label: '🍕 Food', value: 'food' },
  { label: '🛍️ Lifestyle', value: 'lifestyle' },
  { label: '🏠 Real Estate', value: 'real_estate' },
  { label: '📱 Social', value: 'social' },
  { label: '🏭 Enterprise', value: 'enterprise' },
  { label: '🌍 Environment', value: 'environment' },
  { label: '❓ Other', value: 'other' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Exploring', value: 'exploring' },
  { label: 'Solved', value: 'solved' },
] as const;

const TIME_FILTER_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
] as const;

const CONTEXT_META: Record<string, string> = {
  street: '🛣️ Street',
  office: '🏢 Office',
  home: '🏠 Home',
  online: '💻 Online',
  market: '🏪 Market',
  commute: '🚌 Commute',
  app_website: '📱 App/Website',
  other: '❓ Other',
};

const DOMAIN_META: Record<string, string> = {
  tech: '💻 Tech',
  health: '🏥 Health',
  finance: '💰 Finance',
  education: '📚 Education',
  transport: '🚗 Transport',
  food: '🍕 Food',
  lifestyle: '🛍️ Lifestyle',
  real_estate: '🏠 Real Estate',
  social: '📱 Social',
  enterprise: '🏭 Enterprise',
  environment: '🌍 Environment',
  other: '❓ Other',
};

function getStatusColor(status: Problem['status']): string {
  if (status === 'open') {
    return COLORS.statusOpen;
  }
  if (status === 'exploring') {
    return COLORS.statusExploring;
  }
  return COLORS.statusSolved;
}

function getStatusLabel(status: Problem['status']): string {
  if (status === 'open') {
    return 'Open';
  }
  if (status === 'exploring') {
    return 'Exploring';
  }
  return 'Solved';
}

function getDateHeaderLabel(dateKey: string): string {
  const parsed = parseISO(`${dateKey}T00:00:00`);
  if (isToday(parsed)) {
    return 'TODAY';
  }
  if (isYesterday(parsed)) {
    return 'YESTERDAY';
  }
  return format(parsed, 'd MMM, EEEE').toUpperCase();
}

function toLocalDateKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const VaultCard = memo(function VaultCard({
  item,
  onPress,
  onLongPress,
  onDelete,
  onAddIdea,
}: {
  item: Problem;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onAddIdea: () => void;
}) {
  const statusColor = getStatusColor(item.status);
  const edgeOpacity = useSharedValue(item.status === 'open' ? 0.5 : item.status === 'exploring' ? 0.6 : 1);
  const borderPulse = useSharedValue(0.15);

  const hasNoIdeas = (item.linked_ideas_count ?? 0) === 0;
  const needsAttention = item.status === 'open' && hasNoIdeas;

  const relativeTime = formatDistanceToNow(parseISO(item.created_at), { addSuffix: true });
  const contextMeta = item.context ? CONTEXT_META[item.context] ?? `❓ ${item.context}` : '❓ Context';
  const domainMeta = item.domain ? DOMAIN_META[item.domain] ?? `🏷️ ${item.domain}` : '🏷️ Domain';

  if (item.status === 'open') {
    edgeOpacity.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })), -1, false);
  } else if (item.status === 'exploring') {
    edgeOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  } else {
    edgeOpacity.value = withTiming(1, { duration: 350 });
  }

  if (needsAttention) {
    borderPulse.value = withRepeat(
      withSequence(withTiming(0.42, { duration: 1000 }), withTiming(0.14, { duration: 1000 })),
      -1,
      false
    );
  } else {
    borderPulse.value = withTiming(0.1, { duration: 300 });
  }

  const edgeStyle = useAnimatedStyle(() => ({
    opacity: edgeOpacity.value,
  }));

  const attentionStyle = useAnimatedStyle(() => ({
    opacity: borderPulse.value,
    borderColor: COLORS.statusOpen,
  }));

  return (
    <Swipeable
      friction={2.2}
      overshootFriction={8}
      renderLeftActions={() => (
        <View style={[styles.swipeAction, styles.swipeActionLeft]}>
          <Pressable onPress={onAddIdea} style={styles.swipeActionButton}>
            <Ionicons color={COLORS.background} name="bulb-outline" size={21} />
          </Pressable>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.swipeAction, styles.swipeActionRight]}>
          <Pressable onPress={onDelete} style={styles.swipeActionButton}>
            <Ionicons color="#FFFFFF" name="trash-outline" size={21} />
          </Pressable>
        </View>
      )}
    >
      <Pressable onLongPress={onLongPress} onPress={onPress} style={styles.cardOuter}>
        <Animated.View pointerEvents="none" style={[styles.attentionBorder, attentionStyle]} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cardEdge,
            {
              backgroundColor: statusColor,
              shadowColor: statusColor,
            },
            edgeStyle,
          ]}
        />

        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {item.title}
          </Text>

          <View style={styles.metaRowTop}>
            <View style={styles.metaPill}>
              <Text numberOfLines={1} style={styles.metaPillText}>
                {contextMeta}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text numberOfLines={1} style={styles.metaPillText}>
                {domainMeta}
              </Text>
            </View>
            <Text style={styles.metaTime}>📅 {relativeTime}</Text>
          </View>

          <View style={styles.metaRowBottom}>
            <Text style={[styles.ideaMeta, hasNoIdeas && styles.ideaMetaMuted]}>
              💡 {hasNoIdeas ? 'No ideas yet' : `${item.linked_ideas_count} ideas attached`}
            </Text>

            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

function SkeletonCard() {
  const shimmer = useSharedValue(0);

  shimmer.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.25, 0.7]),
  }));

  return (
    <View style={styles.cardOuter}>
      <View style={[styles.cardEdge, { backgroundColor: COLORS.glassBorder, opacity: 0.45 }]} />
      <View style={styles.cardBody}>
        <Animated.View style={[styles.skeletonTitle, shimmerStyle]} />
        <Animated.View style={[styles.skeletonSubtitle, shimmerStyle]} />
        <View style={styles.skeletonMetaRow}>
          <Animated.View style={[styles.skeletonChip, shimmerStyle]} />
          <Animated.View style={[styles.skeletonChip, shimmerStyle]} />
        </View>
      </View>
    </View>
  );
}

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const problems = useAppStore((state) => state.problems);
  const isLoading = useAppStore((state) => state.isLoading);
  const refreshAll = useAppStore((state) => state.refreshAll);
  const removeProblem = useAppStore((state) => state.removeProblem);
  const changeProblemStatus = useAppStore((state) => state.changeProblemStatus);

  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [withoutIdeasOnly, setWithoutIdeasOnly] = useState(false);

  const fabFloat = useSharedValue(0);
  fabFloat.value = withRepeat(
    withSequence(
      withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })
    ),
    -1,
    false
  );

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fabFloat.value }],
  }));

  const filteredProblems = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    return problems.filter((item) => {
      const created = parseISO(item.created_at);

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (domainFilter !== 'all' && item.domain !== domainFilter) {
        return false;
      }
      if (withoutIdeasOnly && (item.linked_ideas_count ?? 0) > 0) {
        return false;
      }

      if (timeFilter === 'today' && !isToday(created)) {
        return false;
      }
      if (timeFilter === 'week' && created < weekStart) {
        return false;
      }
      if (timeFilter === 'month' && created < monthStart) {
        return false;
      }

      return true;
    });
  }, [domainFilter, problems, statusFilter, timeFilter, withoutIdeasOnly]);

  const sections = useMemo<VaultSection[]>(() => {
    const groups = new Map<string, Problem[]>();

    filteredProblems
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .forEach((problem) => {
        const dateKey = toLocalDateKey(problem.created_at);
        const bucket = groups.get(dateKey) ?? [];
        bucket.push(problem);
        groups.set(dateKey, bucket);
      });

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, data]) => ({
        dateKey,
        title: getDateHeaderLabel(dateKey),
        data,
      }));
  }, [filteredProblems]);

  const subtitleCount = filteredProblems.length;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const openQuickActions = (problem: Problem) => {
    setActiveProblem(problem);
    setActionsOpen(true);
  };

  const confirmDelete = (problem: Problem) => {
    Alert.alert('Delete observation?', 'This will permanently remove this problem from your vault.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeProblem(problem.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Failed to delete problem:', error);
            }
          })();
        },
      },
    ]);
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setDomainFilter('all');
    setTimeFilter('all');
    setWithoutIdeasOnly(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
        <View>
          <Text style={styles.headerTitle}>THE VAULT</Text>
          <Text style={styles.headerSubtitle}>{subtitleCount} problems observed</Text>
        </View>

        <Pressable onPress={() => setFiltersOpen(true)} style={styles.filterButton}>
          <Ionicons color={COLORS.textSecondary} name="options-outline" size={20} />
        </Pressable>
      </View>

      {isLoading && problems.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : filteredProblems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Animated.View style={[styles.emptyIconBubble, fabStyle]}>
            <Text style={styles.emptyIcon}>🔍</Text>
          </Animated.View>
          <Text style={styles.emptyTitle}>Your vault is empty</Text>
          <Text style={styles.emptySubtitle}>
            Start observing problems around you. The world is full of them.
          </Text>
          <Pressable onPress={() => router.push('/problem/editor')}>
            <LinearGradient colors={[COLORS.accent, COLORS.fire]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>OBSERVE YOUR FIRST PROBLEM</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <SectionList
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: 130 + insets.bottom,
            paddingTop: SPACING.md,
          }}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={COLORS.accent} />}
          removeClippedSubviews
          renderItem={({ item }) => (
            <VaultCard
              item={item}
              onAddIdea={() => router.push(`/idea/editor?problemId=${item.id}`)}
              onDelete={() => confirmDelete(item)}
              onLongPress={() => openQuickActions(item)}
              onPress={() => router.push(`/problem/${item.id}`)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.dateHeaderRow}>
              <Text style={styles.dateHeaderText}>{section.title}</Text>
              <View style={styles.dateHeaderLine} />
            </View>
          )}
          sections={sections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}

      <Animated.View style={[styles.fabWrap, { bottom: 96 + insets.bottom }, fabStyle]}>
        <Pressable onPress={() => router.push('/problem/editor')}>
          <LinearGradient colors={[COLORS.accent, COLORS.fire]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.fabButton}>
            <Ionicons color={COLORS.background} name="add" size={28} />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Modal animationType="slide" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}>
        <Pressable onPress={() => setFiltersOpen(false)} style={styles.sheetBackdrop}>
          <Pressable onPress={() => null} style={styles.sheetContainer}>
            <BlurView intensity={30} style={styles.blurSheet} tint="dark">
              <Text style={styles.sheetTitle}>Filters</Text>

              <Text style={styles.sheetLabel}>STATUS</Text>
              <View style={styles.filterRowWrap}>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setStatusFilter(option.value as StatusFilter)}
                    selected={statusFilter === option.value}
                  />
                ))}
              </View>

              <Text style={styles.sheetLabel}>DOMAIN</Text>
              <View style={styles.filterRowWrap}>
                {DOMAIN_FILTER_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setDomainFilter(option.value)}
                    selected={domainFilter === option.value}
                  />
                ))}
              </View>

              <Text style={styles.sheetLabel}>TIME</Text>
              <View style={styles.filterRowWrap}>
                {TIME_FILTER_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setTimeFilter(option.value as TimeFilter)}
                    selected={timeFilter === option.value}
                  />
                ))}
              </View>

              <Text style={styles.sheetLabel}>SPECIAL</Text>
              <View style={styles.filterRowWrap}>
                <FilterChip
                  label="Without Ideas"
                  onPress={() => setWithoutIdeasOnly((prev) => !prev)}
                  selected={withoutIdeasOnly}
                />
              </View>

              <View style={styles.sheetActionRow}>
                <Pressable onPress={resetFilters}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
                <Pressable onPress={() => setFiltersOpen(false)}>
                  <LinearGradient colors={[COLORS.accent, COLORS.fire]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.applyButton}>
                    <Text style={styles.applyText}>APPLY</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setActionsOpen(false)} transparent visible={actionsOpen}>
        <Pressable onPress={() => setActionsOpen(false)} style={styles.sheetBackdrop}>
          <Pressable onPress={() => null} style={styles.sheetContainer}>
            <BlurView intensity={28} style={styles.blurSheet} tint="dark">
              <Text style={styles.sheetTitle}>Quick Actions</Text>
              {activeProblem ? (
                <>
                  <Pressable
                    onPress={() => {
                      setActionsOpen(false);
                      router.push(`/problem/editor?problemId=${activeProblem.id}`);
                    }}
                    style={styles.quickActionButton}
                  >
                    <Text style={styles.quickActionText}>✏️ Edit</Text>
                  </Pressable>

                  <View style={styles.quickStatusRow}>
                    {(['open', 'exploring', 'solved'] as const).map((status) => (
                      <FilterChip
                        key={status}
                        label={getStatusLabel(status)}
                        onPress={() => {
                          void (async () => {
                            try {
                              await changeProblemStatus(activeProblem.id, status);
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch (error) {
                              console.error('Failed to update status:', error);
                            }
                          })();
                        }}
                        selected={activeProblem.status === status}
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={() => {
                      setActionsOpen(false);
                      router.push(`/idea/editor?problemId=${activeProblem.id}`);
                    }}
                    style={styles.quickActionButton}
                  >
                    <Text style={styles.quickActionText}>💡 Add Idea</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setActionsOpen(false);
                      confirmDelete(activeProblem);
                    }}
                    style={[styles.quickActionButton, styles.quickActionDanger]}
                  >
                    <Text style={[styles.quickActionText, { color: COLORS.danger }]}>🗑️ Delete</Text>
                  </Pressable>
                </>
              ) : null}
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 3,
  },
  headerSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    marginTop: 4,
  },
  filterButton: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateHeaderRow: {
    paddingTop: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateHeaderText: {
    color: COLORS.textTertiary,
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.glassBorder,
  },
  cardOuter: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    overflow: 'hidden',
  },
  cardEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  attentionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
  },
  cardBody: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 16,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: 12,
    lineHeight: 24,
  },
  metaRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaPill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metaPillText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  metaTime: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  metaRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ideaMeta: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  ideaMetaMuted: {
    color: COLORS.textTertiary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 6,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  swipeAction: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderRadius: BORDER_RADIUS.lg,
  },
  swipeActionLeft: {
    backgroundColor: COLORS.accent,
    marginRight: 2,
  },
  swipeActionRight: {
    backgroundColor: COLORS.danger,
    marginLeft: 2,
  },
  swipeActionButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBubble: {
    width: 96,
    height: 96,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: SPACING.xl,
  },
  emptyCta: {
    height: 52,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...SHADOWS.glowAmber,
  },
  emptyCtaText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1.2,
    fontSize: FONT_SIZES.sm,
  },
  fabWrap: {
    position: 'absolute',
    right: SPACING.lg,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glowAmber,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetContainer: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
  },
  blurSheet: {
    backgroundColor: 'rgba(10,10,15,0.82)',
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '82%',
  },
  sheetTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.lg,
    letterSpacing: 0.7,
  },
  sheetLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.4,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  filterRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  filterChipTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  sheetActionRow: {
    marginTop: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  applyButton: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 28,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
  },
  quickActionButton: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: SPACING.sm,
  },
  quickActionDanger: {
    borderColor: 'rgba(255,71,87,0.5)',
  },
  quickActionText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
  },
  quickStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  skeletonWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  skeletonTitle: {
    width: '70%',
    height: 22,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  skeletonSubtitle: {
    width: '45%',
    height: 16,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  skeletonChip: {
    width: 84,
    height: 18,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceLight,
  },
});
