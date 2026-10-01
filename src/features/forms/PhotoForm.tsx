import { useState } from 'react';
import type { World } from '@/app/boot';
import { removePhoto, setCaption } from '@/data/edits';
import { photoUrl } from '@/data/photos';
import { photoKey, photoNote } from '@/data/social';

import { ConfirmButton } from './ConfirmButton';
import { PrivacyField } from './PrivacyField';
import { Acts, Sheet } from './Sheet';
import { useEdit } from './useEdit';

/** One photo: its own line, or away with it. */
export function PhotoForm({
  world,
  albumId,
  photoKey: key,
  onClose,
}: {
  world: World;
  albumId: string;
  photoKey: string;
  onClose: () => void;
}) {
  const album = world.archive.albumById.get(albumId);
  const photo = album?.photos.find((one) => photoKey(one) === key);
  const [caption, setText] = useState(photo?.caption ?? '');
  const { trouble, run } = useEdit(onClose);
  if (!photo) return null;
  const url = photoUrl(photo);

  return (
    <Sheet title="Edit photo" onClose={onClose}>
      {url && <img className="sheet__pic" src={url} alt="" />}
      <label className="sheet__field" htmlFor="fCap">
        Caption
        <textarea
          id="fCap"
          placeholder={photoNote(photo)}
          value={caption}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {photo.kind === 'own' && world.accountId && (
        <PrivacyField kind="photo" itemId={photo.id} accountId={world.accountId} />
      )}
      <Acts>
        <ConfirmButton
          label="Delete photo"
          ask="Delete it from the album?"
          onConfirm={() => {
            run(async (data, repo) => {
              const gone = removePhoto(data, albumId, key);
              if (gone) await repo.dropPhotos([gone]);
            });
          }}
        />
        <button type="button" className="sheet__btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="sheet__btn is-main"
          onClick={() => {
            run((data) => setCaption(data, albumId, key, caption));
          }}
        >
          Save
        </button>
      </Acts>
      {trouble && <p className="sheet__note">{trouble}</p>}
    </Sheet>
  );
}
