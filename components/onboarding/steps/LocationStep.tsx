'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/Select';
import { locationSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { StepCard } from '../StepCard';

const COUNTRIES = [{ value: 'AR', label: 'Argentina' }];

const PROVINCES_AR = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

interface Props {
  initial: { country?: string | null; region?: string | null };
  onContinue: (data: { country: string; region: string }) => void;
  onBack?: () => void;
}

export function LocationStep({ initial, onContinue, onBack }: Props) {
  const [country, setCountry] = useState(initial.country ?? 'Argentina');
  const [region, setRegion] = useState(initial.region ?? PROVINCES_AR[0]);

  const data = useMemo(() => ({ country, region }), [country, region]);
  const valid = locationSchema.safeParse(data).success;
  const { submit, submitting } = useStepSubmit('location', onContinue);

  return (
    <StepCard
      title="¿Dónde vivís?"
      subtitle="Lo usamos para mapear tu super y los precios reales de tu zona."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <Select
        label="País"
        value="AR"
        onChange={() => setCountry('Argentina')}
        options={COUNTRIES}
        helperText="Argentina es el único país soportado en v1."
      />
      <Select
        label="Provincia"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        options={PROVINCES_AR.map((p) => ({ value: p, label: p }))}
      />
    </StepCard>
  );
}
