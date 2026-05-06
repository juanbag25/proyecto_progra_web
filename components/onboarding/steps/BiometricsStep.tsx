'use client';

import { useMemo, useState } from 'react';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { biometricsSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { StepCard } from '../StepCard';

type Gender = 'male' | 'female' | 'other';

interface Props {
  initial: {
    age?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
    gender?: string | null;
  };
  onContinue: (data: { age: number; weight_kg: number; height_cm: number; gender: Gender }) => void;
  onBack?: () => void;
}

export function BiometricsStep({ initial, onContinue, onBack }: Props) {
  const [age, setAge] = useState(initial.age ?? 25);
  const [weight, setWeight] = useState(initial.weight_kg ? Number(initial.weight_kg) : 70);
  const [height, setHeight] = useState(initial.height_cm ? Number(initial.height_cm) : 170);
  const [gender, setGender] = useState<Gender>((initial.gender as Gender) ?? 'male');

  const data = useMemo(
    () => ({ age, weight_kg: weight, height_cm: height, gender }),
    [age, weight, height, gender],
  );
  const valid = biometricsSchema.safeParse(data).success;
  const { submit, submitting } = useStepSubmit('biometrics', onContinue);

  return (
    <StepCard
      title="Empezamos."
      subtitle="¿Cuántos años tenés? ¿Cuánto pesás? ¿Cuánto medís? Lo necesitamos para tu metabolismo basal."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberInput
          label="Edad"
          unit="años"
          min={13}
          max={100}
          step={1}
          value={age}
          onChange={setAge}
        />
        <Select
          label="Género"
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
          options={[
            { value: 'male', label: 'Masculino' },
            { value: 'female', label: 'Femenino' },
            { value: 'other', label: 'Otro' },
          ]}
        />
        <NumberInput
          label="Peso"
          unit="kg"
          min={30}
          max={300}
          step={0.5}
          value={weight}
          onChange={setWeight}
        />
        <NumberInput
          label="Altura"
          unit="cm"
          min={100}
          max={250}
          step={1}
          value={height}
          onChange={setHeight}
        />
      </div>
    </StepCard>
  );
}
