import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BORDER_RADIUS, COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '../../constants/theme';

type Props = {
  visible: boolean;
  saving: boolean;
  domainOptions: string[];
  onClose: () => void;
  onSave: (title: string, domain: string) => void;
};

const DOMAIN_LABELS: Record<string, string> = {
  tech: 'Tech',
  health: 'Health',
  finance: 'Finance',
  education: 'Education',
  transport: 'Transport',
  food: 'Food',
  lifestyle: 'Lifestyle',
  real_estate: 'Real Estate',
  social: 'Social',
  enterprise: 'Enterprise',
  environment: 'Environment',
  other: 'Other',
};

function toLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain.replace(/_/g, ' ');
}

export default function QuickCaptureSheet({ visible, saving, domainOptions, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('other');

  const slideY = useSharedValue(320);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, { damping: 20, stiffness: 220 });
      backdrop.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      return;
    }

    slideY.value = withTiming(320, { duration: 180, easing: Easing.in(Easing.quad) });
    backdrop.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) });
  }, [backdrop, slideY, visible]);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setSelectedDomain('other');
    }
  }, [visible]);

  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const quickDomains = useMemo(() => {
    const top = domainOptions.filter(Boolean).slice(0, 3);
    if (!top.includes('other')) {
      top.push('other');
    }
    return top;
  }, [domainOptions]);

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed || saving) {
      return;
    }
    onSave(trimmed, selectedDomain || 'other');
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlayRoot}>
          <Animated.View style={[styles.backdrop, animatedBackdrop]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          </Animated.View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
            style={styles.keyboardAvoid}
          >
            <Animated.View style={[styles.sheetWrap, animatedSheet]}>
              <BlurView intensity={35} tint="dark" style={styles.sheetBlur}>
                <Text style={styles.title}>⚡ QUICK CAPTURE</Text>

                <TextInput
                  autoFocus={visible}
                  placeholder="What did you observe? (title only)"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <View style={styles.chipsRow}>
                  {quickDomains.map((domain) => {
                    const selected = selectedDomain === domain;
                    return (
                      <Pressable
                        key={domain}
                        onPress={() => setSelectedDomain(domain)}
                        style={[styles.domainChip, selected && styles.domainChipSelected]}
                      >
                        <Text style={[styles.domainChipText, selected && styles.domainChipTextSelected]}>
                          {toLabel(domain)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable onPress={handleSave} disabled={!title.trim() || saving}>
                  <View style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]}>
                    <Text style={styles.saveButtonText}>CAPTURE ⚡</Text>
                  </View>
                </Pressable>
              </BlurView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheetWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  sheetBlur: {
    minHeight: 250,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  title: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1.2,
  },
  input: {
    marginTop: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chipsRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  domainChip: {
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  domainChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  domainChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    textTransform: 'capitalize',
  },
  domainChipTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  saveButton: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
  },
});
