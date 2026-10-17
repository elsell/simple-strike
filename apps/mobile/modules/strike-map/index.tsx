import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export type MapCoordinate = { latitude: number; longitude: number };
export type MapStrike = MapCoordinate & { id: string };
export type MapRing = MapCoordinate & { id: string; radiusMeters: number; opacity: number; lineWidth: number; fillOpacity: number };
export type StrikeMapProps = ViewProps & {
  center: MapCoordinate;
  radiusMeters: number;
  strikes: MapStrike[];
  rings: MapRing[];
  locationEnabled?: boolean;
  onLocation?: (event: { nativeEvent: MapCoordinate }) => void;
  onLocationState?: (event: { nativeEvent: { state: string } }) => void;
  onExplore?: (event: { nativeEvent: MapCoordinate }) => void;
};
const StrikeMap = requireNativeView<StrikeMapProps>('StrikeMap');
export default StrikeMap;
