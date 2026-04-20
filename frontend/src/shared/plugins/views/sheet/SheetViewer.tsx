import { useEffect } from 'react';
import { X } from 'lucide-react';
import './sheet-viewer.css';

interface Props {
  url: string;
  onClose: () => void;
}

export function SheetViewer({ url, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true); // capture — fires before panel/global handlers
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="sheet-viewer" onClick={onClose}>
      <button className="sheet-viewer__close" onClick={onClose} title="Close">
        <X size={18} />
      </button>
      <div className="sheet-viewer__frame" onClick={e => e.stopPropagation()}>
        <img className="sheet-viewer__img" src={url} alt="Creature sheet" />
      </div>
    </div>
  );
}
