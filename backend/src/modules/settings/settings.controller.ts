import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../auth/auth.types';
import * as settingsService from './settings.service';

/* ══════════════════════════════════════════════════════════════
   User Settings
   ══════════════════════════════════════════════════════════════ */

/** GET /api/settings/user */
export async function getUserSettingsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    let settings = await settingsService.getUserSettings(userId);
    if (!settings) {
      settings = await settingsService.upsertUserSettings(userId, {});
    }
    res.json({ settings });
  } catch (err) { next(err); }
}

/** PUT /api/settings/user */
export async function updateUserSettingsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { dark_mode, layout, preferences } = req.body as {
      dark_mode?: boolean;
      layout?: unknown;
      preferences?: unknown;
    };

    const settings = await settingsService.upsertUserSettings(userId, {
      dark_mode,
      layout,
      preferences,
    });
    res.json({ settings });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════════════════════════
   Campaign Settings  (DM only)
   ══════════════════════════════════════════════════════════════ */

/** GET /api/settings/campaign/:id */
export async function getCampaignSettingsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = Number(req.params.id);
    const userId = req.user!.userId;

    const [isDm, isActivePlayer] = await Promise.all([
      settingsService.isDmOfCampaign(userId, campaignId),
      settingsService.isActivePlayerOfCampaign(userId, campaignId),
    ]);
    if (!isDm && !isActivePlayer) {
      res.status(403).json({ message: 'You are not a member of this campaign' });
      return;
    }

    const [settings, plugins, campaign] = await Promise.all([
      settingsService.getCampaignSettings(campaignId),
      settingsService.getCampaignPlugins(campaignId),
      settingsService.getCampaignById(campaignId),
    ]);
    const pluginDefinitions = settingsService.getPluginDefinitions();

    // Players receive only non-DM plugins explicitly visible to players.
    const visiblePlugins = isDm
      ? plugins
      : plugins.filter((p) => {
          if (p.is_dm_only) return false;
          const cfg = typeof p.config === 'string'
            ? (() => { try { return JSON.parse(p.config as string); } catch { return null; } })()
            : p.config;
          return (cfg as Record<string, unknown> | null)?.visible_to_players !== false;
        });

    res.json({ settings, plugins: visiblePlugins, pluginDefinitions, campaign });
  } catch (err) { next(err); }
}

/** PUT /api/settings/campaign/:id */
export async function updateCampaignSettingsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = Number(req.params.id);
    const userId = req.user!.userId;

    const isDm = await settingsService.isDmOfCampaign(userId, campaignId);
    if (!isDm) { res.status(403).json({ message: 'Only the DM can update campaign settings' }); return; }

    const { permissions, layout, campaign: campaignData } = req.body as {
      permissions?: unknown;
      layout?: unknown;
      campaign?: { name?: string; description?: string; status?: string; image?: string };
    };

    // Update campaign_settings.permissions / layout
    if (permissions !== undefined || layout !== undefined) {
      const patch: { permissions?: unknown; layout?: unknown } = {};
      if (permissions !== undefined) patch.permissions = permissions;
      if (layout !== undefined) patch.layout = layout;
      await settingsService.upsertCampaignSettings(campaignId, patch);
    }

    // Update campaign details (name, desc, status, image)
    if (campaignData) {
      await settingsService.updateCampaignDetails(campaignId, campaignData);
    }

    // Return refreshed data
    const [settings, campaign] = await Promise.all([
      settingsService.getCampaignSettings(campaignId),
      settingsService.getCampaignById(campaignId),
    ]);
    res.json({ settings, campaign });
  } catch (err) { next(err); }
}

/** PUT /api/settings/campaign/:id/plugins */
export async function updateCampaignPluginsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = Number(req.params.id);
    const userId = req.user!.userId;

    const isDm = await settingsService.isDmOfCampaign(userId, campaignId);
    if (!isDm) { res.status(403).json({ message: 'Only the DM can update plugins' }); return; }

    const { plugins } = req.body as {
      plugins: { slug: string; is_enabled: boolean; config?: unknown }[];
    };

    if (!Array.isArray(plugins)) {
      res.status(400).json({ message: 'plugins must be an array' });
      return;
    }

    const updated = await settingsService.bulkUpsertCampaignPlugins(campaignId, plugins);
    res.json({ plugins: updated });
  } catch (err) { next(err); }
}
