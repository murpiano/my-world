import { useState } from 'react';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [home, setHome] = useState<PickedPlace | null>(null);
  const problem = accountProblem({ name, email, password: pass, home });

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
      title="Log in"
      lead={`${why ? `${why} ` : ''}Your home base is where every trip starts and where it comes back to.`}
      onClose={onClose}
    >
      <Field label="Name" htmlFor="fName">
        <input
          id="fName"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Email" htmlFor="fMail">
        <input
          id="fMail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="fPass">
        <input
          id="fPass"
          type="password"
          autoComplete="current-password"
          value={pass}
          onChange={(event) => setPass(event.target.value)}
        />
      </Field>
      <PlaceField id="fHome" label="Home base" archive={archive} value={home} onPick={setHome} />
      <Acts>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="main" disabled={problem !== null} onClick={submit}>
          Log in
        </Btn>
      </Acts>
      {problem && (name || email || pass) && <Note problem>{problem}</Note>}
      <Note>
        There is no server yet. Your archive stays in this browser; it starts as a copy of the demo,
        so there is something to play with.
      </Note>
    </Sheet>
  );
}
