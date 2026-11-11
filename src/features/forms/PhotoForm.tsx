import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { World } from '@/app/boot';
import { removePhoto, setCaption } from '@/data/edits';
import { photoUrl } from '@/data/photos';
import { photoKey, photoNote } from '@/data/social';

import { ConfirmButton } from './ConfirmButton';
import { PrivacyField } from './PrivacyField';
import { Acts, Btn, Field, Note, Sheet } from './Sheet';
import styles from './PhotoForm.module.css';
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
  const { t: tr } = useTranslation();
  const album = world.archive.albumById.get(albumId);
  const photo = album?.photos.find((one) => photoKey(one) === key);
  const [caption, setText] = useState(photo?.caption ?? '');
  const { trouble, run } = useEdit(onClose);
  if (!photo) return null;
  const url = photoUrl(photo);

  return (
    <Sheet title={tr('forms.editPhotoTitle')} onClose={onClose}>
      {/* alt="": the Caption field right below is what this photo is captioned */}
      {url && <img className={styles.pic} src={url} alt="" />}
      <Field label={tr('forms.caption')} htmlFor="fCap">
        <textarea
          id="fCap"
          placeholder={photoNote(photo)}
          value={caption}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      {photo.kind === 'own' && world.accountId && (
        <PrivacyField kind="photo" itemId={photo.id} accountId={world.accountId} />
      )}
      <Acts>
        <ConfirmButton
          label={tr('forms.deletePhoto')}
          ask={tr('forms.deleteFromAlbum')}
          onConfirm={() => {
            run(async (data, repo) => {
              const gone = removePhoto(data, albumId, key);
              if (gone) await repo.dropPhotos([gone]);
            });
          }}
        />
        <Btn onClick={onClose}>{tr('forms.cancel')}</Btn>
        <Btn
          variant="main"
          onClick={() => {
            run((data) => setCaption(data, albumId, key, caption));
          }}
        >
          {tr('forms.save')}
        </Btn>
      </Acts>
      {trouble && <Note>{trouble}</Note>}
    </Sheet>
  );
}
