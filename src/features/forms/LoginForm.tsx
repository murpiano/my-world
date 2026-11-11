import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Archive } from '@/data/archive';
import type { PickedPlace } from '@/data/places';
import { logIn } from '@/state/user';
import { accountProblem } from './fields';
import { PlaceField } from './PlaceField';
import { Acts, Btn, Field, Note, Sheet } from './Sheet';

/** Logging in swaps the demo for the owner's archive, so the page opens again with it. */
export function LoginForm({
  archive,
  why,
  onClose,
}: {
  archive: Archive;
  why: string | null;
  onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [home, setHome] = useState<PickedPlace | null>(null);
  const problem = accountProblem({ name, email, password: pass, home }, tr);

  const submit = () => {
    if (problem || !home) return;
    const { name: city, country, countryId, lat, lon } = home;
    logIn({
      name: name.trim(),
      email: email.trim(),
      home: { name: city, country, countryId, lat, lon },
    });
    location.reload();
  };

  return (
    <Sheet
      title={tr('forms.logInTitle')}
      lead={`${why ? `${why} ` : ''}${tr('forms.loginLead')}`}
      onClose={onClose}
    >
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
      <Field label={tr('forms.password')} htmlFor="fPass">
        <input
          id="fPass"
          type="password"
          autoComplete="current-password"
          value={pass}
          onChange={(event) => setPass(event.target.value)}
        />
      </Field>
      <PlaceField id="fHome" label={tr('forms.homeBase')} archive={archive} value={home} onPick={setHome} />
      <Acts>
        <Btn onClick={onClose}>{tr('forms.cancel')}</Btn>
        <Btn variant="main" disabled={problem !== null} onClick={submit}>
          {tr('forms.logInTitle')}
        </Btn>
      </Acts>
      {problem && (name || email || pass) && <Note problem>{problem}</Note>}
      <Note>{tr('forms.noServerNote')}</Note>
    </Sheet>
  );
}
