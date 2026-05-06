'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { restrictionsSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { Chip } from '../Chip';
import { StepCard } from '../StepCard';

const COMMON_ALLERGIES = [
  'Gluten',
  'Lactosa',
  'Frutos secos',
  'Mariscos',
  'Soja',
  'Huevo',
  'Pescado',
];
const COMMON_DIETS = [
  'Vegano',
  'Vegetariano',
  'Pescetariano',
  'Kosher',
  'Halal',
  'Keto',
  'Sin TACC',
];

interface Props {
  initial: { allergies?: string[] | null; dietary_restrictions?: string[] | null };
  onContinue: (data: { allergies: string[]; dietary_restrictions: string[] }) => void;
  onBack?: () => void;
}

export function RestrictionsStep({ initial, onContinue, onBack }: Props) {
  const [allergies, setAllergies] = useState<string[]>(initial.allergies ?? []);
  const [diets, setDiets] = useState<string[]>(initial.dietary_restrictions ?? []);
  const [otherAllergy, setOtherAllergy] = useState('');

  const data = useMemo(() => ({ allergies, dietary_restrictions: diets }), [allergies, diets]);
  const valid = restrictionsSchema.safeParse(data).success;
  const { submit, submitting } = useStepSubmit('restrictions', onContinue);

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function addOther() {
    const trimmed = otherAllergy.trim();
    if (!trimmed || allergies.includes(trimmed)) {
      setOtherAllergy('');
      return;
    }
    setAllergies((prev) => [...prev, trimmed]);
    setOtherAllergy('');
  }

  return (
    <StepCard
      title="Lo que NO podés/querés comer."
      subtitle="Filtramos esto del catálogo así nunca aparece en tu lista."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <div className="flex flex-col gap-3">
        <span className="font-display text-xs font-medium uppercase tracking-widest text-warn-coral">
          Alergias / intolerancias
        </span>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...COMMON_ALLERGIES, ...allergies])].map((item) => (
            <Chip
              key={item}
              label={item}
              selected={allergies.includes(item)}
              onClick={() => toggle(allergies, setAllergies, item)}
              variant="coral"
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Otra alergia"
            value={otherAllergy}
            onChange={(e) => setOtherAllergy(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOther();
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-5">
        <span className="font-display text-xs font-medium uppercase tracking-widest text-accent-cyan">
          Dietas / preferencias
        </span>
        <div className="flex flex-wrap gap-2">
          {COMMON_DIETS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={diets.includes(item)}
              onClick={() => toggle(diets, setDiets, item)}
            />
          ))}
        </div>
      </div>
    </StepCard>
  );
}
