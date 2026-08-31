import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CATEGORIES, type CategoryId } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Props = {
  available: readonly CategoryId[];
  selected: readonly CategoryId[];
  onToggle: (category: CategoryId) => void;
};

/** Horizontal chip row for switching resource categories on and off. */
export function CategoryFilterBar({ available, selected, onToggle }: Props) {
  const colors = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {available.map((id) => {
        const meta = CATEGORIES[id];
        const isActive = selected.includes(id);
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(meta.labelKey)}
            onPress={() => onToggle(id)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? meta.color : colors.background,
                borderColor: isActive ? meta.color : colors.backgroundSelected,
              },
            ]}>
            <Text style={styles.glyph}>{meta.glyph}</Text>
            <Text
              style={[
                styles.label,
                { color: isActive ? '#ffffff' : colors.text },
              ]}>
              {t(meta.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    // Chips float over the map, so they need to lift off it.
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  glyph: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600' },
});
