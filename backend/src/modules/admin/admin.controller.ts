import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';
import path from 'path';
import fs from 'fs';

/* ══════════════════════════════════════════════════════════════
   Admin Controller
   ══════════════════════════════════════════════════════════════ */

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getPlatformStats();
    res.json({ stats });
  } catch (err) { next(err); }
}

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await adminService.listUsers(page, limit);
    res.json(result);
  } catch (err) { next(err); }
}

export async function toggleUserActive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.userId as string);
    const { is_active } = req.body;
    await adminService.toggleUserActive(userId, !!is_active);
    res.json({ message: 'User updated' });
  } catch (err) { next(err); }
}

export async function toggleUserAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.userId as string);
    const { is_admin } = req.body;
    await adminService.toggleUserAdmin(userId, !!is_admin);
    res.json({ message: 'User updated' });
  } catch (err) { next(err); }
}

export async function getCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await adminService.listCampaigns(page, limit);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getImages(req: Request, res: Response, next: NextFunction) {
  try {
    const protocol = req.protocol;
    const host = req.get('host') ?? 'localhost:3000';
    const BACKEND_ORIGIN = `${protocol}://${host}`;
    const publicRoot = path.resolve(__dirname, '../../../../frontend/public');

    const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
    const AUDIO_EXT = /\.(mp3|ogg|wav|flac|aac)$/i;

    function fileType(name: string): 'image' | 'audio' | 'other' {
      if (IMAGE_EXT.test(name)) return 'image';
      if (AUDIO_EXT.test(name)) return 'audio';
      return 'other';
    }

    function walk(dir: string, rel: string): { path: string; url: string; name: string; folder: string; ext: string; type: string }[] {
      const entries: { path: string; url: string; name: string; folder: string; ext: string; type: string }[] = [];
      let items: fs.Dirent[];
      try { items = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return entries; }
      for (const item of items) {
        const absPath = path.join(dir, item.name);
        const relPath = rel ? `${rel}/${item.name}` : item.name;
        if (item.isDirectory()) {
          entries.push(...walk(absPath, relPath));
        } else {
          const urlPath = relPath.split(path.sep).join('/');
          const ext = path.extname(item.name).toLowerCase().replace('.', '');
          entries.push({
            path: urlPath,
            url: `${BACKEND_ORIGIN}/${urlPath}`,
            name: item.name,
            folder: rel.split(path.sep).join('/') || '(root)',
            ext,
            type: fileType(item.name),
          });
        }
      }
      return entries;
    }

    const images = walk(publicRoot, '');
    res.json({ images });
  } catch (err) { next(err); }
}

export async function exportDb(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.exportDatabase();
    const date = new Date().toISOString().split('T')[0];
    const filename = `dnd-backup-${date}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ exported_at: new Date().toISOString(), data });
  } catch (err) { next(err); }
}

export async function importDb(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, strategy } = req.body as {
      data: Record<string, unknown[]>;
      strategy?: 'replace' | 'ignore';
    };
    if (!data || typeof data !== 'object') {
      res.status(400).json({ message: 'Missing or invalid "data" field.' });
      return;
    }
    const strat = strategy === 'replace' ? 'replace' : 'ignore';
    const result = await adminService.importDatabase(data, strat);
    res.json({ message: 'Import complete', ...result });
  } catch (err) { next(err); }
}
