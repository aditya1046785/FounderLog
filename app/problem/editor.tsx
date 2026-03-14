import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
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
import { getProblemById } from '../../src/database/problemService';
import { Problem, useAppStore } from '../../src/store/useAppStore';

type ContextOption = { label: string; value: string };
type DomainOption = { label: string; value: string };
type WhoOption = { label: string; value: string };
type FrequencyOption = {
  label: string;
  value: 'rare' | 'sometimes' | 'often' | 'daily';
  dots: number;
};

const SECTION_GAP = 30;

const CONTEXT_OPTIONS: ContextOption[] = [
  { label: '🛣️ Street', value: 'street' },
  { label: '🏢 Office', value: 'office' },
  { label: '🏠 Home', value: 'home' },
  { label: '💻 Online', value: 'online' },
  { label: '🏪 Market', value: 'market' },
  { label: '🚌 Commute', value: 'commute' },
  { label: '📱 App/Website', value: 'app_website' },
  { label: '❓ Other', value: 'other' },
];

const WHO_OPTIONS: WhoOption[] = [
  { label: '👤 Everyone', value: 'everyone' },
  { label: '🎓 Students', value: 'students' },
  { label: '💼 Workers', value: 'workers' },
  { label: '👨‍👩‍👧 Parents', value: 'parents' },
  { label: '👴 Elderly', value: 'elderly' },
  { label: '🧑‍💻 Developers', value: 'developers' },
  { label: '🏪 Shop Owners', value: 'shop_owners' },
  { label: '🚗 Commuters', value: 'commuters' },
  { label: '🧑‍⚕️ Patients', value: 'patients' },
];

const DOMAIN_OPTIONS: DomainOption[] = [
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
];

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { label: 'Rarely', value: 'rare', dots: 1 },
  { label: 'Sometimes', value: 'sometimes', dots: 2 },
  { label: 'Often', value: 'often', dots: 3 },
  { label: 'Daily', value: 'daily', dots: 1 },
];

function formatObservationTime(iso: string): string {
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

function normalizeToken(raw: string): string {
  return raw.replace(/^#+/, '').trim();
}

async function runSelectionHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.error('Selection haptic failed:', error);
  }
}

