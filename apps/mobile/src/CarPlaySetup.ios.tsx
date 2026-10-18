import type { Translator } from '@simple-strike/i18n';
import { useCarPresentation } from './useCarPresentation.ios';

export default function CarPlaySetup({ translator }: { translator: Translator }) {
  useCarPresentation({
    authorized: false, labels: { phoneSignIn: translator.t('carplay.phoneSignIn') },
    vehicleAvailable: false, vehicle: { latitude: 0, longitude: 0 }, center: { latitude: 0, longitude: 0 },
    radiusMeters: 32186.88, strikes: [], rings: [], route: [], guidancePhase: 'idle', destinationName: '',
    instruction: '', distanceRemainingMeters: 0, expectedTravelSeconds: 0, sourceMode: '', closestText: '',
  });
  return null;
}
