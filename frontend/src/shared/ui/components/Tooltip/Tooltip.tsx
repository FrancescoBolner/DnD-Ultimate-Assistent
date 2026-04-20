import { useState, useRef, type ReactNode } from 'react';
import './Tooltip.css';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Tooltip content */
  content: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  /** Delay before showing (ms) */
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 300,
  className = '',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function show() {
    timer.current = setTimeout(() => setVisible(true), delay);
  }
  function hide() {
    clearTimeout(timer.current);
    setVisible(false);
  }

  const cls = [
    'tooltip-root',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      className={cls}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className={`tooltip__popup tooltip__popup--${placement}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}
