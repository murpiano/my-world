import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/backend/session';
import type { VisibilityKind, VisibilityLevel } from '@/backend/types';
import type { Id } from '@/data/types';
import { shareLink } from './share-link';

const LABEL: Record<VisibilityLevel, string> = {
  private: 'Private — only me',
  link: 'Anyone with the link',
  registered: 'Anyone signed in',
  public: 'Anyone',
};

const LEVELS = Object.keys(LABEL) as VisibilityLevel[];

/**
 * Who may see this one trip, album or photo. Nothing without a backend: sharing needs a server
 * to hold the setting and answer other people's requests, so a browser-only archive has none.
 * The setting is its own small write, apart from the archive's own save.
 */
export function PrivacyField({
  kind,
  itemId,
  accountId,
}: {
  kind: VisibilityKind;
  itemId: Id;
  accountId: string;
}) {
  // one storage for the life of the field: a new one each render would read the setting again
  // after every change, and a read sent before the change lands would undo it on screen
  const storage = useMemo(() => backend()?.storage(accountId), [accountId]);
  // once the owner has picked a level, a first read still on its way is out of date
  const picked = useRef(false);
  const [level, setLevel] = useState<VisibilityLevel>('private');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  useEffect(() => {
    if (!storage) return;
    let live = true;
    storage.getVisibility(kind, itemId).then(
      (setting) => {
        if (!live || picked.current) return;
        setLevel(setting.level);
        setLinkToken(setting.linkToken);
      },
      () => {
        if (live) setTrouble('The sharing setting could not be read.');
      },
    );
    return () => {
      live = false;
    };
  }, [storage, kind, itemId]);

  if (!storage) return null;

  const change = async (next: VisibilityLevel) => {
    const was = level;
    picked.current = true;
    setLevel(next);
    setTrouble(null);
    try {
      const saved = await storage.setVisibility(kind, itemId, next);
      setLinkToken(saved.linkToken);
    } catch {
      setLevel(was);
      setTrouble('The sharing setting could not be saved.');
    }
  };

  const link = shareLink(location.origin, import.meta.env.BASE_URL, accountId, kind, itemId, linkToken);

  return (
    <div className="sheet__field">
      <label htmlFor={`fPrivacy-${itemId}`}>Who can see it</label>
      <select
        id={`fPrivacy-${itemId}`}
        value={level}
        onChange={(event) => void change(event.target.value as VisibilityLevel)}
      >
        {LEVELS.map((one) => (
          <option key={one} value={one}>
            {LABEL[one]}
          </option>
        ))}
      </select>
      {level === 'link' && link && (
        <input readOnly value={link} onFocus={(event) => event.target.select()} />
      )}
      {level === 'link' && link && (
        <button
          type="button"
          className="sheet__btn"
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => setTrouble('The link could not be copied. Take it from the box above.'),
            );
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      )}
      {trouble && <small>{trouble}</small>}
    </div>
  );
}
