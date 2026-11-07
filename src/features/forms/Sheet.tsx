import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Sheet.module.css';

/** A modal sheet over everything. A press on the dim closes it; Esc is handled by `useKeys`. */
export function Sheet({
  title,
  lead,
  onClose,
  children,
}: {
  title: string;
  lead?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const heading = `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;

  // the first field takes the cursor, once the sheet has slid in
  useEffect(() => {
    const id = setTimeout(() => {
      sheet.current?.querySelector<HTMLElement>('input:not([type=file]), textarea')?.focus();
    }, 80);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={`${styles.modal} ${styles.isOn}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet} ref={sheet} role="dialog" aria-modal="true" aria-labelledby={heading}>
        <h3 id={heading}>{title}</h3>
        {lead && <Lead>{lead}</Lead>}
        {children}
      </div>
    </div>
  );
}

/** A lead/intro paragraph, the same look `Sheet`'s own `lead` prop renders. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className={styles.lead}>{children}</p>;
}

/** A note below a form's fields — pass `problem` for the error-colored variant. */
export function Note({ problem, children }: { problem?: boolean; children: ReactNode }) {
  return <p className={`${styles.note}${problem ? ` ${styles.isProblem}` : ''}`}>{children}</p>;
}

/** A form field: a `<label>` when `label`/`htmlFor` are given, otherwise a plain grouping `<div>`. */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  if (label || htmlFor) {
    return (
      <label className={styles.field} htmlFor={htmlFor}>
        {label}
        {children}
      </label>
    );
  }
  return <div className={styles.field}>{children}</div>;
}

/** Two fields side by side; stacks on a narrow sheet. */
export function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

/** The row of actions at the bottom of a sheet. */
export function Acts({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return <div className={className ? `${styles.acts} ${className}` : styles.acts}>{children}</div>;
}

/**
 * A sheet's button. `variant="main"` is the one primary action; `variant="danger"` is a
 * destructive action, `armed` its "press again to confirm" look (see `ConfirmButton`).
 */
export function Btn({
  variant,
  armed,
  className,
  ...rest
}: {
  variant?: 'main' | 'danger';
  armed?: boolean;
  className?: string | undefined;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass =
    variant === 'main' ? styles.isMain : variant === 'danger' ? styles.isDanger : '';
  const armedClass = armed ? styles.isArmed : '';
  return (
    <button
      type="button"
      className={[styles.btn, variantClass, armedClass, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
