import './Spinner.css';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Optional label shown below the spinner */
  text?: string;
  className?: string;
}

export function Spinner({ size = 'md', text, className = '' }: SpinnerProps) {
  const cls = ['spinner', `spinner--${size}`, className].filter(Boolean).join(' ');

  return (
    <span className={cls} role="status" aria-label={text ?? 'Loading'}>
      <span className="spinner__ring" aria-hidden="true" />
      {text && <span className="spinner__text">{text}</span>}
    </span>
  );
}
