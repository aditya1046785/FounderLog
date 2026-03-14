import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  SPACING,
} from '../../src/constants/theme';
import { getIdeaById, IdeaStatus } from '../../src/database/ideaService';
import { getLinkedProblems, linkIdeaToProblem, unlinkIdeaFromProblem } from '../../src/database/linkService';
import { getProblemById } from '../../src/database/problemService';
import { Problem, useAppStore } from '../../src/store/useAppStore';

const SECTION_GAP = 30;

const STATUS_OPTIONS: { value: IdeaStatus; label: string }[] = [
  { value: 'just_idea', label: '💭 Just an Idea' },
  { value: 'researching', label: '🔍 Researching' },
  { value: 'validating', label: '✅ Validating' },
  { value: 'building', label: '🔨 Building' },
  { value: 'dropped', label: '❌ Dropped' },
];

const FEASIBILITY_LABELS: Record<number, string> = {
  1: 'Moonshot 🌙',
  2: 'Challenging 🏔️',
  3: 'Doable 👍',
  4: 'Very Feasible ✅',
  5: 'Easy Win 🎯',
};

const EXCITEMENT_LABELS: Record<number, string> = {
  1: 'Meh 😐',
  2: 'Interesting 🤔',
  3: 'Excited 😄',
  4: 'Very Pumped 💪',
  5: 'OBSESSED 🤩',
};

function formatCapturedTime(iso: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `📅 ${datePart} • ${timePart}`;
}

function formatProblemDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

async function runSelectionHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.error('Selection haptic failed:', error);
  }
}

type PrefillIdea = {
  id: string;
  title: string;
  description: string | null;
  business_model: string | null;
  feasibility: number;
  excitement: number;
  status: IdeaStatus;
  created_at: string;
  linked_problems: Problem[];
};

