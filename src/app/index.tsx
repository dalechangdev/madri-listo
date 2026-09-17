import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryFilterBar } from '@/components/map/category-filter-bar';
import { ResourceDetailSheet } from '@/components/map/resource-detail-sheet';
import { ResourceMarker } from '@/components/map/resource-marker';
import { AVAILABLE_CATEGORIES, type CategoryId } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { getResourceById } from '@/data/repository';
import type { MapMarker, ResourceRecord } from '@/data/types';
import { useLocation } from '@/hooks/use-location';
import { useMapMarkers } from '@/hooks/use-map-markers';
import { useSync } from '@/hooks/use-sync';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Puerta del Sol at walking scale (~1.7km across) rather than the whole city.
 * A citywide opening view puts thousands of points on screen at once, which
 * buries the user's own position and isn't actionable — you can't walk to a
 * defibrillator 8km away in an emergency.
 */
const INITIAL_REGION: Region = {
  latitude: 40.4168,
  longitude: -3.7038,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

/** Zoom applied when recentring on the user. */
const USER_REGION_DELTA = 0.02;

/** How far a cluster tap zooms in. */
const CLUSTER_ZOOM_FACTOR = 0.35;

export default function MapScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const sync = useSync();
  const location = useLocation();

  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([
    ...AVAILABLE_CATEGORIES,
  ]);
  const [selected, setSelected] = useState<ResourceRecord | null>(null);

  const { markers, loading, tooFarOut } = useMapMarkers(
    region,
    selectedCategories,
    sync.ready,
  );

  // Recentre on the user once, the first time a fix arrives. A ref rather than
  // state so a later fix (or a re-render) never yanks the map back while the
  // user is panning.
  const hasCentredRef = useRef(false);
  useEffect(() => {
    if (hasCentredRef.current || !location.coords) return;
    hasCentredRef.current = true;
    mapRef.current?.animateToRegion(
      {
        ...location.coords,
        latitudeDelta: USER_REGION_DELTA,
        longitudeDelta: USER_REGION_DELTA,
      },
      600,
    );
  }, [location.coords]);

  const visibleCount = useMemo(
    () =>
      markers.reduce(
        (total, marker) => total + (marker.kind === 'cluster' ? marker.count : 1),
        0,
      ),
    [markers],
  );

  const toggleCategory = useCallback((category: CategoryId) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((id) => id !== category)
        : [...current, category],
    );
  }, []);

  const handleMarkerPress = useCallback((marker: MapMarker) => {
    if (marker.kind === 'cluster') {
      // Zoom toward the cluster rather than opening anything.
      mapRef.current?.animateToRegion(
        {
          latitude: marker.latitude,
          longitude: marker.longitude,
          latitudeDelta: Math.max(region.latitudeDelta * CLUSTER_ZOOM_FACTOR, 0.001),
          longitudeDelta: Math.max(region.longitudeDelta * CLUSTER_ZOOM_FACTOR, 0.001),
        },
        350,
      );
      return;
    }
    void getResourceById(marker.id).then(setSelected);
  }, [region.latitudeDelta, region.longitudeDelta]);

  const handleLocate = useCallback(async () => {
    if (location.granted !== true) await location.request();
    const coords = location.coords;
    if (!coords) return;
    mapRef.current?.animateToRegion(
      {
        ...coords,
        latitudeDelta: USER_REGION_DELTA,
        longitudeDelta: USER_REGION_DELTA,
      },
      400,
    );
  }, [location]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={setRegion}
        onPress={() => setSelected(null)}
        showsUserLocation={location.granted === true}
        showsMyLocationButton={false}
        toolbarEnabled={false}>
        {markers.map((marker) => (
          <ResourceMarker
            key={marker.id}
            marker={marker}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <CategoryFilterBar
          available={AVAILABLE_CATEGORIES}
          selected={selectedCategories}
          onToggle={toggleCategory}
        />
        <StatusPill
          busy={sync.busy || loading}
          label={
            sync.busy
              ? t(`sync.${sync.progress?.phase ?? 'downloading'}`)
              : sync.error
                ? t('sync.failed')
                : tooFarOut
                  ? t('map.zoomToExpand')
                  : t('map.resultsInView', { count: visibleCount })
          }
        />
      </View>

      <Pressable
        onPress={handleLocate}
        accessibilityRole="button"
        accessibilityLabel={t('map.locate')}
        style={[
          styles.locateButton,
          { backgroundColor: colors.background, bottom: insets.bottom + 96 },
        ]}>
        <Text style={styles.locateGlyph}>◎</Text>
      </Pressable>

      <ResourceDetailSheet
        resource={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

/** Small floating capsule reporting sync/query state without blocking the map. */
function StatusPill({ busy, label }: { busy: boolean; label: string }) {
  const colors = useTheme();
  return (
    <View style={styles.pillRow}>
      <View style={[styles.pill, { backgroundColor: colors.background }]}>
        {busy && <ActivityIndicator size="small" color={colors.textSecondary} />}
        <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  pillRow: { alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  locateButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  locateGlyph: { fontSize: 22 },
});
