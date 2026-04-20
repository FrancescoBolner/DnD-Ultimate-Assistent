import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getActiveScreen } from '../../services/api/screens';
import { onScreenUpdated, onCharacterUpdated, onCreatureUpdated, joinCampaign, leaveCampaign } from '../../services/socket';
import { getCampaignCharacters } from '../../services/api/campaigns';
import * as creaturesApi from '../../services/api/creatures';
import * as itemsApi from '../../services/api/items';
import { ScreenDisplay } from '../../shared/plugins/views/screen/ScreenPlugin';
import { ScreenEmbedContext } from '../../shared/plugins/ScreenEmbedContext';
import { useCampaign } from '../../app/providers/useCampaign';
import type { ScreenLayoutData, Character, Creature, Item } from '../../shared/types';
import './Screen.css';

export default function ScreenPage() {
  const { campaignId: cid } = useParams<{ campaignId: string }>();
  const campaignId = parseInt(cid ?? '0');

  const { activeCampaignId, setActiveCampaign } = useCampaign();

  /* Ensure CampaignProvider is wired to this campaign so embedded plugins get context data */
  useEffect(() => {
    if (campaignId && activeCampaignId !== campaignId) {
      setActiveCampaign(campaignId);
    }
  }, [campaignId, activeCampaignId, setActiveCampaign]);

  const [layout, setLayout] = useState<ScreenLayoutData | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    joinCampaign(campaignId);
    getActiveScreen(campaignId).then(s => {
      if (s?.layout) setLayout(s.layout as unknown as ScreenLayoutData);
    });
    getCampaignCharacters(campaignId).then(setCharacters).catch(() => {});
    creaturesApi.listCreatures(campaignId).then(setCreatures).catch(() => {});
    itemsApi.listItems(campaignId).then(setItems).catch(() => {});
    return () => { leaveCampaign(campaignId); };
  }, [campaignId]);

  useEffect(() => {
    return onScreenUpdated(({ campaignId: cid, layout: l }) => {
      if (cid !== campaignId) return;
      if (l) setLayout(l as unknown as ScreenLayoutData);
      else setLayout(null);
    });
  }, [campaignId]);

  // Keep character HP live
  useEffect(() => {
    return onCharacterUpdated(payload => {
      setCharacters(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } as Character : c));
    });
  }, []);

  // Keep creature HP live
  useEffect(() => {
    return onCreatureUpdated(payload => {
      setCreatures(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } as Creature : c));
    });
  }, []);

  if (!layout) {
    return (
      <div className="scr-page scr-page--empty">
        <span>Waiting for screen…</span>
      </div>
    );
  }

  const [arW, arH] = layout.aspect.split(':').map(Number);

  return (
    <div className="scr-page">
      <div
        className="scr-page__display"
        style={{ '--ar-w': arW, '--ar-h': arH } as React.CSSProperties}
      >
        <ScreenEmbedContext.Provider value={true}>
          <ScreenDisplay
            layout={layout}
            characters={characters}
            creatures={creatures}
            items={items}
          />
        </ScreenEmbedContext.Provider>
      </div>
    </div>
  );
}
