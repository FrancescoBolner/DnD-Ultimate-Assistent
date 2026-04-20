import type { Campaign } from '../../shared/types';

export const STATUS_LABELS: Record<Campaign['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export interface CharacterForm {
  name: string;
  class: string;
  race: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  hp_max: number;
  ac: number;
  speed: number;
  image: string;
  backstory: string;
}

export const defaultCharForm = (): CharacterForm => ({
  name: '', class: 'Fighter', race: 'Human', level: 1,
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  hp_max: 10, ac: 10, speed: 30, image: '', backstory: '',
});
