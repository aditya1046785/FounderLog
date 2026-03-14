import { router, Stack, useLocalSearchParams } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  SPACING,
} from '../../src/constants/theme';
import { Idea, getIdeasForProblem } from '../../src/database/ideaService';
import { unlinkIdeaFromProblem } from '../../src/database/linkService';
import { getProblemById } from '../../src/database/problemService';
import { Problem, useAppStore } from '../../src/store/useAppStore';

type ProblemStatus = 'open' | 'exploring' | 'solved';

const CONTEXT_META: Record<string, string> = {
  street: '🏪 Street',
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

const FREQUENCY_META: Record<string, string> = {
  rare: '🔄 Rarely',
  sometimes: '🔄 Sometimes',
  often: '🔄 Often',
  daily: '🔄 Daily',
};

function getProblemStatusColor(status: ProblemStatus): string {
  if (status === 'open') {
    return COLORS.statusOpen;
  }
  if (status === 'exploring') {
    return COLORS.statusExploring;
  }
  return COLORS.statusSolved;
}

function getProblemStatusLabel(status: ProblemStatus): string {
  if (status === 'open') {
    return 'Open';
  }
  if (status === 'exploring') {
    return 'Exploring';
  }
  return 'Solved';
}

function getIdeaStatusMeta(status: Idea['status']): { label: string; color: string } {
  if (status === 'researching') {
    return { label: 'Researching', color: COLORS.statusExploring };
  }
  if (status === 'validating') {
    return { label: 'Validating', color: COLORS.info };
  }
  if (status === 'building') {
    return { label: 'Building', color: COLORS.statusSolved };
  }
  if (status === 'dropped') {
    return { label: 'Dropped', color: COLORS.danger };
  }
  return { label: 'Just Idea', color: COLORS.textSecondary };
}

function renderStars(value: number): string {
  const clamped = Math.min(5, Math.max(0, value));
  return `${'⭐'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`;
}

function renderFire(value: number): string {
  const clamped = Math.min(5, Math.max(0, value));
  return `${'🔥'.repeat(clamped)}${'○'.repeat(5 - clamped)}`;
}

function buildDescriptionHtml(content: string): string {
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
        font-size: 16px;
        line-height: 1.6;
      }
      p { margin: 0 0 14px 0; }
      h1, h2, h3, h4 { margin: 10px 0 12px 0; color: ${COLORS.textPrimary}; }
      ul, ol { padding-left: 22px; margin: 0 0 14px 0; }
      li { margin-bottom: 7px; }
      blockquote {
        margin: 12px 0;
        padding: 8px 12px;
        border-left: 3px solid rgba(255, 184, 0, 0.38);
        background: rgba(255, 255, 255, 0.03);
      }
      code, pre {
        background: ${COLORS.surfaceLight};
        color: ${COLORS.textPrimary};
        border-radius: 8px;
      }
      pre {
        padding: 10px;
        overflow-x: auto;
      }
      a { color: ${COLORS.accent}; text-decoration: none; }
      img, video { max-width: 100%; border-radius: 8px; }
    </style>
  </head>
  <body>
    ${content || '<p></p>'}
    <script>
      const postSize = () => {
        const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(h));
      };
      setTimeout(postSize, 40);
      setTimeout(postSize, 240);
      window.addEventListener('load', postSize);
    </script>
  </body>
