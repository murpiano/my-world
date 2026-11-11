import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArchiveData } from '@/data/types';
import type { Repository } from '@/data/repository';
import { editArchive } from '@/state/owner';

/**
 * Runs an edit and closes the sheet when it lands. When storage says no, the sheet stays open
 * with a line saying so: an edit that was not kept must never look as if it was.
 */
export const useEdit = (onClose: () => void) => {
  const { t: tr } = useTranslation();
  const [trouble, setTrouble] = useState<string | null>(null);
  const run = (fn: (data: ArchiveData, repo: Repository) => void | Promise<void>) => {
    void editArchive(fn).then(onClose, () => setTrouble(tr('forms.editFailed')));
  };
  return { trouble, run };
};
