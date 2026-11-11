import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Archive } from '@/data/archive';
import type { PickedPlace } from '@/data/places';
import { friendlyError } from '@/backend/account';
import { backend } from '@/backend/session';
import { accountProblem, signInProblem } from './fields';
import { PlaceField } from './PlaceField';
import { Acts, Btn, Field, Lead, Note, Sheet } from './Sheet';

/** Logging in or making an account with the backend; the page opens again with the archive. */
export function RemoteLoginForm({
  archive,
  why,
  onClose,
}: {
  archive: Archive;
  why: string | null;
  onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [home, setHome] = useState<PickedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // logging in needs only the pair; a new account needs all of it
  const problem = making
    ? accountProblem({ name, email, password: pass, home }, tr)
    : signInProblem(email, pass, tr);

  const submit = async () => {
    const auth = backend()?.auth;
    if (!auth || problem || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (making && home) {
        const { name: city, country, countryId, lat, lon } = home;
        const result = await auth.signUp({
          email: email.trim(),
          password: pass,
          name: name.trim(),
          home: { name: city, country, countryId, lat, lon },
        });
        if (result === 'confirm-email') {
          setSent(true);
          setBusy(false);
          return;
        }
      } else {
        await auth.signIn(email.trim(), pass);
      }
      location.reload();
    } catch (failure) {
      setBusy(false);
      setError(friendlyError(failure instanceof Error ? failure.message : String(failure)));
    }
  };

  if (sent) {
    return (
      <Sheet title={tr('forms.checkYourEmail')} onClose={onClose}>
        <Lead>{tr('forms.emailSentLead', { email: email.trim() })}</Lead>
        <Acts>
          <Btn
            variant="main"
            onClick={() => {
              setSent(false);
              setMaking(false);
            }}
          >
            {tr('forms.logInTitle')}
          </Btn>
        </Acts>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={making ? tr('forms.makeAnAccount') : tr('forms.logInTitle')}
      lead={`${why ? `${why} ` : ''}${making ? tr('forms.loginLead') : tr('forms.remoteLoginLead')}`}
      onClose={onClose}
    >
      {making && (
        <Field label={tr('forms.name')} htmlFor="fName">
          <input
            id="fName"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      )}
      <Field label={tr('forms.email')} htmlFor="fMail">
        <input
          id="fMail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label={tr('forms.password')} htmlFor="fPass">
        <input
          id="fPass"
          type="password"
          autoComplete={making ? 'new-password' : 'current-password'}
          value={pass}
          onChange={(event) => setPass(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !making) void submit();
          }}
        />
      </Field>
      {making && (
        <PlaceField id="fHome" label={tr('forms.homeBase')} archive={archive} value={home} onPick={setHome} />
      )}
      <Acts>
        <Btn
          onClick={() => {
            setMaking(!making);
            setError(null);
          }}
        >
          {making ? tr('forms.iHaveAnAccount') : tr('forms.makeAnAccount')}
        </Btn>
        <Btn variant="main" disabled={problem !== null || busy} onClick={() => void submit()}>
          {busy ? tr('forms.oneMoment') : making ? tr('forms.makeIt') : tr('forms.logInTitle')}
        </Btn>
      </Acts>
      {(error ?? (problem && (email || pass || name) ? problem : null)) && (
        <Note problem>{error ?? problem}</Note>
      )}
    </Sheet>
  );
}
