import { useState } from 'react';
import type { Archive } from '@/data/archive';
import type { PickedPlace } from '@/data/places';
import { friendlyError } from '@/backend/account';
import { backend } from '@/backend/session';
import { repository } from '@/state/owner';
import { saveAccount, userStore } from '@/state/user';
import { BackupBox } from './BackupBox';
import { ConfirmButton } from './ConfirmButton';
import { accountProblem, handleProblem } from './fields';
import { PlaceField } from './PlaceField';
import { Acts, Sheet } from './Sheet';

/** Name, email, a new password twice, the home base, and a way back to the demo. */
export function AccountForm({ archive, onClose }: { archive: Archive; onClose: () => void }) {
  const user = userStore.get().user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [home, setHome] = useState<PickedPlace | null>(user?.home ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const problem =
    accountProblem({
      name,
      email,
      password: pass,
      again,
      home,
      passwordOptional: true,
    }) ?? handleProblem(handle);
  const submit = async () => {
    if (problem || !home || busy) return;
    const { name: city, country, countryId, lat, lon } = home;
    const auth = backend()?.auth;
    const wanted = handle.trim().toLowerCase();
    const fields = {
      name: name.trim(),
      email: email.trim(),
      home: { name: city, country, countryId, lat, lon },
      ...(auth && wanted && wanted !== user.handle ? { handle: wanted } : {}),
    };
    if (auth) {
      setBusy(true);
      setError(null);
      try {
        await auth.update({ ...fields, ...(pass ? { password: pass } : {}) });
      } catch (failure) {
        setBusy(false);
        setError(friendlyError(failure instanceof Error ? failure.message : String(failure)));
        return;
      }
    } else {
      saveAccount(fields);
    }
    onClose();
    // the home base moves the house on the globe and every flight that starts from it
    location.reload();
  };

  return (
    <Sheet
      title="Account"
      lead="Your home base is where every trip starts and comes back to, unless a trip says otherwise."
      onClose={onClose}
    >
      <label className="sheet__field" htmlFor="fName">
        Name
        <input
          id="fName"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="sheet__field" htmlFor="fMail">
        Email
        <input
          id="fMail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {backend() && (
        <label className="sheet__field" htmlFor="fHandle">
          Public handle
          <input
            id="fHandle"
            value={handle}
            placeholder="your-name"
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
          />
          <small>Your shared trips live at /u/{handle.trim() || 'your-name'}</small>
        </label>
      )}
      <div className="sheet__row">
        <label className="sheet__field" htmlFor="fPass">
          New password
          <input
            id="fPass"
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(event) => setPass(event.target.value)}
          />
        </label>
        <label className="sheet__field" htmlFor="fPass2">
          Repeat it
          <input
            id="fPass2"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
        </label>
      </div>
      <PlaceField id="fHome" label="Home base" archive={archive} value={home} onPick={setHome} />
      <BackupBox archive={archive} />
      <Acts>
        <ConfirmButton
          label="Reset archive to the demo"
          ask="Lose every change?"
          onConfirm={() => {
            void repository()
              ?.clear()
              .then(() => location.reload());
          }}
        />
        <button type="button" className="sheet__btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="sheet__btn is-main"
          disabled={problem !== null || busy}
          onClick={() => void submit()}
        >
          Save
        </button>
      </Acts>
      <p className="sheet__note">
        {error ??
          problem ??
          (backend()
            ? 'Changing the email sends a link to confirm it.'
            : 'The password is not stored anywhere yet.')}
      </p>
    </Sheet>
  );
}
