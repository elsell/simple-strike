import { createTranslator } from '@simple-strike/i18n';

export type DeviceLocaleReader = () => readonly { languageTag: string }[];

export function createDeviceTranslator(readLocales: DeviceLocaleReader) {
  return createTranslator(readLocales().map(({ languageTag }) => languageTag));
}
