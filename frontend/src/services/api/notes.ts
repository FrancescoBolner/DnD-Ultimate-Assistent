import { api } from './client';
import type { Note } from '../../shared/types';

interface NotesResponse { notes: Note[] }
interface NoteResponse  { note: Note }

export async function listNotes(campaignId: number): Promise<Note[]> {
  const data = await api<NotesResponse>(`/notes/campaign/${campaignId}`);
  return data.notes;
}

export async function getNote(id: number): Promise<Note> {
  const data = await api<NoteResponse>(`/notes/${id}`);
  return data.note;
}

export async function createNote(campaignId: number, body: Partial<Note>): Promise<Note> {
  const data = await api<NoteResponse>(`/notes/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.note;
}

export async function updateNote(id: number, body: Partial<Note>): Promise<Note> {
  const data = await api<NoteResponse>(`/notes/${id}`, {
    method: 'PUT', body,
  });
  return data.note;
}

export async function deleteNote(id: number): Promise<void> {
  await api(`/notes/${id}`, { method: 'DELETE' });
}
