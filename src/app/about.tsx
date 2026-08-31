import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { DATASETS } from '@/data/datasets';
import { useSync } from '@/hooks/use-sync';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, t } from '@/i18n';

export default function AboutScreen() {
  const colors = useTheme();
  const sync = useSync();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: colors.text }]}>{t('about.title')}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {t('about.intro')}
      </Text>

      <View style={[styles.callout, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.body, { color: colors.text }]}>
          {t('about.disclaimer')}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('about.sources')}
      </Text>

      {DATASETS.map((dataset) => {
        const state = sync.states.find((s) => s.datasetId === dataset.id);
        return (
          <Pressable
            key={dataset.id}
            onPress={() => void Linking.openURL(dataset.attribution.sourceUrl)}
            accessibilityRole="link"
            style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {dataset.attribution.datasetTitle}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {dataset.attribution.publisher} · {dataset.attribution.license}
            </Text>
            {state?.lastSyncedAt != null && (
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {t('sync.lastUpdated', { date: formatDate(state.lastSyncedAt) })} ·{' '}
                {t('sync.recordCount', { count: state.recordCount })}
              </Text>
            )}
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => void sync.refresh(true)}
        disabled={sync.busy}
        accessibilityRole="button"
        style={[
          styles.refresh,
          { backgroundColor: colors.text, opacity: sync.busy ? 0.5 : 1 },
        ]}>
        <Text style={{ color: colors.background, fontWeight: '700' }}>
          {sync.busy
            ? t(`sync.${sync.progress?.phase ?? 'downloading'}`)
            : t('sync.refresh')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  heading: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  body: { fontSize: 15, lineHeight: 22 },
  callout: { padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 13 },
  refresh: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
});
