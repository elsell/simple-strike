import { requireNativeModule } from 'expo';
import type { MapCoordinate } from './index';
import type { Route, Place, RoutePort, SpeechPort } from '@simple-strike/client-core';
export type DrivingRoute = Route;

type NativeRoutes = {
  speakInstruction(text: string, language: string): Promise<void>;
  stopInstructions(): Promise<void>;
  calculateDrivingRoute(from: MapCoordinate, to: MapCoordinate): Promise<Route>;
  searchPlaces(query: string, near: MapCoordinate): Promise<Place[]>;
};
function nativeRoutes(): NativeRoutes {
  return requireNativeModule<NativeRoutes>('StrikeMap');
}
export function calculateDrivingRoute(origin: MapCoordinate, destination: MapCoordinate): Promise<Route> {
  return nativeRoutes().calculateDrivingRoute(origin, destination);
}
export const mapKitRoutePort: RoutePort = {
  calculate: calculateDrivingRoute,
  search: (query, near) => nativeRoutes().searchPlaces(query, near),
};

export function navigationSpeech(language: string): SpeechPort {
  return {
    speak: text => { void nativeRoutes().speakInstruction(text, language).catch(() => undefined); },
    stop: () => { void nativeRoutes().stopInstructions().catch(() => undefined); },
  };
}
