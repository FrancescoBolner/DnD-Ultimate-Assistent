import { useState } from 'react';
import './Avatar.css';

export type AvatarSize  = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded' | 'square';

export interface AvatarProps {
  /** Image URL – falls back to initials if absent or fails to load */
  src?: string;
  /** Full name used to derive initials */
  name?: string;
  size?:  AvatarSize;
  shape?: AvatarShape;
  /** Status indicator dot */
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic hue from string so initials always get the same color */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function Avatar({
  src,
  name = '',
  size  = 'md',
  shape = 'circle',
  status,
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!(src && !imgError);

  const cls = [
    'avatar',
    `avatar--${size}`,
    `avatar--${shape}`,
    className,
  ].filter(Boolean).join(' ');

  const hue       = name ? nameToHue(name) : 200;
  const initStyle = { '--avatar-hue': hue } as React.CSSProperties;

  return (
    <span className={cls}>
      {showImg ? (
        <img
          className="avatar__img"
          src={src}
          alt={name || 'avatar'}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="avatar__initials" style={initStyle}>
          {name ? getInitials(name) : '?'}
        </span>
      )}
      {status && <span className={`avatar__status avatar__status--${status}`} />}
    </span>
  );
}
