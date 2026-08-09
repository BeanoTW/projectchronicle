// Phase 9 — shared V2 Settings presentation primitives.
//
// Presentation only: no data access, no auth, no storage. Production wires
// these up in src/pages/SettingsScreenV2.tsx. Everything is scoped under
// `.proto-root` (supplied by V2Surface), so the same styling applies wherever
// the data comes from.
import { useId, type ReactNode } from 'react';

export const SettingsSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <section className="proto-set-section" aria-labelledby={`sec-${title.replace(/\s+/g, '-').toLowerCase()}`}>
    <h2 className="proto-set-sectitle" id={`sec-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      {title}
    </h2>
    {description && <p className="proto-help proto-set-secdesc">{description}</p>}
    <div className="proto-set-card">{children}</div>
  </section>
);

export const SettingsRow = ({
  label,
  value,
  help,
  action,
}: {
  label: ReactNode;
  value?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="proto-set-row">
    <div className="proto-set-rowmain">
      <span className="proto-set-label">{label}</span>
      {value !== undefined && <span className="proto-set-value">{value}</span>}
      {help && <span className="proto-help proto-set-help">{help}</span>}
    </div>
    {action && <div className="proto-set-rowaction">{action}</div>}
  </div>
);

/** Accessible switch built on a native checkbox so labels and keyboard work. */
export const SettingsToggle = ({
  label,
  help,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  help?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) => {
  const id = useId();
  return (
    <div className="proto-set-row">
      <div className="proto-set-rowmain">
        <label className="proto-set-label" htmlFor={id}>{label}</label>
        {help && <span className="proto-help proto-set-help" id={`${id}-help`}>{help}</span>}
        <span className="proto-set-state">{checked ? 'On' : 'Off'}</span>
      </div>
      <div className="proto-set-rowaction">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="proto-set-switch"
          aria-describedby={help ? `${id}-help` : undefined}
          checked={checked}
          disabled={disabled}
          data-testid={testId}
          onChange={e => onChange(e.target.checked)}
        />
      </div>
    </div>
  );
};

export const SettingsChoice = <T extends string>({
  legend,
  help,
  value,
  options,
  onChange,
}: {
  legend: string;
  help?: ReactNode;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) => (
  <fieldset className="proto-set-row proto-set-fieldset">
    <legend className="proto-set-label">{legend}</legend>
    {help && <p className="proto-help proto-set-help">{help}</p>}
    <div className="proto-set-choices" role="radiogroup" aria-label={legend}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          className="proto-set-choice"
          onClick={() => onChange(o.value)}
        >
          {o.label}
          <span className="proto-set-choicemark" aria-hidden>{value === o.value ? '✓' : ''}</span>
        </button>
      ))}
    </div>
  </fieldset>
);

export const SettingsLinkRow = ({
  label,
  help,
  onClick,
  href,
}: {
  label: string;
  help?: ReactNode;
  onClick?: () => void;
  href?: string;
}) =>
  href ? (
    <a className="proto-set-linkrow" href={href}>
      <span className="proto-set-rowmain">
        <span className="proto-set-label">{label}</span>
        {help && <span className="proto-help proto-set-help">{help}</span>}
      </span>
      <span aria-hidden className="proto-set-chev">›</span>
    </a>
  ) : (
    <button type="button" className="proto-set-linkrow" onClick={onClick}>
      <span className="proto-set-rowmain">
        <span className="proto-set-label">{label}</span>
        {help && <span className="proto-help proto-set-help">{help}</span>}
      </span>
      <span aria-hidden className="proto-set-chev">›</span>
    </button>
  );

/** Deferred capability — shown honestly rather than improvised. */
export const SettingsDeferred = ({ label, reason }: { label: string; reason: string }) => (
  <div className="proto-set-row">
    <div className="proto-set-rowmain">
      <span className="proto-set-label">{label}</span>
      <span className="proto-help proto-set-help">{reason}</span>
    </div>
    <div className="proto-set-rowaction">
      <span className="proto-chip">Not yet available</span>
    </div>
  </div>
);
