import { backend } from '@/backend/session';
import { Acts, Btn, Sheet } from './Sheet';
import styles from './AboutForm.module.css';

const link = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);

/** Who made it, how to reach them, what the code and the photos are licensed under, and what is kept. */
export function AboutForm({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="My World" lead="Memories of the places I've been." onClose={onClose}>
      <div className={styles.about}>
        <section>
          <h4>Made by</h4>
          <p>
            Designed and developed by {link('https://github.com/murpiano', 'murpiano')} (Bogdan
            Trotsenko).
          </p>
        </section>
        <section>
          <h4>Contact</h4>
          <p>
            {link('https://github.com/murpiano', 'GitHub')} ·{' '}
            {link('https://t.me/murpiano', 'Telegram')} ·{' '}
            {link('https://github.com/murpiano/my-world/issues', 'Report a problem')}
          </p>
        </section>
        <section>
          <h4>License</h4>
          <p>
            The code is open source under the{' '}
            {link('https://github.com/murpiano/my-world/blob/main/LICENSE', 'MIT license')}. The
            demo photos come from {link('https://commons.wikimedia.org', 'Wikimedia Commons')}; the
            author and the license of each one are under it. They stay under their own licenses (CC
            BY, CC BY-SA, CC0 or public domain). The list of cities comes from{' '}
            {link('https://www.geonames.org', 'GeoNames')} (CC BY 4.0).
          </p>
        </section>
        <section>
          <h4>Privacy and cookies</h4>
          <p>
            {backend()
              ? 'No ads and no tracking. When you make an account, your email, your name, your trips, albums and photos are kept with the service that runs the accounts (Supabase), closed to everyone but you. Nothing else is collected. The only thing stored in your browser is the sign-in itself.'
              : 'No cookies, no analytics, no ads, no tracking. There is no server: what you add while logged in — your name, trips, albums and photos — stays in this browser only, in local storage, and never leaves your device. You can download a backup of it in the account settings.'}{' '}
            The fonts are served from this site itself, so no other company sees your visit.
          </p>
        </section>
        <section>
          <h4>Terms</h4>
          <p>
            My World is a personal project, offered as it is, without any warranty. Likes and
            comments are demo stubs.{' '}
            {backend()
              ? 'Your archive is kept with your account, but download a backup now and then, and keep your own copies of the photos.'
              : 'Clearing the site data deletes your archive, so keep your own copies of the photos.'}
          </p>
        </section>
      </div>
      <Acts>
        <Btn variant="main" onClick={onClose}>
          Close
        </Btn>
      </Acts>
    </Sheet>
  );
}
