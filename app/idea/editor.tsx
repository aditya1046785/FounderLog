import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONT_SIZES } from '../../src/constants/theme';

export default function IdeaEditorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Idea Editor</Text>
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
});
