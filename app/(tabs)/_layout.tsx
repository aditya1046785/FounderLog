import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
} from '../../src/constants/theme';

type IconNamePair = {
  outline: keyof typeof Ionicons.glyphMap;
  sharp: keyof typeof Ionicons.glyphMap;
};

function TabIcon({ focused, color, names }: { focused: boolean; color: string; names: IconNamePair }) {
  return (
    <View style={styles.iconContainer}>
      {focused ? (
        <LinearGradient
          colors={[COLORS.accentDim, COLORS.accent, COLORS.accentDim]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.activeHighlight}
        />
      ) : null}
      <Ionicons color={color} name={focused ? names.sharp : names.outline} size={22} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + SPACING.sm,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.navInactive,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mission Control',
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={[
                styles.label,
                { color, fontWeight: focused ? FONT_WEIGHTS.bold : FONT_WEIGHTS.regular },
              ]}
            >
              Mission Control
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon color={color} focused={focused} names={{ outline: 'planet-outline', sharp: 'planet-sharp' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'The Vault',
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={[
                styles.label,
                { color, fontWeight: focused ? FONT_WEIGHTS.bold : FONT_WEIGHTS.regular },
              ]}
            >
              The Vault
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon color={color} focused={focused} names={{ outline: 'layers-outline', sharp: 'layers-sharp' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          title: 'Ideas',
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={[
                styles.label,
                { color, fontWeight: focused ? FONT_WEIGHTS.bold : FONT_WEIGHTS.regular },
              ]}
            >
              Ideas
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon color={color} focused={focused} names={{ outline: 'bulb-outline', sharp: 'bulb-sharp' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="mirror"
        options={{
          title: 'The Mirror',
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={[
                styles.label,
                { color, fontWeight: focused ? FONT_WEIGHTS.bold : FONT_WEIGHTS.regular },
              ]}
            >
              The Mirror
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon color={color} focused={focused} names={{ outline: 'analytics-outline', sharp: 'analytics-sharp' }} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: COLORS.navBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: SPACING.sm,
  },
  tabItem: {
    paddingTop: SPACING.xs,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 24,
  },
  activeHighlight: {
    position: 'absolute',
    top: -5,
    width: 26,
    height: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  label: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    lineHeight: 16,
  },
});
