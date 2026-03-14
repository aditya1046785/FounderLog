import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from '../../src/constants/theme';

export default function MirrorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Mirror</Text>
      <View style={styles.actions}>
        <Link asChild href="/problem/editor">
          <Pressable style={styles.button}>
            <Text style={styles.buttonLabel}>Open Problem Editor</Text>
          </Pressable>
        </Link>
        <Link asChild href="/idea/editor">
          <Pressable style={styles.button}>
            <Text style={styles.buttonLabel}>Open Idea Editor</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xl,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  buttonLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
});
