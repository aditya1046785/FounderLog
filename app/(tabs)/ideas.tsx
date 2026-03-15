import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  GestureResponderEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  SPACING,
} from '../../src/constants/theme';
import { getLinkedProblems } from '../../src/database/linkService';
import { Idea, Problem, useAppStore } from '../../src/store/useAppStore';

type SortOption = 'newest' | 'feasibility' | 'excitement' | 'connected';
type IdeaFilter = 'all' | Idea['status'];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Highest Feasibility', value: 'feasibility' },
  { label: 'Most Exciting', value: 'excitement' },
  { label: 'Most Connected', value: 'connected' },
];

const FILTER_OPTIONS: { label: string; value: IdeaFilter }[] = [
  { label: 'All', value: 'all' },
  { label: '💭 Just Ideas', value: 'just_idea' },
  { label: '🔍 Researching', value: 'researching' },
  { label: '✅ Validating', value: 'validating' },
  { label: '🔨 Building', value: 'building' },
  { label: '❌ Dropped', value: 'dropped' },
];

function getStatusMeta(status: Idea['status']): { label: string; dot: string } {
  if (status === 'researching') {
    return { label: 'Researching', dot: COLORS.info };
  }
  if (status === 'validating') {
    return { label: 'Validating', dot: COLORS.accent };
  }
  if (status === 'building') {
    return { label: 'Building', dot: COLORS.success };
  }
  if (status === 'dropped') {
    return { label: 'Dropped', dot: COLORS.danger };
  }
  return { label: 'Just an Idea', dot: COLORS.textTertiary };
}

function renderStars(value: number): string {
  const clamped = Math.max(0, Math.min(5, value));
  return `${'⭐'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`;
}

function renderFire(value: number): string {
  const clamped = Math.max(0, Math.min(5, value));
  return `${'🔥'.repeat(clamped)}${'○'.repeat(5 - clamped)}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function stopEventPropagation(event: GestureResponderEvent): void {
  event.stopPropagation();
}

function buildRichTextHtml(content: string): string {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: ${COLORS.textPrimary};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 15px;
        line-height: 1.6;
      }
      p { margin: 0 0 12px 0; }
      h1, h2, h3 { margin: 8px 0 10px 0; }
      ul, ol { padding-left: 22px; margin: 0 0 10px 0; }
      blockquote {
        margin: 10px 0;
        padding: 8px 12px;
        border-left: 3px solid rgba(255, 184, 0, 0.38);
        background: rgba(255, 255, 255, 0.03);
      }
      code, pre {
        background: ${COLORS.surfaceLight};
        color: ${COLORS.textPrimary};
        border-radius: 8px;
      }
      pre { padding: 8px; overflow-x: auto; }
      a { color: ${COLORS.accent}; text-decoration: none; }
    </style>
  </head>
  <body>
    ${content || '<p></p>'}
    <script>
      const postSize = () => {
        const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(h));
      };
      setTimeout(postSize, 50);
      setTimeout(postSize, 260);
      window.addEventListener('load', postSize);
    </script>
  </body>
</html>
`;
}

function stripHtml(input: string | null): string {
  if (!input) {
    return '';
  }
  return input.replace(/<[^>]*>/g, ' ');
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
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

function EmptyIdeasState() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })),
      -1,
      false
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.75]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.05]) }],
  }));

  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={[styles.emptyIconBubble, pulseStyle]}>
        <Text style={styles.emptyIcon}>💡</Text>
      </Animated.View>
      <Text style={styles.emptyTitle}>No ideas yet</Text>
      <Text style={styles.emptySubtitle}>Go to your problems vault and start thinking of solutions</Text>
      <Pressable onPress={() => router.push('/vault')} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>GO TO THE VAULT</Text>
      </Pressable>
    </View>
  );
}

