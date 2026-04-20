/* ─────────────────────────────────────────────────────────────
   Base components
──────────────────────────────────────────────────────────── */
export { Button } from './components/Button';
export { Card } from './components/Card';
export { HpBar } from './components/HpBar';
export { Input } from './components/Input';
export { List } from './components/List';
export { Modal } from './components/Modal';
export { Select } from './components/Select';
export type { SelectOption } from './components/Select';
export { Switch } from './components/Switch';
export { Textarea } from './components/Textarea';
export { SearchBar } from './components/SearchBar';
export { Slider } from './components/Slider';
export { ComboSearch } from './components/ComboSearch';
export type { ComboSearchProps, ComboSearchItem } from './components/ComboSearch';
export { ToggleList } from './components/ToggleList';
export type { ToggleListProps, ToggleListItem } from './components/ToggleList';

/* ─────────────────────────────────────────────────────────────
   New primitive components
──────────────────────────────────────────────────────────── */
export { Badge } from './components/Badge';
export type { BadgeVariant, BadgeSize } from './components/Badge';

export { StatChip } from './components/StatChip';
export type { StatChipProps, StatChipVariant, StatChipLayout, StatChipSize } from './components/StatChip';

export { StatBlock } from './components/StatBlock';
export type { StatBlockProps, StatName } from './components/StatBlock';

export { Avatar } from './components/Avatar';
export type { AvatarProps, AvatarSize, AvatarShape } from './components/Avatar';

export { Tag } from './components/Tag';
export type { TagProps, TagVariant } from './components/Tag';

export { Spinner } from './components/Spinner';
export type { SpinnerProps, SpinnerSize } from './components/Spinner';

export { Tooltip } from './components/Tooltip';
export type { TooltipProps, TooltipPlacement } from './components/Tooltip';

export { NumberStepper } from './components/NumberStepper';
export type { NumberStepperProps } from './components/NumberStepper';

export { Checkbox } from './components/Checkbox';
export type { CheckboxProps } from './components/Checkbox';

export { ProgressBar } from './components/ProgressBar';
export type { ProgressBarProps, ProgressBarVariant } from './components/ProgressBar';

export { Divider } from './components/Divider';
export type { DividerProps } from './components/Divider';

/* ─────────────────────────────────────────────────────────────
   Blocks (composite)
──────────────────────────────────────────────────────────── */
export { StatRow } from './blocks/StatRow';
export type { StatRowProps, AbilityScores } from './blocks/StatRow';

export { CombatStats } from './blocks/CombatStats';
export type { CombatStatsProps } from './blocks/CombatStats';

export { EntityHeader } from './blocks/EntityHeader';
export type { EntityHeaderProps, EntityType } from './blocks/EntityHeader';

export { FilterBar } from './blocks/FilterBar';
export type { FilterBarProps, FilterOption, OrderByConfig, SelectConfig } from './blocks/FilterBar';

export { CharacterCard } from './blocks/CharacterCard';
export type { CharacterCardProps, CharacterCardData } from './blocks/CharacterCard';

export { CreatureCard } from './blocks/CreatureCard';
export type { CreatureCardProps, CreatureCardData } from './blocks/CreatureCard';

export { ItemCard } from './blocks/ItemCard';
export type { ItemCardProps, ItemCardData, ItemRarity } from './blocks/ItemCard';

export { AbilityCard } from './blocks/AbilityCard';
export type { AbilityCardProps, AbilityCardData, AbilityActionType, AbilityTargetType } from './blocks/AbilityCard';

export { EffectRow } from './blocks/EffectRow';
export type { EffectRowProps, ActiveEffect, EffectVariant } from './blocks/EffectRow';

export { TopBar } from './blocks/TopBar';
export type { TopBarProps } from './blocks/TopBar';
