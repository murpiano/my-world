import { useRef, useState } from 'react';
import styles from './DropZone.module.css';

/** Photos to add: dropped on the zone, or chosen from the file dialog. */
export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    const files = [...(list ?? [])].filter((file) => file.type.startsWith('image/'));
    if (files.length) onFiles(files);
  };

  return (
    <button
      type="button"
      className={`${styles.drop}${over ? ` ${styles.isOver}` : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      Drop photos here, or click to choose
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
    </button>
  );
}
