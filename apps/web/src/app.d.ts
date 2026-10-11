import type { SupportedLocale } from '@simple-strike/i18n';

declare global {
  namespace App {
    interface Locals {
      locale: SupportedLocale;
    }
  }
}

export {};
