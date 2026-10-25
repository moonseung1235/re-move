import type { Preferences } from '../types';
/** Diagnosis documents and their filenames are device-local, including on sync. */
export function cloudPreferences(preferences: Preferences): Preferences {
  if (!preferences.rehabilitation) return { ...preferences };
  const rehabilitation = { ...preferences.rehabilitation };
  delete rehabilitation.attachment;
  return { ...preferences, rehabilitation };
}