export default function ProblemEditorScreen() {
  const params = useLocalSearchParams<{ problemId?: string; id?: string }>();
  const routeProblemId = typeof params.problemId === 'string' ? params.problemId : params.id;
  const isEditMode = Boolean(routeProblemId);

  const problems = useAppStore((state) => state.problems);
  const addProblem = useAppStore((state) => state.addProblem);
  const editProblem = useAppStore((state) => state.editProblem);
  const removeProblem = useAppStore((state) => state.removeProblem);

  const [title, setTitle] = useState('');
  const [context, setContext] = useState<string | null>(null);
  const [whoFaces, setWhoFaces] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<'rare' | 'sometimes' | 'often' | 'daily' | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [customWhoDraft, setCustomWhoDraft] = useState('');
  const [showCustomWhoInput, setShowCustomWhoInput] = useState(false);
  const [capturedAtIso, setCapturedAtIso] = useState(new Date().toISOString());
  const [titleFocused, setTitleFocused] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchedProblem, setFetchedProblem] = useState<Problem | null>(null);

  const saveScale = useRef(new Animated.Value(1)).current;
  const titleShake = useRef(new Animated.Value(0)).current;
  const dailyPulse = useRef(new Animated.Value(1)).current;
  const richEditorRef = useRef<RichEditor>(null);
  const prefilledRef = useRef(false);

  const storeProblem = useMemo(
    () => (routeProblemId ? problems.find((item) => item.id === routeProblemId) ?? null : null),
    [problems, routeProblemId]
  );

  const activeProblem = storeProblem ?? fetchedProblem;
  const knownWhoValues = useMemo(() => new Set(WHO_OPTIONS.map((item) => item.value)), []);

  const customWhoValues = useMemo(
    () => whoFaces.filter((value) => !knownWhoValues.has(value)),
    [knownWhoValues, whoFaces]
  );

  const displayCaptureText = useMemo(() => formatObservationTime(capturedAtIso), [capturedAtIso]);

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
    if (!routeProblemId || storeProblem) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const remote = await getProblemById(routeProblemId);
        if (mounted) {
          setFetchedProblem(remote);
        }
      } catch (error) {
        console.error('Failed to load problem for editing:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [routeProblemId, storeProblem]);

  useEffect(() => {
    if (!activeProblem || prefilledRef.current) {
      return;
    }

    prefilledRef.current = true;
    setTitle(activeProblem.title);
    setContext(activeProblem.context);
    setWhoFaces(activeProblem.who_faces ?? []);
    setFrequency(activeProblem.frequency ?? null);
    setDomain(activeProblem.domain ?? null);
    setDescription(activeProblem.description ?? '');
    setCustomTags(activeProblem.custom_tags ?? []);
    setCapturedAtIso(activeProblem.created_at);

    if (activeProblem.description) {
      setTimeout(() => {
        richEditorRef.current?.setContentHTML(activeProblem.description ?? '');
      }, 0);
    }
  }, [activeProblem]);

  useEffect(() => {
    if (frequency !== 'daily') {
      dailyPulse.stopAnimation();
      dailyPulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(dailyPulse, {
          toValue: 1.35,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dailyPulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [dailyPulse, frequency]);

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

  const addTag = (rawTag: string) => {
    const normalized = normalizeToken(rawTag);
    if (!normalized) {
      return;
    }

    const exists = customTags.some((item) => item.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      setCustomTags((prev) => [...prev, normalized]);
    }
  };

  const flushTagDraft = () => {
    if (!tagDraft.trim()) {
      return;
    }

    addTag(tagDraft);
    setTagDraft('');
  };

  const handleTagInput = (nextValue: string) => {
    const hasBreak = /\s/.test(nextValue);
    if (!hasBreak) {
      setTagDraft(nextValue);
      return;
    }

    const parts = nextValue.split(/\s+/).filter(Boolean);
    const endsWithWhitespace = /\s$/.test(nextValue);
    const finalizedParts = endsWithWhitespace ? parts : parts.slice(0, -1);
    const trailingPart = endsWithWhitespace ? '' : parts.at(-1) ?? '';

    finalizedParts.forEach(addTag);
    setTagDraft(trailingPart);
  };

  const handleAddCustomWho = async () => {
    const normalized = normalizeToken(customWhoDraft);
    if (!normalized) {
      setShowCustomWhoInput(false);
      return;
    }

    const exists = whoFaces.some((item) => item.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      setWhoFaces((prev) => [...prev, normalized]);
    }
    setCustomWhoDraft('');
    setShowCustomWhoInput(false);
    await runSelectionHaptic();
  };

  const toggleWhoFace = async (value: string) => {
    setWhoFaces((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    await runSelectionHaptic();
  };

  const handleSave = async () => {
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
        context,
        who_faces: whoFaces,
        frequency,
        domain,
        custom_tags: customTags,
      };

      if (isEditMode && routeProblemId) {
        await editProblem(routeProblemId, payload);
      } else {
        await addProblem(payload);
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Success haptic failed:', error);
      }

      router.back();
    } catch (error) {
      console.error('Failed to save problem observation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!routeProblemId) {
      return;
    }

    Alert.alert('Delete observation?', 'This will permanently remove this problem note.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeProblem(routeProblemId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              console.error('Failed to delete problem:', error);
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
                <Ionicons color={COLORS.textSecondary} name="arrow-back" size={20} />
              </Pressable>

              <Text style={styles.headerTitle}>OBSERVE</Text>

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
                  placeholder="What did you observe?"
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
              <Text style={styles.sectionLabel}>WHERE?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                {CONTEXT_OPTIONS.map((option) => {
                  const selected = context === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        void runSelectionHaptic();
                        setContext((current) => (current === option.value ? null : option.value));
                      }}
                      style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHO FACES THIS?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                {WHO_OPTIONS.map((option) => {
                  const selected = whoFaces.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        void toggleWhoFace(option.value);
                      }}
                      style={[styles.multiChip, selected && styles.multiChipSelected]}
                    >
                      <Text style={[styles.multiChipText, selected && styles.multiChipTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    setShowCustomWhoInput((prev) => !prev);
                    void runSelectionHaptic();
                  }}
                  style={[styles.multiChip, showCustomWhoInput && styles.multiChipSelected]}
                >
                  <Text style={[styles.multiChipText, showCustomWhoInput && styles.multiChipTextSelected]}>✏️ Custom...</Text>
                </Pressable>
              </ScrollView>

              {showCustomWhoInput ? (
                <View style={styles.inlineInputWrap}>
                  <TextInput
                    onChangeText={setCustomWhoDraft}
                    onSubmitEditing={() => {
                      void handleAddCustomWho();
                    }}
                    placeholder="Add custom audience"
                    placeholderTextColor={COLORS.textTertiary}
                    style={styles.inlineInput}
                    value={customWhoDraft}
                  />
                  <Pressable
                    onPress={() => {
                      void handleAddCustomWho();
                    }}
                    style={styles.inlineAddButton}
                  >
                    <Text style={styles.inlineAddButtonText}>Add</Text>
                  </Pressable>
                </View>
              ) : null}

              {customWhoValues.length > 0 ? (
                <View style={styles.wrapRow}>
                  {customWhoValues.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => {
                        void toggleWhoFace(item);
                      }}
                      style={[styles.multiChip, styles.multiChipSelected]}
                    >
                      <Text style={[styles.multiChipText, styles.multiChipTextSelected]}>✏️ {item} ×</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HOW OFTEN DOES THIS HAPPEN?</Text>
              <View style={styles.frequencyRow}>
                {FREQUENCY_OPTIONS.map((option) => {
                  const selected = frequency === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setFrequency(option.value);
                        void runSelectionHaptic();
                      }}
                      style={[styles.frequencyCard, selected && styles.frequencyCardSelected]}
                    >
                      <View style={styles.frequencyIndicatorRow}>
                        {option.value === 'daily' ? (
                          <Animated.View
                            style={[
                              styles.frequencyDot,
                              selected && styles.frequencyDotSelected,
                              { transform: [{ scale: dailyPulse }] },
                            ]}
                          />
                        ) : (
                          Array.from({ length: option.dots }).map((_, index) => (
                            <View
                              key={`${option.value}-${index}`}
                              style={[styles.frequencyDot, selected && styles.frequencyDotSelected]}
                            />
                          ))
                        )}
                      </View>
                      <Text style={[styles.frequencyText, selected && styles.frequencyTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DOMAIN</Text>
              <View style={styles.wrapRow}>
                {DOMAIN_OPTIONS.map((option) => {
                  const selected = domain === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setDomain((current) => (current === option.value ? null : option.value));
                        void runSelectionHaptic();
                      }}
                      style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DESCRIBE THE PROBLEM</Text>
              <Text style={styles.sectionHint}>
                What exactly happens? Why is it frustrating? What&apos;s the current workaround?
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
                  placeholder="Capture the nuance of what you observed..."
                  ref={richEditorRef}
                  style={styles.richEditor}
                  useContainer
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TAGS</Text>
              <View style={styles.tagInputWrap}>
                <TextInput
                  onBlur={flushTagDraft}
                  onChangeText={handleTagInput}
                  onSubmitEditing={flushTagDraft}
                  placeholder="#add a tag"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.tagInput}
                  value={tagDraft}
                />
              </View>
              {customTags.length > 0 ? (
                <View style={styles.wrapRow}>
                  {customTags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>#{tag}</Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setCustomTags((prev) => prev.filter((item) => item !== tag));
                          void runSelectionHaptic();
                        }}
                      >
                        <Text style={styles.tagRemove}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <Animated.View style={[styles.saveButtonOuter, { transform: [{ scale: saveScale }] }]}
            >
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
                  <Text style={styles.saveButtonText}>{isEditMode ? 'UPDATE OBSERVATION' : 'SAVE OBSERVATION'}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </ScrollView>
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
    top: -130,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 184, 0, 0.06)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSpacer: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: 2.2,
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
  horizontalList: {
    marginHorizontal: -2,
  },
  choiceChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginRight: 10,
  },
  choiceChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    ...SHADOWS.glowAmber,
  },
  choiceChipText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  choiceChipTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  multiChip: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginRight: 10,
  },
  multiChipSelected: {
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  multiChipText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  multiChipTextSelected: {
    color: COLORS.accent,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  inlineInputWrap: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inlineInput: {
    flex: 1,
    backgroundColor: COLORS.glassBg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
  },
  inlineAddButton: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  inlineAddButtonText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  frequencyCard: {
    flex: 1,
    minHeight: 72,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  frequencyCardSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  frequencyIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 10,
  },
  frequencyDot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.textSecondary,
    marginHorizontal: 2,
  },
  frequencyDotSelected: {
    backgroundColor: COLORS.background,
  },
  frequencyText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  frequencyTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
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
  tagInputWrap: {
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
  },
  tagInput: {
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: FONT_SIZES.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  tagRemove: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.md,
    lineHeight: FONT_SIZES.md,
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
});