export default function IdeaEditorScreen() {
  const params = useLocalSearchParams<{ ideaId?: string; id?: string; problemId?: string }>();
  const routeIdeaId = typeof params.ideaId === 'string' ? params.ideaId : params.id;
  const routeProblemId = typeof params.problemId === 'string' ? params.problemId : undefined;
  const isEditMode = Boolean(routeIdeaId);

  const problems = useAppStore((state) => state.problems);
  const addIdea = useAppStore((state) => state.addIdea);
  const editIdea = useAppStore((state) => state.editIdea);
  const removeIdea = useAppStore((state) => state.removeIdea);
  const refreshAll = useAppStore((state) => state.refreshAll);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [businessModel, setBusinessModel] = useState('');
  const [feasibility, setFeasibility] = useState(0);
  const [excitement, setExcitement] = useState(0);
  const [status, setStatus] = useState<IdeaStatus>('just_idea');
  const [linkedProblems, setLinkedProblems] = useState<Problem[]>([]);
  const [capturedAtIso, setCapturedAtIso] = useState(new Date().toISOString());
  const [titleFocused, setTitleFocused] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorDraftIds, setSelectorDraftIds] = useState<string[]>([]);
  const [fetchedIdea, setFetchedIdea] = useState<PrefillIdea | null>(null);
  const [fallbackProblem, setFallbackProblem] = useState<Problem | null>(null);

  const richEditorRef = useRef<RichEditor>(null);
  const saveScale = useRef(new Animated.Value(1)).current;
  const titleShake = useRef(new Animated.Value(0)).current;
  const feasibilityLabelOpacity = useRef(new Animated.Value(1)).current;
  const excitementLabelOpacity = useRef(new Animated.Value(1)).current;
  const prefilledRef = useRef(false);
  const initialLinkedIdsRef = useRef<string[]>([]);

  const richActions: actions[] = [
    actions.setBold,
    actions.setItalic,
    actions.setUnderline,
    actions.setStrikethrough,
    actions.heading1,
    actions.heading2,
    actions.insertBulletsList,
    actions.insertOrderedList,
    actions.checkboxList,
    actions.blockquote,
    actions.code,
    actions.hiliteColor,
    actions.insertLink,
    actions.undo,
    actions.redo,
  ];

  const iconMap: Record<string, ({ tintColor }: { tintColor: string }) => ReactElement> = {
    [actions.setBold]: ({ tintColor }) => <Ionicons color={tintColor} name="text" size={19} />,
    [actions.setItalic]: ({ tintColor }) => <Ionicons color={tintColor} name="text-outline" size={19} />,
    [actions.setUnderline]: ({ tintColor }) => <Ionicons color={tintColor} name="remove-outline" size={19} />,
    [actions.setStrikethrough]: ({ tintColor }) => <Ionicons color={tintColor} name="remove-circle-outline" size={19} />,
    [actions.heading1]: ({ tintColor }) => <Text style={[styles.toolbarTextIcon, { color: tintColor }]}>H1</Text>,
    [actions.heading2]: ({ tintColor }) => <Text style={[styles.toolbarTextIcon, { color: tintColor }]}>H2</Text>,
    [actions.insertBulletsList]: ({ tintColor }) => <Ionicons color={tintColor} name="list-outline" size={20} />,
    [actions.insertOrderedList]: ({ tintColor }) => <Ionicons color={tintColor} name="list-circle-outline" size={20} />,
    [actions.checkboxList]: ({ tintColor }) => <Ionicons color={tintColor} name="checkbox-outline" size={19} />,
    [actions.blockquote]: ({ tintColor }) => <Ionicons color={tintColor} name="chatbox-ellipses-outline" size={19} />,
    [actions.code]: ({ tintColor }) => <Ionicons color={tintColor} name="code-slash-outline" size={20} />,
    [actions.hiliteColor]: ({ tintColor }) => <Ionicons color={tintColor} name="color-wand-outline" size={19} />,
    [actions.insertLink]: ({ tintColor }) => <Ionicons color={tintColor} name="link-outline" size={19} />,
    [actions.undo]: ({ tintColor }) => <Ionicons color={tintColor} name="arrow-undo-outline" size={19} />,
    [actions.redo]: ({ tintColor }) => <Ionicons color={tintColor} name="arrow-redo-outline" size={19} />,
  };

  const displayCaptureText = useMemo(() => formatCapturedTime(capturedAtIso), [capturedAtIso]);
  const linkedProblemIds = useMemo(() => linkedProblems.map((item) => item.id), [linkedProblems]);

  const allAvailableProblems = useMemo(() => {
    const byId = new Map<string, Problem>();
    for (const problem of problems) {
      byId.set(problem.id, problem);
    }
    for (const problem of linkedProblems) {
      byId.set(problem.id, problem);
    }
    if (fallbackProblem) {
      byId.set(fallbackProblem.id, fallbackProblem);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [fallbackProblem, linkedProblems, problems]);

  const filteredProblems = useMemo(() => {
    const search = selectorSearch.trim().toLowerCase();
    if (!search) {
      return allAvailableProblems;
    }

    return allAvailableProblems.filter((problem) => {
      return (
        problem.title.toLowerCase().includes(search) ||
        (problem.domain ?? '').toLowerCase().includes(search) ||
        formatProblemDate(problem.created_at).toLowerCase().includes(search)
      );
    });
  }, [allAvailableProblems, selectorSearch]);

  const feasibilityLabel = feasibility > 0 ? FEASIBILITY_LABELS[feasibility] : 'Tap to rate';
  const excitementLabel = excitement > 0 ? EXCITEMENT_LABELS[excitement] : 'Tap to rate';

  useEffect(() => {
    if (isEditMode || prefilledRef.current) {
      return;
    }

    const interval = setInterval(() => {
      setCapturedAtIso(new Date().toISOString());
    }, 30000);

    return () => clearInterval(interval);
  }, [isEditMode]);

  useEffect(() => {
    if (!routeIdeaId) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const [idea, linked] = await Promise.all([getIdeaById(routeIdeaId), getLinkedProblems(routeIdeaId)]);
        if (!mounted || !idea) {
          return;
        }

        setFetchedIdea({
          id: idea.id,
          title: idea.title,
          description: idea.description,
          business_model: idea.business_model,
          feasibility: idea.feasibility,
          excitement: idea.excitement,
          status: idea.status,
          created_at: idea.created_at,
          linked_problems: linked,
        });
      } catch (error) {
        console.error('Failed to load idea for editing:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [routeIdeaId]);

  useEffect(() => {
    if (isEditMode || !routeProblemId) {
      return;
    }

    const fromStore = problems.find((item) => item.id === routeProblemId);
    if (fromStore) {
      setLinkedProblems((prev) => (prev.some((item) => item.id === fromStore.id) ? prev : [fromStore, ...prev]));
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const problem = await getProblemById(routeProblemId);
        if (!mounted || !problem) {
          return;
        }
        setFallbackProblem(problem);
        setLinkedProblems((prev) => (prev.some((item) => item.id === problem.id) ? prev : [problem, ...prev]));
      } catch (error) {
        console.error('Failed to load linked problem from route params:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isEditMode, problems, routeProblemId]);

  useEffect(() => {
    if (!fetchedIdea || prefilledRef.current) {
      return;
    }

    prefilledRef.current = true;
    setTitle(fetchedIdea.title);
    setDescription(fetchedIdea.description ?? '');
    setBusinessModel(fetchedIdea.business_model ?? '');
    setFeasibility(fetchedIdea.feasibility);
    setExcitement(fetchedIdea.excitement);
    setStatus(fetchedIdea.status);
    setCapturedAtIso(fetchedIdea.created_at);
    setLinkedProblems(fetchedIdea.linked_problems);
    initialLinkedIdsRef.current = fetchedIdea.linked_problems.map((item) => item.id);

    if (fetchedIdea.description) {
      setTimeout(() => {
        richEditorRef.current?.setContentHTML(fetchedIdea.description ?? '');
      }, 0);
    }
  }, [fetchedIdea]);

  const openProblemSelector = () => {
    setSelectorSearch('');
    setSelectorDraftIds(linkedProblemIds);
    setSelectorVisible(true);
  };

  const closeProblemSelector = () => {
    setSelectorVisible(false);
  };

  const toggleDraftProblem = async (problemId: string) => {
    setSelectorDraftIds((prev) =>
      prev.includes(problemId) ? prev.filter((item) => item !== problemId) : [...prev, problemId]
    );
    await runSelectionHaptic();
  };

  const commitProblemSelection = async () => {
    const selected = allAvailableProblems.filter((problem) => selectorDraftIds.includes(problem.id));
    const selectedOnlyFromLinked = linkedProblems.filter((problem) => selectorDraftIds.includes(problem.id));
    const dedupedById = new Map<string, Problem>();
    for (const problem of selected) {
      dedupedById.set(problem.id, problem);
    }
    for (const problem of selectedOnlyFromLinked) {
      dedupedById.set(problem.id, problem);
    }

    setLinkedProblems(Array.from(dedupedById.values()));
    setSelectorVisible(false);
    await runSelectionHaptic();
  };

  const removeLinkedProblem = async (problemId: string) => {
    setLinkedProblems((prev) => prev.filter((item) => item.id !== problemId));
    await runSelectionHaptic();
  };

  const animateTitleError = () => {
    setTitleError(true);
    titleShake.setValue(0);
    Animated.sequence([
      Animated.timing(titleShake, { toValue: 10, duration: 65, useNativeDriver: true }),
      Animated.timing(titleShake, { toValue: -8, duration: 65, useNativeDriver: true }),
      Animated.timing(titleShake, { toValue: 6, duration: 65, useNativeDriver: true }),
      Animated.timing(titleShake, { toValue: 0, duration: 65, useNativeDriver: true }),
    ]).start();
  };

  const runLabelFade = (value: Animated.Value) => {
    value.setValue(0.35);
    Animated.timing(value, {
      toValue: 1,
      duration: 170,
      useNativeDriver: true,
    }).start();
  };

  const setFeasibilityValue = async (value: number) => {
    setFeasibility(value);
    runLabelFade(feasibilityLabelOpacity);
    await runSelectionHaptic();
  };

  const setExcitementValue = async (value: number) => {
    setExcitement(value);
    runLabelFade(excitementLabelOpacity);
    await runSelectionHaptic();
  };

  const handlePressSaveIn = () => {
    Animated.spring(saveScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 35,
      bounciness: 2,
    }).start();
  };

  const handlePressSaveOut = () => {
    Animated.spring(saveScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const persistIdea = async () => {
    if (isSaving) {
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      animateTitleError();
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.error('Warning haptic failed:', error);
      }
      return;
    }

    setTitleError(false);
    setIsSaving(true);

    try {
      const payload = {
        title: trimmedTitle,
        description: description.trim() ? description : null,
        business_model: businessModel.trim() ? businessModel : null,
        feasibility,
        excitement,
        status,
      };

      if (isEditMode && routeIdeaId) {
        await editIdea(routeIdeaId, payload);

        const nextIds = linkedProblemIds;
        const prevIds = initialLinkedIdsRef.current;
        const toLink = nextIds.filter((id) => !prevIds.includes(id));
        const toUnlink = prevIds.filter((id) => !nextIds.includes(id));

        await Promise.all([
          ...toLink.map((problemId) => linkIdeaToProblem(routeIdeaId, problemId)),
          ...toUnlink.map((problemId) => unlinkIdeaFromProblem(routeIdeaId, problemId)),
        ]);

        initialLinkedIdsRef.current = nextIds;
        await refreshAll();
      } else {
        await addIdea(payload, linkedProblemIds);
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Success haptic failed:', error);
      }

      router.back();
    } catch (error) {
      console.error('Failed to save idea:', error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  const handleSave = () => {
    if (linkedProblemIds.length > 0) {
      void persistIdea();
      return;
    }

    Alert.alert('No problem linked. Are you sure?', 'Linking a problem helps you track why this idea matters.', [
      {
        text: 'Link',
        onPress: () => {
          openProblemSelector();
        },
      },
      {
        text: 'Continue',
        style: 'default',
        onPress: () => {
          void persistIdea();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDelete = () => {
    if (!routeIdeaId) {
      return;
    }

    Alert.alert('Delete idea?', 'This will permanently remove this idea and its problem links.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeIdea(routeIdeaId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        style={styles.keyboardRoot}
      >
        <View style={styles.root}>
          <View style={styles.bgGlowTop} />
          <View style={styles.bgGlowBottom} />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerIconButton}>
                <Ionicons color={COLORS.textSecondary} name="close" size={22} />
              </Pressable>

              <Text style={styles.headerTitle}>IDEATE</Text>

              {isEditMode ? (
                <Pressable hitSlop={12} onPress={handleDelete} style={styles.headerIconButton}>
                  <Ionicons color={COLORS.danger} name="trash-outline" size={20} />
                </Pressable>
              ) : (
                <View style={styles.headerIconSpacer} />
              )}
            </View>

            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{displayCaptureText}</Text>
            </View>

            <View style={styles.section}>
              <Animated.View style={{ transform: [{ translateX: titleShake }] }}>
                <TextInput
                  maxLength={150}
                  onBlur={() => setTitleFocused(false)}
                  onChangeText={(value) => {
                    setTitle(value);
                    if (titleError && value.trim()) {
                      setTitleError(false);
                    }
                  }}
                  onFocus={() => setTitleFocused(true)}
                  placeholder="What's your solution?"
                  placeholderTextColor={COLORS.textTertiary}
                  style={[
                    styles.titleInput,
                    titleFocused && styles.titleInputFocused,
                    titleError && styles.titleInputError,
                  ]}
                  value={title}
                />
              </Animated.View>
              {title.length > 0 ? <Text style={styles.charCount}>{title.length}/150</Text> : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LINKED TO PROBLEMS</Text>

              {linkedProblems.length > 0 ? (
                <View style={styles.linkedProblemsWrap}>
                  {linkedProblems.map((problem) => (
                    <View key={problem.id} style={styles.linkedProblemCard}>
                      <View style={styles.linkedProblemTextWrap}>
                        <Text numberOfLines={2} style={styles.linkedProblemTitle}>
                          ✅ {problem.title}
                        </Text>
                        <Pressable
                          hitSlop={10}
                          onPress={() => {
                            void removeLinkedProblem(problem.id);
                          }}
                          style={styles.linkedProblemRemoveAction}
                        >
                          <Text style={styles.linkedProblemRemoveText}>✕ remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyLinkedWrap}>
                  <Text style={styles.emptyLinkedText}>No problems linked yet.</Text>
                </View>
              )}

              <Pressable
                onPress={openProblemSelector}
                style={({ pressed }) => [styles.linkAnotherButton, pressed && styles.linkAnotherButtonPressed]}
              >
                <Text style={styles.linkAnotherText}>➕ Link another problem...</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DESCRIBE YOUR IDEA</Text>
              <Text style={styles.sectionHint}>
                How does it work? What makes it different? Who would use it?
              </Text>

              <View style={styles.editorCard}>
                <RichToolbar
                  actions={richActions}
                  editor={richEditorRef}
                  iconMap={iconMap}
                  iconTint={COLORS.textSecondary}
                  selectedButtonStyle={styles.toolbarButtonSelected}
                  selectedIconTint={COLORS.accent}
                  style={styles.toolbar}
                />
                <RichEditor
                  editorStyle={{
                    backgroundColor: 'transparent',
                    color: COLORS.textPrimary,
                    contentCSSText:
                      'font-size: 16px; line-height: 1.6; color: #FFFFFF; padding: 8px 2px 20px 2px; min-height: 200px;',
                    placeholderColor: COLORS.textTertiary,
                  }}
                  initialContentHTML={description}
                  onChange={setDescription}
                  placeholder="Sketch the mechanics, edge, and user journey..."
                  ref={richEditorRef}
                  style={styles.richEditor}
                  useContainer
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>HOW COULD THIS MAKE MONEY?</Text>
                <Text style={styles.optionalText}>(optional)</Text>
              </View>
              <View style={styles.businessCard}>
                <TextInput
                  multiline
                  onChangeText={setBusinessModel}
                  placeholder="Subscription? Marketplace commission? Ads? Think about it..."
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.businessInput}
                  textAlignVertical="top"
                  value={businessModel}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FEASIBILITY</Text>
              <Text style={styles.subLabel}>How realistic is this to build?</Text>
              <View style={styles.ratingRow}>
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;
                  const filled = feasibility >= value;
                  return (
                    <Pressable
                      key={`feasibility-${value}`}
                      onPress={() => {
                        void setFeasibilityValue(value);
                      }}
                      style={styles.ratingButton}
                    >
                      <Text style={[styles.ratingIcon, !filled && styles.ratingIconEmpty]}>{filled ? '⭐' : '☆'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Animated.Text style={[styles.ratingLabel, { opacity: feasibilityLabelOpacity }]}>
                {feasibilityLabel}
              </Animated.Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR EXCITEMENT</Text>
              <Text style={styles.subLabel}>How pumped are you about this?</Text>
              <View style={styles.ratingRow}>
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;
                  const filled = excitement >= value;
                  return (
                    <Pressable
                      key={`excitement-${value}`}
                      onPress={() => {
                        void setExcitementValue(value);
                      }}
                      style={styles.ratingButton}
                    >
                      <Text style={[styles.ratingIcon, !filled && styles.ratingIconEmpty]}>{filled ? '🔥' : '○'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Animated.Text style={[styles.ratingLabel, { opacity: excitementLabelOpacity }]}>
                {excitementLabel}
              </Animated.Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STATUS</Text>
              <View style={styles.statusWrap}>
                {STATUS_OPTIONS.map((option) => {
                  const selected = status === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setStatus(option.value);
                        void runSelectionHaptic();
                      }}
                      style={[styles.statusChip, selected && styles.statusChipSelected]}
                    >
                      <Text style={[styles.statusChipText, selected && styles.statusChipTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Animated.View style={[styles.saveButtonOuter, { transform: [{ scale: saveScale }] }]}>
              <Pressable
                disabled={isSaving}
                onPress={handleSave}
                onPressIn={handlePressSaveIn}
                onPressOut={handlePressSaveOut}
              >
                <LinearGradient
                  colors={[COLORS.accent, COLORS.fire]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>{isEditMode ? 'UPDATE IDEA' : 'SAVE IDEA'}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </ScrollView>

          <Modal
            animationType="fade"
            onRequestClose={closeProblemSelector}
            transparent
            visible={selectorVisible}
          >
            <Pressable onPress={closeProblemSelector} style={styles.modalOverlay}>
              <Pressable onPress={() => undefined} style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Link Problems</Text>

                <View style={styles.searchBox}>
                  <Ionicons color={COLORS.textTertiary} name="search-outline" size={18} />
                  <TextInput
                    onChangeText={setSelectorSearch}
                    placeholder="Search problems..."
                    placeholderTextColor={COLORS.textTertiary}
                    style={styles.searchInput}
                    value={selectorSearch}
                  />
                </View>

                <ScrollView
                  contentContainerStyle={styles.modalListContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {filteredProblems.length === 0 ? (
                    <View style={styles.modalEmptyState}>
                      <Text style={styles.modalEmptyText}>No matching problems found.</Text>
                    </View>
                  ) : (
                    filteredProblems.map((problem) => {
                      const checked = selectorDraftIds.includes(problem.id);
                      return (
                        <Pressable
                          key={problem.id}
                          onPress={() => {
                            void toggleDraftProblem(problem.id);
                          }}
                          style={styles.problemOptionRow}
                        >
                          <View style={styles.problemOptionMain}>
                            <Text numberOfLines={2} style={styles.problemOptionTitle}>
                              {problem.title}
                            </Text>
                            <View style={styles.problemMetaRow}>
                              <Text style={styles.problemMetaText}>{formatProblemDate(problem.created_at)}</Text>
                              {problem.domain ? (
                                <View style={styles.problemDomainChip}>
                                  <Text style={styles.problemDomainText}>{problem.domain}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Ionicons
                            color={checked ? COLORS.accent : COLORS.textTertiary}
                            name={checked ? 'checkbox' : 'square-outline'}
                            size={22}
                          />
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>

                <Pressable onPress={() => void commitProblemSelection()} style={styles.modalDoneButtonWrap}>
                  <LinearGradient
                    colors={[COLORS.accent, COLORS.fire]}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    style={styles.modalDoneButton}
                  >
                    <Text style={styles.modalDoneText}>Done</Text>
                  </LinearGradient>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -140,
    right: -75,
    width: 290,
    height: 290,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 184, 0, 0.07)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 107, 53, 0.10)',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSpacer: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: 2.3,
  },
  metaPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  metaPillText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  section: {
    marginTop: SECTION_GAP,
  },
  sectionLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.6,
    fontWeight: FONT_WEIGHTS.semibold,
    marginBottom: SPACING.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  optionalText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  subLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    marginTop: -8,
    marginBottom: SPACING.md,
  },
  sectionHint: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  titleInput: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  titleInputFocused: {
    borderBottomColor: COLORS.accent,
  },
  titleInputError: {
    borderBottomColor: COLORS.danger,
  },
  charCount: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  linkedProblemsWrap: {
    gap: SPACING.sm,
  },
  linkedProblemCard: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkedProblemTextWrap: {
    gap: 8,
  },
  linkedProblemTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 20,
  },
  linkedProblemRemoveAction: {
    alignSelf: 'flex-start',
  },
  linkedProblemRemoveText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  emptyLinkedWrap: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  emptyLinkedText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  linkAnotherButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkAnotherButtonPressed: {
    opacity: 0.85,
  },
  linkAnotherText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  editorCard: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  toolbar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  toolbarButtonSelected: {
    backgroundColor: COLORS.accentDim,
    borderRadius: BORDER_RADIUS.sm,
  },
  toolbarTextIcon: {
    fontSize: 13,
    fontWeight: FONT_WEIGHTS.bold,
  },
  richEditor: {
    minHeight: 220,
    backgroundColor: 'transparent',
  },
  businessCard: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 108,
  },
  businessInput: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 108,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ratingButton: {
    paddingVertical: 6,
  },
  ratingIcon: {
    fontSize: 28,
    lineHeight: 32,
    color: COLORS.accent,
  },
  ratingIconEmpty: {
    color: COLORS.textTertiary,
  },
  ratingLabel: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  statusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statusChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    ...SHADOWS.glowAmber,
  },
  statusChipText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusChipTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  saveButtonOuter: {
    marginTop: 36,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.glowAmber,
  },
  saveButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1.4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 5, 8, 0.74)',
  },
  modalSheet: {
    maxHeight: '82%',
    backgroundColor: '#111119',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: SPACING.md,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    paddingVertical: 10,
  },
  modalListContent: {
    paddingBottom: 8,
  },
  modalEmptyState: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  problemOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: SPACING.sm,
  },
  problemOptionMain: {
    flex: 1,
    gap: 8,
  },
  problemOptionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 20,
  },
  problemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  problemMetaText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  problemDomainChip: {
    backgroundColor: COLORS.accentDim,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  problemDomainText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semibold,
    textTransform: 'capitalize',
  },
  modalDoneButtonWrap: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.glowAmber,
  },
  modalDoneButton: {
    height: 50,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.heavy,
    fontSize: FONT_SIZES.sm,
    letterSpacing: 1,
  },
});
