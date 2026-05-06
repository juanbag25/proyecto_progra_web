'use client';

import { useMemo, useState } from 'react';
import { NumberInput } from '@/components/ui/NumberInput';
import { Slider } from '@/components/ui/Slider';
import { budgetSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { StepCard } from '../StepCard';

const formatARS = (n: number) => `$${n.toLocaleString('es-AR')}`;

interface Props {
  initial: { weekly_budget_ars?: number | null };
  onContinue: (data: { weekly_budget_ars: number }) => void;
  onBack?: () => void;
}

export function BudgetStep({ initial, onContinue, onBack }: Props) {
  const [budget, setBudget] = useState(
    initial.weekly_budget_ars ? Number(initial.weekly_budget_ars) : 65000,
  );

  const data = useMemo(() => ({ weekly_budget_ars: budget }), [budget]);
  const valid = budgetSchema.safeParse(data).success;
  const dailyEquivalent = Math.round(budget / 7);
  const { submit, submitting } = useStepSubmit('budget', onContinue);

  return (
    <StepCard
      title="¿Cuánto podés gastar por semana en comida?"
      subtitle="Sé honesto: el algoritmo arma la lista DENTRO de este número, sin pasarse."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <NumberInput
        label="Presupuesto semanal"
        unit="ARS"
        min={5000}
        max={500000}
        step={5000}
        value={budget}
        onChange={setBudget}
      />
      <Slider
        label="Slider rápido"
        min={20000}
        max={250000}
        step={5000}
        value={budget}
        onChange={setBudget}
        formatValue={formatARS}
      />
      <p className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 font-sans text-xs text-white/65">
        Eso es ~
        <span className="tabular font-semibold text-accent-cyan">{formatARS(dailyEquivalent)}</span>{' '}
        por día.
      </p>
    </StepCard>
  );
}
