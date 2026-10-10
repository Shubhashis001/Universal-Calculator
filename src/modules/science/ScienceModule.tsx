import { useState } from 'react';
import { Atom, BookOpen } from 'lucide-react';
import { Panel, ToolHeader, Tabs } from '@/components/ui';

const PHYSICAL_CONSTANTS = [
  { name: 'Speed of light', symbol: 'c', value: '299,792,458 m/s' },
  { name: 'Gravitational constant', symbol: 'G', value: '6.674×10⁻¹¹ N·m²/kg²' },
  { name: 'Planck constant', symbol: 'h', value: '6.626×10⁻³⁴ J·s' },
  { name: 'Reduced Planck', symbol: 'ℏ', value: '1.055×10⁻³⁴ J·s' },
  { name: 'Electron charge', symbol: 'e', value: '1.602×10⁻¹⁹ C' },
  { name: 'Electron mass', symbol: 'mₑ', value: '9.109×10⁻³¹ kg' },
  { name: 'Proton mass', symbol: 'mₚ', value: '1.673×10⁻²⁷ kg' },
  { name: 'Neutron mass', symbol: 'mₙ', value: '1.675×10⁻²⁷ kg' },
  { name: 'Avogadro number', symbol: 'Nₐ', value: '6.022×10²³ /mol' },
  { name: 'Boltzmann constant', symbol: 'k', value: '1.381×10⁻²³ J/K' },
  { name: 'Gas constant', symbol: 'R', value: '8.314 J/(mol·K)' },
  { name: 'Stefan-Boltzmann', symbol: 'σ', value: '5.670×10⁻⁸ W/(m²·K⁴)' },
  { name: 'Permittivity of vacuum', symbol: 'ε₀', value: '8.854×10⁻¹² F/m' },
  { name: 'Permeability of vacuum', symbol: 'μ₀', value: '1.257×10⁻⁶ H/m' },
  { name: 'Fine-structure', symbol: 'α', value: '7.297×10⁻³' },
  { name: 'Rydberg constant', symbol: 'R∞', value: '1.097×10⁷ /m' },
  { name: 'Bohr radius', symbol: 'a₀', value: '5.292×10⁻¹¹ m' },
  { name: 'Standard gravity', symbol: 'g', value: '9.80665 m/s²' },
  { name: 'Atmospheric pressure', symbol: 'atm', value: '101,325 Pa' },
];

const MATH_CONSTANTS = [
  { name: 'Pi', symbol: 'π', value: '3.141592653589793' },
  { name: 'Euler\'s number', symbol: 'e', value: '2.718281828459045' },
  { name: 'Golden ratio', symbol: 'φ', value: '1.618033988749895' },
  { name: 'Silver ratio', symbol: 'δₛ', value: '2.414213562373095' },
  { name: 'Square root of 2', symbol: '√2', value: '1.4142135623730951' },
  { name: 'Square root of 3', symbol: '√3', value: '1.7320508075688772' },
  { name: 'Euler-Mascheroni', symbol: 'γ', value: '0.5772156649015329' },
  { name: 'Apéry\'s constant', symbol: 'ζ(3)', value: '1.2020569031595943' },
  { name: 'Catalan\'s constant', symbol: 'G', value: '0.9159655941772190' },
  { name: 'Feigenbaum δ', symbol: 'δ', value: '4.669201609102990' },
];

const SI_PREFIXES = [
  { pre: 'quetta', sym: 'Q', exp: 30 },
  { pre: 'ronna', sym: 'R', exp: 27 },
  { pre: 'yotta', sym: 'Y', exp: 24 },
  { pre: 'zetta', sym: 'Z', exp: 21 },
  { pre: 'exa', sym: 'E', exp: 18 },
  { pre: 'peta', sym: 'P', exp: 15 },
  { pre: 'tera', sym: 'T', exp: 12 },
  { pre: 'giga', sym: 'G', exp: 9 },
  { pre: 'mega', sym: 'M', exp: 6 },
  { pre: 'kilo', sym: 'k', exp: 3 },
  { pre: 'hecto', sym: 'h', exp: 2 },
  { pre: 'deca', sym: 'da', exp: 1 },
  { pre: '', sym: '—', exp: 0 },
  { pre: 'deci', sym: 'd', exp: -1 },
  { pre: 'centi', sym: 'c', exp: -2 },
  { pre: 'milli', sym: 'm', exp: -3 },
  { pre: 'micro', sym: 'µ', exp: -6 },
  { pre: 'nano', sym: 'n', exp: -9 },
  { pre: 'pico', sym: 'p', exp: -12 },
  { pre: 'femto', sym: 'f', exp: -15 },
  { pre: 'atto', sym: 'a', exp: -18 },
  { pre: 'zepto', sym: 'z', exp: -21 },
  { pre: 'yocto', sym: 'y', exp: -24 },
];

export default function ScienceModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('physical');
  return (
    <Panel>
      <ToolHeader title="Science Reference" subtitle="Constants, SI prefixes, formula library" icon={Atom} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'physical', label: 'Physics', icon: Atom },
        { id: 'math', label: 'Math', icon: BookOpen },
        { id: 'si', label: 'SI Prefixes', icon: Atom },
      ]} />
      <div className="mt-4">
        {tab === 'physical' && (
          <div className="space-y-1.5">
            {PHYSICAL_CONSTANTS.map((c) => (
              <div key={c.name} className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2">
                <div><span className="text-sm text-base-c">{c.name}</span><span className="text-xs text-muted ml-2 font-mono">{c.symbol}</span></div>
                <span className="font-mono text-sm text-primary-600 dark:text-primary-400 text-right">{c.value}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'math' && (
          <div className="space-y-1.5">
            {MATH_CONSTANTS.map((c) => (
              <div key={c.name} className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2">
                <div><span className="text-sm text-base-c">{c.name}</span><span className="text-xs text-muted ml-2 font-mono">{c.symbol}</span></div>
                <span className="font-mono text-sm text-primary-600 dark:text-primary-400">{c.value}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'si' && (
          <div className="grid grid-cols-2 gap-1.5">
            {SI_PREFIXES.map((p) => (
              <div key={p.sym + p.pre} className="flex justify-between items-center px-3 py-2 rounded-lg bg-surface-2">
                <span className="text-sm text-base-c">{p.pre || '(base)'}</span>
                <div className="text-right"><span className="font-mono text-sm text-base-c">{p.sym}</span><span className="text-xs text-muted ml-2">10^{p.exp}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
