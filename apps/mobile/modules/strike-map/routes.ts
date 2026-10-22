import { requireNativeModule } from 'expo';
import type { MapCoordinate } from './index';

export type DrivingRoute = {
  id: string;
  distanceMeters: number;
  expectedTravelSeconds: number;
  coordinates: MapCoordinate[];
  steps: { instructions: string; distanceMeters: number; coordinates: MapCoordinate[] }[];
};

export function calculateDrivingRoute(origin: MapCoordinate, destination: MapCoordinate): Promise<DrivingRoute> {
  return requireNativeModule<{
    calculateDrivingRoute(from: MapCoordinate, to: MapCoordinate): Promise<DrivingRoute>;
  }>('StrikeMap').calculateDrivingRoute(origin, destination);
}
