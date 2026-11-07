import { useRef, useState } from 'react';
import type { Archive } from '@/data/archive';
import { makeBackup, readBackup } from '@/data/backup';
import type { Backup } from '@/data/backup';
import { plural } from '@/archive/pages';
import { backend } from '@/backend/session';
import { repository } from '@/state/owner';
import { Acts, Btn, Note } from './Sheet';
import styles from './BackupBox.module.css';

const stamp = () => new Date().toISOString().slice(0, 10);

/** The archive lives in this browser only, so this is how it is kept safe, or moved elsewhere. */
export function BackupBox({ archive }: { archive: Archive }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const save = async () => {
    const repo = repository();
    if (!repo || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await makeBackup(archive.data, (id) => repo.readPhoto(id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-world-backup-${stamp()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNote('The backup is downloaded.');
    } catch {
      setNote('The backup could not be made.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    const backup = readBackup(await file.text());
    if (!backup) {
      setPending(null);
      setNote('That file is not a My World backup.');
      return;
    }
    setPending(backup);
  };

  const restore = async () => {
    const repo = repository();
    if (!repo || !pending || busy) return;
    setBusy(true);
    try {
      await repo.restore(pending.archive, pending.photos);
      location.reload();
    } catch {
      setBusy(false);
      setNote('The backup could not be restored: the browser has no room for it.');
    }
  };

  const kept = pending?.archive.countries
    .flatMap((country) => country.cities)
    .flatMap((city) => city.albums);
  const albums = kept?.length ?? 0;
  const photos = kept?.reduce((sum, album) => sum + album.photos.length, 0) ?? 0;

  return (
    <div className={styles.backup}>
      <h4>Backup</h4>
      <Note>
        {backend()
          ? 'Your archive is kept with your account. Download a copy now and then for yourself.'
          : 'Your archive is kept in this browser only. Download a copy now and then, or to move it to another browser or computer.'}
      </Note>
      {pending ? (
        <Acts className={styles.acts}>
          <span className={styles.ask}>
            Replace everything you have with this backup ({plural(albums, 'album')},{' '}
            {plural(photos, 'photo')})?
          </span>
          <Btn onClick={() => setPending(null)}>Keep mine</Btn>
          <Btn variant="main" disabled={busy} onClick={restore}>
            Replace
          </Btn>
        </Acts>
      ) : (
        <Acts className={styles.acts}>
          <Btn disabled={busy} onClick={save}>
            Download backup
          </Btn>
          <Btn disabled={busy} onClick={() => picker.current?.click()}>
            Restore from backup
          </Btn>
          <input
            ref={picker}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </Acts>
      )}
      {note && <Note>{note}</Note>}
    </div>
  );
}