</html>
`;
}

export default function ProblemDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const problems = useAppStore((state) => state.problems);
  const removeProblem = useAppStore((state) => state.removeProblem);
  const changeProblemStatus = useAppStore((state) => state.changeProblemStatus);
  const removeIdea = useAppStore((state) => state.removeIdea);
  const refreshAll = useAppStore((state) => state.refreshAll);

  const [fallbackProblem, setFallbackProblem] = useState<Problem | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [expandedIdeaIds, setExpandedIdeaIds] = useState<string[]>([]);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [ideaActionsVisible, setIdeaActionsVisible] = useState(false);
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const [descriptionHeight, setDescriptionHeight] = useState(220);
  const [optimisticStatus, setOptimisticStatus] = useState<ProblemStatus | null>(null);

  const storeProblem = useMemo(() => problems.find((item) => item.id === id) ?? null, [problems, id]);
  const problem = storeProblem ?? fallbackProblem;
  const resolvedStatus = (optimisticStatus ?? problem?.status ?? 'open') as ProblemStatus;
  const statusColor = getProblemStatusColor(resolvedStatus);

  useEffect(() => {
    if (!id || storeProblem) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const loaded = await getProblemById(id);
        if (mounted && loaded) {
          setFallbackProblem(loaded);
        }
      } catch (error) {
        console.error('Failed to load problem detail from database:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, storeProblem]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const linkedIdeas = await getIdeasForProblem(id);
        if (mounted) {
          setIdeas(linkedIdeas);
        }
      } catch (error) {
        console.error('Failed to load linked ideas for problem:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, problems]);

  if (!id || !problem) {
    return (
      <View style={styles.stateRoot}>
        <Text style={styles.stateTitle}>Problem not found</Text>
        <Pressable onPress={() => router.back()} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const createdDate = format(parseISO(problem.created_at), 'd MMM yyyy, h:mm a');
  const isEdited = problem.updated_at !== problem.created_at;
  const contextText = problem.context ? CONTEXT_META[problem.context] ?? `❓ ${problem.context}` : null;
  const domainText = problem.domain ? DOMAIN_META[problem.domain] ?? `🏷️ ${problem.domain}` : null;
  const frequencyText = problem.frequency ? FREQUENCY_META[problem.frequency] ?? `🔄 ${problem.frequency}` : null;
  const descriptionHtml = buildDescriptionHtml(problem.description ?? '<p>No details captured yet.</p>');

  const handleDeleteProblem = () => {
    Alert.alert('Delete this problem?', 'This will also remove all idea links.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeProblem(problem.id);
              router.back();
            } catch (error) {
              console.error('Failed to delete problem:', error);
            }
          })();
        },
      },
    ]);
  };

  const handleChangeStatus = (status: ProblemStatus) => {
    setStatusSheetVisible(false);
    setOptimisticStatus(status);
    void (async () => {
      try {
        await changeProblemStatus(problem.id, status);
      } catch (error) {
        console.error('Failed to update problem status:', error);
      } finally {
        await refreshAll();
        setOptimisticStatus(null);
      }
    })();
  };

  const reloadIdeas = async () => {
    try {
      const linkedIdeas = await getIdeasForProblem(problem.id);
      setIdeas(linkedIdeas);
    } catch (error) {
      console.error('Failed to reload linked ideas:', error);
    }
  };

  const toggleIdeaExpansion = (ideaId: string) => {
    setExpandedIdeaIds((prev) =>
      prev.includes(ideaId) ? prev.filter((item) => item !== ideaId) : [...prev, ideaId]
    );
  };

  const handleIdeaLongPress = (idea: Idea) => {
    setActiveIdea(idea);
    setIdeaActionsVisible(true);
  };

  const unlinkIdea = () => {
    if (!activeIdea) {
      return;
    }

    setIdeaActionsVisible(false);
    void (async () => {
      try {
        await unlinkIdeaFromProblem(activeIdea.id, problem.id);
        await refreshAll();
        await reloadIdeas();
      } catch (error) {
        console.error('Failed to unlink idea:', error);
      }
    })();
  };

  const deleteIdeaAndRefresh = () => {
    if (!activeIdea) {
      return;
    }

    setIdeaActionsVisible(false);
    Alert.alert('Delete this idea?', 'This will remove the idea completely.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeIdea(activeIdea.id);
              await refreshAll();
              await reloadIdeas();
            } catch (error) {
              console.error('Failed to delete idea:', error);
            }
          })();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable hitSlop={8} onPress={() => router.back()} style={styles.headerIconButton}>
              <Ionicons color={COLORS.textSecondary} name="arrow-back" size={21} />
            </Pressable>

            <View style={styles.headerRightActions}>
              <Pressable
                hitSlop={8}
                onPress={() => router.push(`/problem/editor?id=${problem.id}`)}
                style={styles.actionPill}
              >
                <Ionicons color={COLORS.textSecondary} name="create-outline" size={18} />
              </Pressable>
              <Pressable hitSlop={8} onPress={handleDeleteProblem} style={styles.actionPill}>
                <Ionicons color={COLORS.danger} name="trash-outline" size={18} />
              </Pressable>
            </View>
          </View>

          <LinearGradient
            colors={[`${statusColor}22`, `${statusColor}10`, 'rgba(255,255,255,0.02)']}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={styles.statusBanner}
          >
            <View style={styles.statusLeftGroup}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{getProblemStatusLabel(resolvedStatus)}</Text>
            </View>

            <Pressable onPress={() => setStatusSheetVisible(true)}>
              <Text style={styles.changeStatusText}>Change ▾</Text>
            </Pressable>
          </LinearGradient>

          <View style={styles.titleSection}>
            <Text style={styles.problemTitle}>{problem.title}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.problemDate}>{createdDate}</Text>
              {isEdited ? <Text style={styles.editedTag}>(edited)</Text> : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            {contextText ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{contextText}</Text>
              </View>
            ) : null}
            {domainText ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{domainText}</Text>
              </View>
            ) : null}
            {frequencyText ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{frequencyText}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionLabel}>WHO FACES THIS</Text>
            <View style={styles.audienceRow}>
              {problem.who_faces.length > 0 ? (
                problem.who_faces.map((audience) => (
                  <View key={audience} style={styles.audienceChip}>
                    <Text style={styles.audienceChipText}>{audience}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>No audience tags yet.</Text>
              )}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.journalHeading}>THE PROBLEM</Text>
            <View style={styles.descriptionContainer}>
              <View style={styles.descriptionAccentLine} />
              <WebView
                javaScriptEnabled
                onMessage={(event) => {
                  const nextHeight = Number(event.nativeEvent.data);
                  if (!Number.isNaN(nextHeight) && nextHeight > 20) {
                    setDescriptionHeight(nextHeight);
                  }
                }}
                originWhitelist={['*']}
                scrollEnabled={false}
                source={{ html: descriptionHtml }}
                style={[styles.descriptionWebView, { height: descriptionHeight }]}
              />
            </View>

            {problem.custom_tags.length > 0 ? (
              <View style={styles.tagsRow}>
                {problem.custom_tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.solutionDividerWrap}>
            <LinearGradient
              colors={['rgba(255,184,0,0)', 'rgba(255,184,0,0.75)', 'rgba(255,184,0,0)']}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={styles.solutionDivider}
            />
          </View>

          <View style={styles.sectionWrap}>
            <View style={styles.ideaSectionHeader}>
              <Text style={styles.ideaSectionTitle}>💡 ATTACHED IDEAS</Text>
              <View style={styles.ideaCountBadge}>
                <Text style={styles.ideaCountText}>({ideas.length})</Text>
              </View>
            </View>

            {ideas.length > 0 ? (
              ideas.map((idea) => {
                const statusMeta = getIdeaStatusMeta(idea.status);
                const isExpanded = expandedIdeaIds.includes(idea.id);

                return (
                  <Pressable
                    key={idea.id}
                    onLongPress={() => handleIdeaLongPress(idea)}
                    onPress={() => toggleIdeaExpansion(idea.id)}
                    style={styles.ideaCard}
                  >
                    <Text style={styles.ideaTitle}>{idea.title}</Text>

                    <View style={styles.ratingRow}>
                      <View>
                        <Text style={styles.ratingText}>{renderStars(idea.feasibility)}</Text>
                        <Text style={styles.ratingLabel}>Feasibility</Text>
                      </View>
                      <View>
                        <Text style={styles.ratingText}>{renderFire(idea.excitement)}</Text>
                        <Text style={styles.ratingLabel}>Excitement</Text>
                      </View>
                    </View>

                    <View style={styles.ideaMetaRow}>
                      <View style={styles.ideaStatusPill}>
                        <View style={[styles.ideaStatusDot, { backgroundColor: statusMeta.color }]} />
                        <Text style={[styles.ideaStatusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                      </View>
                      <Text style={styles.ideaDate}>📅 {format(parseISO(idea.created_at), 'd MMM yyyy')}</Text>
                    </View>

                    {isExpanded ? (
                      <View style={styles.ideaExpandedContent}>
                        <Text style={styles.ideaExpandedText}>{idea.description || 'No description provided yet.'}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.ideaEmptyState}>
                <Text style={styles.ideaEmptyIcon}>💡</Text>
                <Text style={styles.ideaEmptyTitle}>No ideas yet for this problem</Text>
                <Text style={styles.ideaEmptySubtitle}>
                  Every problem is an opportunity. What&apos;s your solution?
                </Text>
                <Pressable onPress={() => router.push(`/idea/editor?problemId=${problem.id}`)} style={styles.ideaEmptyButton}>
                  <Text style={styles.ideaEmptyButtonText}>WRITE AN IDEA</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={() => router.push(`/idea/editor?problemId=${problem.id}`)} style={styles.addIdeaButton}>
              <Text style={styles.addIdeaButtonText}>➕ ADD NEW IDEA</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <Modal animationType="slide" onRequestClose={() => setStatusSheetVisible(false)} transparent visible={statusSheetVisible}>
        <Pressable onPress={() => setStatusSheetVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={() => null} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Change Status</Text>
            {(['open', 'exploring', 'solved'] as const).map((status) => {
              const color = getProblemStatusColor(status);
              return (
                <Pressable key={status} onPress={() => handleChangeStatus(status)} style={styles.modalOption}>
                  <View style={[styles.modalOptionDot, { backgroundColor: color }]} />
                  <Text style={[styles.modalOptionText, { color }]}>{getProblemStatusLabel(status)}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setIdeaActionsVisible(false)} transparent visible={ideaActionsVisible}>
        <Pressable onPress={() => setIdeaActionsVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={() => null} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Idea Actions</Text>
            <Pressable
              onPress={() => {
                if (activeIdea) {
                  router.push(`/idea/editor?id=${activeIdea.id}&problemId=${problem.id}`);
                }
                setIdeaActionsVisible(false);
              }}
              style={styles.quickActionOption}
            >
              <Text style={styles.quickActionLabel}>✏️ Edit Idea</Text>
            </Pressable>

            <Pressable onPress={unlinkIdea} style={styles.quickActionOption}>
              <Text style={styles.quickActionLabel}>🔗 Unlink from this problem</Text>
            </Pressable>

            <Pressable onPress={deleteIdeaAndRefresh} style={[styles.quickActionOption, styles.quickActionDanger]}>
              <Text style={[styles.quickActionLabel, { color: COLORS.danger }]}>🗑️ Delete Idea</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 130,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPill: {
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 8,
  },
  statusText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  changeStatusText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  titleSection: {
    marginTop: SPACING.lg,
  },
  problemTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 42,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  problemDate: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  editedTag: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  metaRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  metaChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sectionWrap: {
    marginTop: 30,
  },
  sectionLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.4,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: 10,
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceChip: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  audienceChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    textTransform: 'capitalize',
  },
  mutedText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  journalHeading: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    letterSpacing: 2,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: SPACING.md,
  },
  descriptionContainer: {
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  descriptionAccentLine: {
    width: 2,
    backgroundColor: 'rgba(255,184,0,0.4)',
  },
  descriptionWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tagsRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  solutionDividerWrap: {
    marginTop: 32,
    marginBottom: 10,
  },
  solutionDivider: {
    height: 1,
    width: '100%',
  },
  ideaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ideaSectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
  },
  ideaCountBadge: {
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ideaCountText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  ideaCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 12,
  },
  ideaTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: 12,
    lineHeight: 22,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ratingText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    marginBottom: 4,
  },
  ratingLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  ideaMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ideaStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ideaStatusDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 6,
  },
  ideaStatusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  ideaDate: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  ideaExpandedContent: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    paddingTop: 10,
  },
  ideaExpandedText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 21,
  },
  ideaEmptyState: {
    marginTop: 8,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  ideaEmptyIcon: {
    fontSize: 38,
    opacity: 0.4,
    marginBottom: 12,
  },
  ideaEmptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: 6,
  },
  ideaEmptySubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  ideaEmptyButton: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(255,184,0,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ideaEmptyButtonText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.8,
  },
  addIdeaButton: {
    marginTop: 6,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(255,184,0,0.08)',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glowAmber,
  },
  addIdeaButtonText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1.1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: 12,
  },
  modalOption: {
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionDot: {
    width: 9,
    height: 9,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 9,
  },
  modalOptionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  quickActionOption: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quickActionDanger: {
    borderColor: 'rgba(255,71,87,0.4)',
  },
  quickActionLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
  },
  stateRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  stateTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: 12,
  },
  ghostButton: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.glassBg,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ghostButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
});