function IdeaCard({
  idea,
  linkedProblems,
  isExpanded,
  linkedExpanded,
  onPressCard,
  onToggleLinked,
  onEdit,
  onDelete,
}: {
  idea: Idea;
  linkedProblems: Problem[];
  isExpanded: boolean;
  linkedExpanded: boolean;
  onPressCard: () => void;
  onToggleLinked: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [webHeight, setWebHeight] = useState(90);
  const statusMeta = getStatusMeta(idea.status);
  const linkedCount = linkedProblems.length || (idea.linked_problems_count ?? 0);
  const isDropped = idea.status === 'dropped';
  const hasDescription = Boolean(idea.description && idea.description.trim());

  const longPressActions = () => {
    Alert.alert('Idea actions', idea.title, [
      { text: 'Edit', onPress: onEdit },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Animated.View layout={LinearTransition.springify().damping(15)} style={[styles.cardOuter, isDropped && styles.cardDropped]}>
      <Pressable onLongPress={longPressActions} onPress={onPressCard} style={styles.cardPressable}>
        <View style={styles.cardHeaderBlock}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {idea.title}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricIcons}>{renderStars(idea.feasibility)}</Text>
              <Text style={styles.metricLabel}>Feasibility</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricIcons}>{renderFire(idea.excitement)}</Text>
              <Text style={styles.metricLabel}>Excitement</Text>
            </View>
          </View>

          <Pressable
            onPress={(event) => {
              stopEventPropagation(event);
              onToggleLinked();
            }}
            style={styles.linkedLineButton}
          >
            <Text style={styles.linkedLineText}>📎 Linked to {linkedCount} problems</Text>
          </Pressable>

          {linkedExpanded && linkedProblems.length > 0 ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(130)} style={styles.inlineLinkedWrap}>
              {linkedProblems.map((problem) => (
                <Pressable
                  key={`${idea.id}-${problem.id}`}
                  onPress={(event) => {
                    stopEventPropagation(event);
                    router.push(`/problem/${problem.id}`);
                  }}
                  style={styles.inlineLinkedChip}
                >
                  <Text numberOfLines={1} style={styles.inlineLinkedChipText}>
                    {problem.title}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}

          <View style={styles.cardFooterRow}>
            <View style={styles.statusChip}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.dot }]} />
              <Text style={[styles.statusChipText, { color: statusMeta.dot }]}>{statusMeta.label}</Text>
            </View>

            <Text style={styles.cardDate}>📅 {formatDate(idea.created_at)}</Text>
          </View>
        </View>
      </Pressable>

      {isExpanded ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition.springify().damping(16)}
          style={styles.expandedWrap}
        >
          {hasDescription ? (
            <View style={styles.richWrap}>
              <WebView
                originWhitelist={['*']}
                onMessage={(event) => {
                  const next = Number.parseFloat(event.nativeEvent.data);
                  if (!Number.isNaN(next) && next > 10) {
                    setWebHeight(Math.min(next + 8, 420));
                  }
                }}
                scrollEnabled={false}
                source={{ html: buildRichTextHtml(idea.description ?? '') }}
                style={[styles.webView, { height: webHeight }]}
              />
            </View>
          ) : (
            <Text style={styles.noDescriptionText}>No detailed description added yet.</Text>
          )}

          {idea.business_model?.trim() ? (
            <View style={styles.businessSection}>
              <Text style={styles.businessLabel}>Business Model</Text>
              <Text style={styles.businessText}>{idea.business_model.trim()}</Text>
            </View>
          ) : null}

          {linkedProblems.length > 0 ? (
            <View style={styles.linkedChipsWrap}>
              {linkedProblems.map((problem) => (
                <Pressable
                  key={`expanded-${idea.id}-${problem.id}`}
                  onPress={() => router.push(`/problem/${problem.id}`)}
                  style={styles.linkedProblemChip}
                >
                  <Text numberOfLines={1} style={styles.linkedProblemChipText}>
                    {problem.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable onPress={onEdit} style={styles.editAction}>
              <Ionicons color={COLORS.textSecondary} name="create-outline" size={17} />
              <Text style={styles.editActionText}>Edit</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={styles.deleteAction}>
              <Ionicons color={COLORS.danger} name="trash-outline" size={17} />
              <Text style={styles.deleteActionText}>Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function IdeasHubScreen() {
  const insets = useSafeAreaInsets();
  const ideas = useAppStore((state) => state.ideas);
  const refreshAll = useAppStore((state) => state.refreshAll);
  const removeIdea = useAppStore((state) => state.removeIdea);
  const isLoading = useAppStore((state) => state.isLoading);

  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [filterBy, setFilterBy] = useState<IdeaFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [linkedExpandedIds, setLinkedExpandedIds] = useState<string[]>([]);
  const [linkedByIdeaId, setLinkedByIdeaId] = useState<Record<string, Problem[]>>({});

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const entries = await Promise.all(
          ideas.map(async (idea) => {
            const linked = await getLinkedProblems(idea.id);
            return [idea.id, linked] as const;
          })
        );

        if (!mounted) {
          return;
        }

        setLinkedByIdeaId(Object.fromEntries(entries));
      } catch (error) {
        console.error('Failed to load linked problems for ideas hub:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ideas]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAndSortedIdeas = useMemo(() => {
    const normalizedSearch = normalize(debouncedSearch);
    const filtered = (filterBy === 'all' ? ideas : ideas.filter((item) => item.status === filterBy)).filter(
      (item) => {
        if (!normalizedSearch) {
          return true;
        }

        const haystack = normalize(
          `${item.title || ''} ${stripHtml(item.description)} ${item.business_model || ''}`
        );
        return haystack.includes(normalizedSearch);
      }
    );
    const sorted = filtered.slice();

    sorted.sort((a, b) => {
      if (sortBy === 'feasibility') {
        return b.feasibility - a.feasibility || b.created_at.localeCompare(a.created_at);
      }
      if (sortBy === 'excitement') {
        return b.excitement - a.excitement || b.created_at.localeCompare(a.created_at);
      }
      if (sortBy === 'connected') {
        const leftCount = linkedByIdeaId[a.id]?.length ?? a.linked_problems_count ?? 0;
        const rightCount = linkedByIdeaId[b.id]?.length ?? b.linked_problems_count ?? 0;
        return rightCount - leftCount || b.created_at.localeCompare(a.created_at);
      }
      return b.created_at.localeCompare(a.created_at);
    });

    return sorted;
  }, [debouncedSearch, filterBy, ideas, linkedByIdeaId, sortBy]);

  const subtitleCount = ideas.length;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpanded = async (ideaId: string) => {
    setExpandedIds((prev) => (prev.includes(ideaId) ? prev.filter((item) => item !== ideaId) : [...prev, ideaId]));
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Expand haptic failed:', error);
    }
  };

  const toggleLinkedExpanded = (ideaId: string) => {
    setLinkedExpandedIds((prev) =>
      prev.includes(ideaId) ? prev.filter((item) => item !== ideaId) : [...prev, ideaId]
    );
  };

  const handleDeleteIdea = (idea: Idea) => {
    Alert.alert('Delete this idea?', 'This will remove the idea and all linked problem connections.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeIdea(idea.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error) {
              console.error('Failed to delete idea:', error);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>IDEAS HUB</Text>
          <Text style={styles.headerSubtitle}>{subtitleCount} ideas generated</Text>
        </View>

        <Pressable onPress={() => setSortSheetVisible(true)} style={styles.sortButton}>
          <Ionicons color={COLORS.textSecondary} name="swap-vertical-outline" size={18} />
          <Text style={styles.sortButtonText}>Sort</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingBottom: 120 + insets.bottom,
          paddingTop: SPACING.md,
        }}
        data={filteredAndSortedIdeas}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isLoading && ideas.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading ideas...</Text>
            </View>
          ) : (
            debouncedSearch ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>No ideas match your search 🤷</Text>
              </View>
            ) : (
              <EmptyIdeasState />
            )
          )
        }
        ListHeaderComponent={
          <View>
            <View style={styles.searchWrap}>
              <Ionicons color={COLORS.textTertiary} name="search-outline" size={18} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search ideas..."
                placeholderTextColor={COLORS.textTertiary}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>
            <ScrollView
              contentContainerStyle={styles.filtersRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {FILTER_OPTIONS.map((item) => (
                <FilterChip
                  key={item.value}
                  label={item.label}
                  onPress={() => setFilterBy(item.value)}
                  selected={filterBy === item.value}
                />
              ))}
            </ScrollView>
          </View>
        }
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={COLORS.accent} />}
        removeClippedSubviews
        renderItem={({ item }) => (
          <IdeaCard
            idea={item}
            isExpanded={expandedIds.includes(item.id)}
            linkedExpanded={linkedExpandedIds.includes(item.id)}
            linkedProblems={linkedByIdeaId[item.id] ?? []}
            onDelete={() => handleDeleteIdea(item)}
            onEdit={() => router.push(`/idea/editor?ideaId=${item.id}`)}
            onPressCard={() => {
              void toggleExpanded(item.id);
            }}
            onToggleLinked={() => toggleLinkedExpanded(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <Pressable onPress={() => router.push('/idea/editor')} style={[styles.plusButton, { bottom: insets.bottom + 88 }]}> 
        <Ionicons color={COLORS.background} name="add" size={20} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setSortSheetVisible(false)}
        transparent
        visible={sortSheetVisible}
      >
        <Pressable onPress={() => setSortSheetVisible(false)} style={styles.modalOverlay}>
          <Pressable onPress={() => undefined} style={styles.sortSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.sortTitle}>Sort Ideas By</Text>

            {SORT_OPTIONS.map((option) => {
              const selected = sortBy === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setSortBy(option.value);
                    setSortSheetVisible(false);
                  }}
                  style={[styles.sortOption, selected && styles.sortOptionSelected]}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected ? <Ionicons color={COLORS.accent} name="checkmark" size={18} /> : null}
                </Pressable>
              );
            })}
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
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 2,
  },
  headerSubtitle: {
    marginTop: 4,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sortButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  filtersRow: {
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchWrap: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.glassBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
  },
  filterChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  cardOuter: {
    backgroundColor: 'rgba(20,20,31,0.9)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.cardShadow,
  },
  cardDropped: {
    opacity: 0.6,
  },
  cardPressable: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardHeaderBlock: {
    gap: SPACING.md,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: 25,
  },
  metricRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  metricIcons: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 19,
  },
  metricLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  linkedLineButton: {
    alignSelf: 'flex-start',
  },
  linkedLineText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  inlineLinkedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -6,
  },
  inlineLinkedChip: {
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineLinkedChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  statusChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  cardDate: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  expandedWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: SPACING.md,
  },
  richWrap: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  noDescriptionText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    fontStyle: 'italic',
  },
  businessSection: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  businessLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.2,
    fontWeight: FONT_WEIGHTS.semibold,
    textTransform: 'uppercase',
  },
  businessText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  linkedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  linkedProblemChip: {
    maxWidth: '100%',
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  linkedProblemChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editActionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.45)',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteActionText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  plusButton: {
    position: 'absolute',
    right: SPACING.lg,
    width: 42,
    height: 42,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    ...SHADOWS.glowAmber,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconBubble: {
    width: 110,
    height: 110,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  emptyButton: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
  },
  emptyButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 5, 8, 0.72)',
  },
  sortSheet: {
    backgroundColor: '#111119',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: SPACING.xl,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: SPACING.md,
  },
  sortTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
  },
  sortOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentDim,
  },
  sortOptionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sortOptionTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
