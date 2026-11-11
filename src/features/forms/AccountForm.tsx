import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Acts, Btn, Field, Note, Row, Sheet } from './Sheet';

/** Name, email, a new password twice, the home base, and a way back to the demo. */
export function AccountForm({ archive, onClose }: { archive: Archive; onClose: () => void }) {
  const { t: tr } = useTranslation();
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
    accountProblem(
      {
        name,
        email,
        password: pass,
        again,
        home,
        passwordOptional: true,
      },
      tr,
    ) ?? handleProblem(handle, tr);
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
    <Sheet title={tr('forms.accountTitle')} lead={tr('forms.accountLead')} onClose={onClose}>
      <Field label={tr('forms.name')} htmlFor="fName">
        <input
          id="fName"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label={tr('forms.email')} htmlFor="fMail">
        <input
          id="fMail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {backend() && (
        <Field label={tr('forms.publicHandle')} htmlFor="fHandle">
          <input
            id="fHandle"
            value={handle}
            placeholder={tr('forms.handlePlaceholder')}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
          />
          <small>
            {tr('forms.sharedTripsAt', { handle: handle.trim() || tr('forms.handlePlaceholder') })}
          </small>
        </Field>
      )}
      <Row>
        <Field label={tr('forms.newPassword')} htmlFor="fPass">
          <input
            id="fPass"
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(event) => setPass(event.target.value)}
          />
        </Field>
        <Field label={tr('forms.repeatIt')} htmlFor="fPass2">
          <input
            id="fPass2"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
        </Field>
      </Row>
      <PlaceField id="fHome" label={tr('forms.homeBase')} archive={archive} value={home} onPick={setHome} />
      <BackupBox archive={archive} />
      <Acts>
        <ConfirmButton
          label={tr('forms.resetToDemo')}
          ask={tr('forms.loseEveryChange')}
          onConfirm={() => {
            void repository()
              ?.clear()
              .then(() => location.reload());
          }}
        />
        <Btn onClick={onClose}>{tr('forms.cancel')}</Btn>
        <Btn variant="main" disabled={problem !== null || busy} onClick={() => void submit()}>
          {tr('forms.save')}
        </Btn>
      </Acts>
      <Note>
        {error ??
          problem ??
          (backend() ? tr('forms.emailChangeNote') : tr('forms.passwordNotStoredNote'))}
      </Note>
    </Sheet>
  );
}
