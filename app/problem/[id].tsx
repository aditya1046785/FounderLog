import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONT_SIZES } from '../../src/constants/theme';

export default function ProblemDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Problem Detail</Text>
      <Text style={styles.subtext}>ID: {id ?? 'unknown'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
  },
  subtext: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    marginTop: 8,
  },
});
