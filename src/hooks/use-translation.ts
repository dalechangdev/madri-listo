import { useSyncExternalStore } from 'react';

import { getSnapshot, subscribe, type Translator } from '@/i18n';

/**
 * The current UI language and the helpers bound to it. Components must get `t`
 * from here rather than importing a global: the returned functions change
 * identity when the language changes, which is what makes screens (and the
 * React Compiler's memoised output) re-render in the new language.
 */
export function useTranslation(): Translator {
  return useSyncExternalStore(subscribe, getSnapshot);
}
