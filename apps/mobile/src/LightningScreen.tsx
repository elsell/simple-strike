import { Text } from 'react-native';
import type { Translator } from '@simple-strike/i18n';

export type LightningScreenProps = {
  apiURL: string;
  token: string;
  translator: Translator;
  onUnauthorized(): void;
};

export default function LightningScreen({ translator }: LightningScreenProps) {
  return <Text>{translator.t('map.iosOnly')}</Text>;
}
