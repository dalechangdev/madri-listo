import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { CATEGORIES } from '@/constants/categories';
import { resourceTitle } from '@/data/display';
import type { MapMarker } from '@/data/types';
import { useTranslation } from '@/hooks/use-translation';
import type { Translator } from '@/i18n';

type Props = {
  marker: MapMarker;
  onPress: (marker: MapMarker) => void;
};

/**
 * Scales a cluster bubble with its population, on a log curve so a
 * 2000-strong cluster doesn't swallow the screen.
 */
function bubbleSize(count: number): number {
  return Math.min(64, 30 + Math.log10(count) * 14);
}

function ResourceMarkerComponent({ marker, onPress }: Props) {
  const meta = CATEGORIES[marker.category];
  const { t, formatNumber } = useTranslation();

  // Custom marker views render blank on Android if view tracking is disabled
  // before the first layout pass. Track for one frame, then switch it off so
  // panning doesn't re-rasterise every bubble.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(timer);
  }, [marker.id]);

  const isCluster = marker.kind === 'cluster';
  const size = isCluster ? bubbleSize(marker.count) : 28;

  return (
    <Marker
      coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
      onPress={() => onPress(marker)}
      tracksViewChanges={tracksViewChanges}
      accessibilityLabel={
        isCluster
          ? t('map.clusterLabel', {
              category: t(meta.labelKey),
              count: marker.count,
            })
          : resourceTitle(marker, t)
      }
      // Centre the custom view on the actual coordinate.
      anchor={{ x: 0.5, y: 0.5 }}>
      <View
        style={[
          styles.bubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: meta.color,
          },
        ]}>
        <Text
          style={[styles.label, { fontSize: isCluster ? 13 : 14 }]}
          numberOfLines={1}>
          {isCluster ? formatCount(marker.count, formatNumber) : meta.glyph}
        </Text>
      </View>
    </Marker>
  );
}

/** 1240 -> "1.2k" ("1,2k" in Spanish), keeping bubbles narrow. */
function formatCount(
  count: number,
  formatNumber: Translator['formatNumber'],
): string {
  return count >= 1000 ? `${formatNumber(count / 1000, 1)}k` : String(count);
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  label: { color: '#ffffff', fontWeight: '700' },
});

export const ResourceMarker = memo(ResourceMarkerComponent);
