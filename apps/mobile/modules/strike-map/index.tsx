import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export type MapCoordinate = { latitude: number; longitude: number };
export type MapLocation = MapCoordinate & { accuracyMeters: number; timestampMs: number };
export type MapViewport = MapCoordinate & { radiusMeters: number };
export type MapStrike = MapCoordinate & { id: string };
export type MapRing = MapCoordinate & { id: string; radiusMeters: number; opacity: number; lineWidth: number; fillOpacity: number };
export type StrikeMapProps = ViewProps & {
  center: MapCoordinate;
  radiusMeters: number;
  strikes: MapStrike[];
  rings: MapRing[];
  route?: MapCoordinate[];
  locationEnabled?: boolean;
  onLocation?: (event: { nativeEvent: MapLocation }) => void;
  onLocationState?: (event: { nativeEvent: { state: string } }) => void;
  onExplore?: (event: { nativeEvent: MapViewport }) => void;
};
const StrikeMap = requireNativeView<StrikeMapProps>('StrikeMap');
export default StrikeMap;
