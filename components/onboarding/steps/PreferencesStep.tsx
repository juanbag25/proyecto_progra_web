'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { preferencesSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { Chip } from '../Chip';
import { StepCard } from '../StepCard';

const SUGGESTED_FOODS = [
  'Pollo',
  'Atún',
  'Huevo',
  'Arroz',
  'Avena',
  'Banana',
  'Manzana',
  'Palta',
  'Yogur',
  'Pasta',
  'Carne',
  'Salmón',
  'Brócoli',
  'Espinaca',
  'Almendras',
  'Garbanzos',
  'Lentejas',
  'Queso',
];

interface Props {
  initial: { preferred_foods?: string[] | null; disliked_foods?: string[] | null };
  onContinue: (data: { preferred_foods: string[]; disliked_foods: string[] }) => void;
  onBack?: () => void;
}

function ChipList({
  items,
  selected,
  onToggle,
  variant,
}: {
  items: string[];
  selected: string[];
  onToggle: (label: string) => void;
  variant: 'mint' | 'coral';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Chip
          key={item}
          label={item}
          selected={selected.includes(item)}
          onClick={() => onToggle(item)}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function PreferencesStep({ initial, onContinue, onBack }: Props) {
  const [preferred, setPreferred] = useState<string[]>(initial.preferred_foods ?? []);
  const [disliked, setDisliked] = useState<string[]>(initial.disliked_foods ?? []);
  const [customLove, setCustomLove] = useState('');
  const [customHate, setCustomHate] = useState('');

  const data = useMemo(
    () => ({ preferred_foods: preferred, disliked_foods: disliked }),
    [preferred, disliked],
  );
  const valid = preferencesSchema.safeParse(data).success;
  const { submit, submitting } = useStepSubmit('preferences', onContinue);

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function addCustom(
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    reset: () => void,
  ) {
    const trimmed = value.trim();
    if (!trimmed || list.includes(trimmed)) {
      reset();
      return;
    }
    setList([...list, trimmed]);
    reset();
  }

  return (
    <StepCard
      title="Lo que comerías todos los días."
      subtitle="Y lo que ni regalado. Tocá los que te gustan o escribí los tuyos."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <div className="flex flex-col gap-3">
        <span className="font-display text-xs font-medium uppercase tracking-widest text-accent-mint">
          Lo que amás
        </span>
        <ChipList
          items={[...new Set([...SUGGESTED_FOODS, ...preferred])]}
          selected={preferred}
          onToggle={(item) => toggle(preferred, setPreferred, item)}
          variant="mint"
        />
        <Input
          placeholder="Sumar otro (Enter)"
          value={customLove}
          onChange={(e) => setCustomLove(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom(preferred, setPreferred, customLove, () => setCustomLove(''));
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-5">
        <span className="font-display text-xs font-medium uppercase tracking-widest text-warn-coral">
          Lo que odiás
        </span>
        <ChipList
          items={[...new Set([...SUGGESTED_FOODS, ...disliked])]}
          selected={disliked}
          onToggle={(item) => toggle(disliked, setDisliked, item)}
          variant="coral"
        />
        <Input
          placeholder="Sumar otro (Enter)"
          value={customHate}
          onChange={(e) => setCustomHate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom(disliked, setDisliked, customHate, () => setCustomHate(''));
            }
          }}
        />
      </div>
    </StepCard>
  );
}
