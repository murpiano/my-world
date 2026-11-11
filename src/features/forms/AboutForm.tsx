import { Trans, useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation();
  return (
    <Sheet title={tr('header.brand')} lead={tr('header.tagline')} onClose={onClose}>
      <div className={styles.about}>
        <section>
          <h4>{tr('about.madeByHeading')}</h4>
          <p>
            <Trans i18nKey="about.madeBy" components={[link('https://github.com/murpiano', 'murpiano')]} />
          </p>
        </section>
        <section>
          <h4>{tr('about.contactHeading')}</h4>
          <p>
            {link('https://github.com/murpiano', 'GitHub')} ·{' '}
            {link('https://t.me/murpiano', 'Telegram')} ·{' '}
            {link('https://github.com/murpiano/my-world/issues', tr('about.reportAProblem'))}
          </p>
        </section>
        <section>
          <h4>{tr('about.licenseHeading')}</h4>
          <p>
            <Trans
              i18nKey="about.license"
              components={[
                link('https://github.com/murpiano/my-world/blob/main/LICENSE', 'MIT license'),
                link('https://commons.wikimedia.org', 'Wikimedia Commons'),
                link('https://www.geonames.org', 'GeoNames'),
              ]}
            />
          </p>
        </section>
        <section>
          <h4>{tr('about.privacyHeading')}</h4>
          <p>
            {backend() ? tr('about.privacyWithAccounts') : tr('about.privacyNoBackend')}{' '}
            {tr('about.fontsNote')}
          </p>
        </section>
        <section>
          <h4>{tr('about.termsHeading')}</h4>
          <p>
            {tr('about.termsIntro')}{' '}
            {backend() ? tr('about.termsWithAccounts') : tr('about.termsNoBackend')}
          </p>
        </section>
      </div>
      <Acts>
        <Btn variant="main" onClick={onClose}>
          {tr('about.close')}
        </Btn>
      </Acts>
    </Sheet>
  );
}
