import { useEffect, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { getDataset } from '@/data/datasets';
import { resourceTitle } from '@/data/display';
import type { ResourceRecord } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
  resource: ResourceRecord | null;
  distanceMeters?: number | null;
  onClose: () => void;
};

/** Opens the platform's native maps app with a driving/walking destination. */
function openDirections(resource: ResourceRecord, title: string) {
  const { latitude, longitude } = resource;
  const label = encodeURIComponent(title);
  const url = Platform.select({
    ios: `maps://app?daddr=${latitude},${longitude}&q=${label}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  });
  void Linking.openURL(url);
}

function DetailRow({
  label,
  value,
  valueLanguage,
}: {
  label: string;
  value: string;
  /** Set when the value is source text, so screen readers pronounce it right. */
  valueLanguage?: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        accessibilityLanguage={valueLanguage}
        style={[styles.rowValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Slide-up detail panel for a single resource. Rendered above the map rather
 * than in a modal so the pin stays visible while reading.
 */
export function ResourceDetailSheet({
  resource,
  distanceMeters,
  onClose,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { language, t, formatDistance } = useTranslation();
  // Created once via lazy initial state; reading a ref during render is not
  // allowed under the React Compiler.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(slide, {
      toValue: resource ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.7,
    }).start();
  }, [resource, slide]);

  // Keep the outgoing resource on screen through the dismiss animation, rather
  // than blanking the sheet the instant it starts sliding away. This is React's
  // "adjust state during render" pattern: the extra render is immediate and
  // never commits the intermediate result.
  const [shown, setShown] = useState<ResourceRecord | null>(resource);
  if (resource && resource !== shown) setShown(resource);

  if (!shown) return null;

  const meta = CATEGORIES[shown.category];
  const dataset = getDataset(shown.datasetId);
  const title = resourceTitle(shown, t);
  const sourceLanguage = dataset?.sourceLanguage;
  // Source text is shown as published; say so when it isn't in the UI language.
  const showSourceLanguageNote =
    sourceLanguage != null &&
    sourceLanguage !== language &&
    Boolean(shown.detail || shown.schedule || shown.subtype);

  // Feeds where every row is the same kind of thing carry no per-record type,
  // so fall back to the dataset's own label — which has the advantage of being
  // translated, unlike the source data.
  const typeLabel =
    shown.subtype ?? (dataset?.typeLabelKey ? t(dataset.typeLabelKey) : null);

  return (
    <Animated.View
      pointerEvents={resource ? 'auto' : 'none'}
      style={[
        styles.sheet,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + Spacing.four,
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [400, 0],
              }),
            },
          ],
        },
      ]}>
      <View style={[styles.grabber, { backgroundColor: colors.backgroundSelected }]} />

      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Text style={styles.badgeGlyph}>{meta.glyph}</Text>
        </View>
        <View style={styles.headerText}>
          <Text
            // Only a source-provided name is in the source language; the
            // fallback title is already translated.
            accessibilityLanguage={shown.name ? sourceLanguage : undefined}
            style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          {(shown.address || distanceMeters != null) && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {[
                shown.address,
                distanceMeters != null ? formatDistance(distanceMeters) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('detail.close')}
          hitSlop={12}
          style={[styles.close, { backgroundColor: colors.backgroundElement }]}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {showSourceLanguageNote && (
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            {t('detail.sourceLanguageNote', {
              language: t(`languages.${sourceLanguage}`),
            })}
          </Text>
        )}
        {shown.detail && (
          <DetailRow
            // What the free-text field means varies by feed: a placement note
            // for defibrillators, a service list for municipal facilities.
            label={t(dataset?.detailLabelKey ?? 'detail.placement')}
            value={shown.detail}
            valueLanguage={sourceLanguage}
          />
        )}
        {shown.schedule && (
          <DetailRow
            label={t('detail.schedule')}
            value={shown.schedule}
            valueLanguage={sourceLanguage}
          />
        )}
        {typeLabel && (
          <DetailRow
            label={t('detail.type')}
            value={typeLabel}
            valueLanguage={shown.subtype ? sourceLanguage : undefined}
          />
        )}
        {dataset && (
          <DetailRow
            label={t('detail.source')}
            value={`${dataset.attribution.publisher} · ${dataset.attribution.license}`}
          />
        )}
        {shown.url && (
          <Pressable
            onPress={() => void Linking.openURL(shown.url!)}
            accessibilityRole="link"
            style={styles.link}>
            <Text style={[styles.linkLabel, { color: meta.color }]}>
              {t('detail.moreInfo')} ↗
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable
        onPress={() => openDirections(shown, title)}
        accessibilityRole="button"
        style={[styles.action, { backgroundColor: meta.color }]}>
        <Text style={styles.actionLabel}>{t('detail.directions')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 18, color: '#ffffff' },
  headerText: { flex: 1, gap: Spacing.half },
  title: { fontSize: 19, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { gap: Spacing.three, paddingVertical: Spacing.one },
  row: { gap: Spacing.half },
  rowLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 15, lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  link: { paddingVertical: Spacing.one },
  linkLabel: { fontSize: 15, fontWeight: '600' },
  action: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  actionLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
