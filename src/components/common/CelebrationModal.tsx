import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BORDER_RADIUS, COLORS, FONT_SIZES, FONT_WEIGHTS, SHADOWS, SPACING } from '../../constants/theme';

export type CelebrationType = 'streak' | 'problem' | 'daily' | 'first';

export type CelebrationItem = {
  id: string;
  type: CelebrationType;
  title: string;
  subtitle: string;
  points: number;
  ctaLabel?: string;
};

type Props = {
  celebration: CelebrationItem | null;
  visible: boolean;
  onDismiss: () => void;
};

const PARTICLE_COUNT = 12;

function Particle({ angle, progress }: { angle: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const travel = 48;
    const drift = interpolate(progress.value, [0, 1], [0, travel]);
    const x = Math.cos(angle) * drift;
    const y = Math.sin(angle) * drift;
    return {
      opacity: interpolate(progress.value, [0, 1], [0.8, 0]),
      transform: [{ translateX: x }, { translateY: y }, { scale: interpolate(progress.value, [0, 1], [0.6, 1.2]) }],
    };
  });

  return <Animated.View style={[styles.particle, style]} />;
}

function getEmoji(type: CelebrationType): string {
  if (type === 'streak') {
    return '🔥';
  }
  if (type === 'problem') {
    return '🎯';
  }
  if (type === 'daily') {
    return '🎉';
  }
  return '🚀';
}

export default function CelebrationModal({ celebration, visible, onDismiss }: Props) {
  const pulse = useSharedValue(0);
  const pointsPop = useSharedValue(0);
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        id: `particle-${index}`,
        angle: (Math.PI * 2 * index) / PARTICLE_COUNT,
      })),
    []
  );

  useEffect(() => {
    if (!visible || !celebration) {
      return;
    }

    pulse.value = 0;
    pointsPop.value = 0;

    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })),
      -1,
      false
    );

    pointsPop.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.8)),
    });

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [celebration, onDismiss, pointsPop, pulse, visible]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.14]) }],
  }));

  const pointsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pointsPop.value, [0, 1], [0.75, 1]) }],
    opacity: pointsPop.value,
  }));

  if (!celebration) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {particles.map((particle) => (
            <Particle key={particle.id} angle={particle.angle} progress={pulse} />
          ))}

          <Animated.Text style={[styles.emoji, emojiStyle]}>{getEmoji(celebration.type)}</Animated.Text>
          <Text style={styles.title}>{celebration.title}</Text>
          <Text style={styles.subtitle}>{celebration.subtitle}</Text>

          <Animated.Text style={[styles.points, pointsStyle]}>+{celebration.points} POINTS</Animated.Text>

          <Pressable onPress={onDismiss}>
            <LinearGradient colors={[COLORS.accent, COLORS.fire]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.ctaButton}>
              <Text style={styles.ctaText}>{celebration.ctaLabel ?? 'KEEP GOING'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  card: {
    width: '100%',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.45)',
    backgroundColor: 'rgba(20,20,31,0.92)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.glowAmber,
  },
  particle: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    width: 6,
    height: 6,
    marginLeft: -3,
    marginTop: -3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  emoji: {
    fontSize: 52,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.heavy,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  points: {
    marginTop: SPACING.lg,
    color: COLORS.accent,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
  },
  ctaButton: {
    marginTop: SPACING.xl,
    minWidth: 180,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  ctaText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: 1,
  },
});
