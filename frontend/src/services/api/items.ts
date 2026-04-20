import { api } from './client';
import type { Item } from '../../shared/types';

interface ItemsResponse { items: Item[] }
interface ItemResponse  { item: Item }

export async function listItems(campaignId: number): Promise<Item[]> {
  const data = await api<ItemsResponse>(`/items/campaign/${campaignId}`);
  return data.items;
}

export async function getItem(id: number): Promise<Item> {
  const data = await api<ItemResponse>(`/items/${id}`);
  return data.item;
}

export async function createItem(campaignId: number, body: Partial<Item>): Promise<Item> {
  const data = await api<ItemResponse>(`/items/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.item;
}

export async function updateItem(id: number, body: Partial<Item>): Promise<Item> {
  const data = await api<ItemResponse>(`/items/${id}`, {
    method: 'PUT', body,
  });
  return data.item;
}

export async function deleteItem(id: number): Promise<void> {
  await api(`/items/${id}`, { method: 'DELETE' });
}
