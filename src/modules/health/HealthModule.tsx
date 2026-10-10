import { useState } from 'react';
import { bodyFat } from '@/lib/health';
import { HeartPulse, Activity, Droplets, Flame } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, ResultCard, ResultRow, Select } from '@/components/ui';

function BMITab() {
  const [unit, setUnit] = useState('metric');
  const [w, setW] = useState('70'); const [h, setH] = useState('175');
  const weight = parseFloat(w);
  let bmi = 0;
  if (unit === 'metric') { const hm = parseFloat(h) / 100; bmi = weight / (hm * hm); }
  else { const inH = parseFloat(h); bmi = (weight / (inH * inH)) * 703; }
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const color = bmi < 18.5 ? 'text-warning-500' : bmi < 25 ? 'text-success-500' : bmi < 30 ? 'text-warning-500' : 'text-error-500';
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['metric', 'imperial'].map((u) => (
          <button key={u} onClick={() => setUnit(u)} className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${unit === u ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>{u}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label={unit === 'metric' ? 'Weight (kg)' : 'Weight (lb)'}><input type="number" value={w} onChange={(e) => setW(e.target.value)} className="input-base" /></Field>
        <Field label={unit === 'metric' ? 'Height (cm)' : 'Height (in)'}><input type="number" value={h} onChange={(e) => setH(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(bmi) && bmi > 0 && parseFloat(h) > 0 && (
        <div className="rounded-xl bg-primary-500/8 border border-primary-500/20 p-4 text-center">
          <div className="text-xs text-muted uppercase">BMI</div>
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 font-mono">{bmi.toFixed(1)}</div>
          <div className={`text-sm font-semibold mt-1 ${color}`}>{cat}</div>
        </div>
      )}
    </div>
  );
}

function BMRTab() {
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('25'); const [w, setW] = useState('70'); const [h, setH] = useState('175');
  const a = parseFloat(age), weight = parseFloat(w), height = parseFloat(h);
  // Mifflin-St Jeor
  const bmr = gender === 'male' ? 10 * weight + 6.25 * height - 5 * a + 5 : 10 * weight + 6.25 * height - 5 * a - 161;
  return (
    <div className="space-y-4">
      <Field label="Gender"><Select value={gender} onChange={setGender}><option value="male">Male</option><option value="female">Female</option></Select></Field>
      <div className="grid grid-cols-3 gap-3 responsive-fields">
        <Field label="Age"><input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-base" /></Field>
        <Field label="Weight (kg)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} className="input-base" /></Field>
        <Field label="Height (cm)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(bmr) && a >= 18 && weight > 0 && height > 0 && bmr > 0 && (
        <div>
          <ResultCard label="BMR (cal/day)" value={bmr.toFixed(0)} sub="Mifflin-St Jeor" />
          <div className="mt-3">
            <div className="text-xs text-muted mb-2">Daily calories by activity</div>
            <ResultRow label="Sedentary" value={(bmr * 1.2).toFixed(0)} />
            <ResultRow label="Light (1-3×/wk)" value={(bmr * 1.375).toFixed(0)} />
            <ResultRow label="Moderate (3-5×/wk)" value={(bmr * 1.55).toFixed(0)} />
            <ResultRow label="Active (6-7×/wk)" value={(bmr * 1.725).toFixed(0)} />
          </div>
        </div>
      )}
    </div>
  );
}

function BodyFatTab() {
  const [gender, setGender] = useState('male');
  const [hip, setHip] = useState('95'); const [waist, setWaist] = useState('85'); const [neck, setNeck] = useState('38'); const [h, setH] = useState('175');
  const waistCm = parseFloat(waist), neckCm = parseFloat(neck), heightCm = parseFloat(h);
  const bf = bodyFat(gender, waistCm, neckCm, heightCm, parseFloat(hip));
  return (
    <div className="space-y-4">
      <Field label="Gender"><Select value={gender} onChange={setGender}><option value="male">Male</option><option value="female">Female</option></Select></Field>
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        {gender === 'female' && <Field label="Hip (cm)"><input type="number" min={1} value={hip} onChange={(e) => setHip(e.target.value)} className="input-base" /></Field>}
        <Field label="Height (cm)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} className="input-base" /></Field>
        <Field label="Waist (cm)"><input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} className="input-base" /></Field>
        <Field label="Neck (cm)"><input type="number" value={neck} onChange={(e) => setNeck(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(bf) && bf > 0 && <ResultCard label="Body fat %" value={bf.toFixed(1) + '%'} sub="Circumference estimate" />}
    </div>
  );
}

function WaterTab() {
  const [w, setW] = useState('70'); const [activity, setActivity] = useState('30');
  const weight = parseFloat(w), act = parseFloat(activity);
  // 35 ml/kg + activity adjustment
  const base = weight * 35;
  const extra = act * 12;
  const total = (base + extra) / 1000;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Weight (kg)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} className="input-base" /></Field>
        <Field label="Exercise (min/day)"><input type="number" value={activity} onChange={(e) => setActivity(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(total) && weight > 0 && act >= 0 && (
        <div className="space-y-2">
          <ResultCard label="Daily water intake" value={total.toFixed(2) + ' L'} sub={`≈ ${(total * 4).toFixed(0)} cups`} />
          <ResultRow label="In ounces" value={(total * 33.814).toFixed(0) + ' fl oz'} />
        </div>
      )}
    </div>
  );
}

function HeartRateTab() {
  const [age, setAge] = useState('30'); const [resting, setResting] = useState('65');
  const a = parseFloat(age), r = parseFloat(resting);
  const max = 220 - a;
  const reserve = max - r;
  const zone = (lo: number, hi: number) => `${Math.round(r + reserve * lo)} – ${Math.round(r + reserve * hi)}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Age"><input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-base" /></Field>
        <Field label="Resting HR"><input type="number" value={resting} onChange={(e) => setResting(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(max) && a >= 18 && a < 100 && r > 0 && r < max && (
        <div>
          <ResultCard label="Max heart rate" value={String(max)} sub="220 - age" />
          <div className="mt-3">
            <div className="text-xs text-muted mb-2">Training zones (Karvonen)</div>
            <ResultRow label="Zone 1 · Warm-up (50-60%)" value={zone(0.5, 0.6)} />
            <ResultRow label="Zone 2 · Fat burn (60-70%)" value={zone(0.6, 0.7)} />
            <ResultRow label="Zone 3 · Aerobic (70-80%)" value={zone(0.7, 0.8)} />
            <ResultRow label="Zone 4 · Anaerobic (80-90%)" value={zone(0.8, 0.9)} />
            <ResultRow label="Zone 5 · Max (90-100%)" value={zone(0.9, 1.0)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HealthModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('bmi');
  return (
    <Panel>
      <ToolHeader title="Health" subtitle="BMI, BMR, body fat, water, heart rate" icon={HeartPulse} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'bmi', label: 'BMI', icon: Activity },
        { id: 'bmr', label: 'BMR', icon: Flame },
        { id: 'bodyfat', label: 'Body Fat', icon: Activity },
        { id: 'water', label: 'Water', icon: Droplets },
        { id: 'heart', label: 'Heart Rate', icon: HeartPulse },
      ]} />
      <div className="mt-4">
        {tab === 'bmi' && <BMITab />}
        {tab === 'bmr' && <BMRTab />}
        {tab === 'bodyfat' && <BodyFatTab />}
        {tab === 'water' && <WaterTab />}
        {tab === 'heart' && <HeartRateTab />}
      </div>
    </Panel>
  );
}
