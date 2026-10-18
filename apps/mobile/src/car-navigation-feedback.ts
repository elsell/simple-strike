import type { GuidanceSnapshot, RoutePreview } from '@simple-strike/client-core';
import type { MessageKey } from '@simple-strike/i18n';

export function carNavigationFeedback(startFailed: boolean, previewError: RoutePreview['error'], guidanceError: GuidanceSnapshot['error']): { key: MessageKey | null; retry: boolean } {
  if (startFailed || previewError === 'location') return { key: 'navigation.locationRequired', retry: false };
  if (guidanceError) return { key: 'navigation.failed', retry: true };
  if (previewError) return { key: 'navigation.failed', retry: false };
  return { key: null, retry: false };
}
