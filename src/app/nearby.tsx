import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ResourceDetailSheet } from '@/components/map/resource-detail-sheet';
import { CATEGORIES, AVAILABLE_CATEGORIES } from '@/constants/categories';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { resourceTitle, sourceLanguageOf } from '@/data/display';
import { queryNearby, type NearbyResult } from '@/data/repository';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

export default function NearbyScreen() {
  const colors = useTheme();
  const { language, t, formatDistance } = useTranslation();
  const location = useLocation();
  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NearbyResult | null>(null);

  const coords = location.coords;

  /** Fetches and stores results. Every state update happens after an await. */
  const load = useCallback(async () => {
    if (!coords) return;
    try {
      const next = await queryNearby(
        coords.latitude,
        coords.longitude,
        AVAILABLE_CATEGORIES,
      );
      setResults(next);
    } finally {
      setLoading(false);
    }
  }, [coords]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Pull-to-refresh: safe to flip the spinner on synchronously from an event. */
  const handleRefresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (location.granted === false || (!location.coords && !location.loading)) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('nearby.needsLocation')}
        </Text>
        <Pressable
          onPress={() => void location.request()}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.background, fontWeight: '700' }}>
            {t('nearby.enableLocation')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={results}
        // Rows only re-render when `data` or `extraData` change, so the
        // formatted distances would otherwise stay in the old language.
        extraData={language}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={[styles.heading, { color: colors.text }]}>
            {t('nearby.title')}
          </Text>
        }
        ListEmptyComponent={
          location.loading || loading ? (
            <ActivityIndicator style={styles.spinner} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('nearby.empty')}
            </Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => {
          const meta = CATEGORIES[item.category];
          const sourceLanguage = sourceLanguageOf(item.datasetId);
          return (
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: colors.backgroundElement }]}>
              <View style={[styles.dot, { backgroundColor: meta.color }]}>
                <Text style={styles.dotGlyph}>{meta.glyph}</Text>
              </View>
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  accessibilityLanguage={item.name ? sourceLanguage : undefined}
                  style={[styles.rowTitle, { color: colors.text }]}>
                  {resourceTitle(item, t)}
                </Text>
                {(item.detail || item.address) && (
                  <Text
                    numberOfLines={1}
                    accessibilityLanguage={sourceLanguage}
                    style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    {item.detail ?? item.address}
                  </Text>
                )}
              </View>
              <Text style={[styles.distance, { color: colors.textSecondary }]}>
                {formatDistance(item.distanceMeters)}
              </Text>
            </Pressable>
          );
        }}
      />

      <ResourceDetailSheet
        resource={selected}
        distanceMeters={selected?.distanceMeters}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dotGlyph: { color: '#ffffff', fontSize: 15 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13 },
  distance: { fontSize: 13, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  spinner: { marginTop: Spacing.five },
  cta: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: 999 },
});
