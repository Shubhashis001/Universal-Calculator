import { lazy, type ComponentType } from 'react';
import {
  Calculator, Ruler, Coins, CalendarClock, Sigma, Wallet, HeartPulse,
  Code2, Type, QrCode, Atom, StickyNote, Dices, BookOpen, type LucideIcon,
} from 'lucide-react';

const CalculatorModule = lazy(() => import('@/modules/calculator/CalculatorModule'));
const ConverterModule = lazy(() => import('@/modules/converter/ConverterModule'));
const CurrencyModule = lazy(() => import('@/modules/currency/CurrencyModule'));
const DateTimeModule = lazy(() => import('@/modules/datetime/DateTimeModule'));
const MathModule = lazy(() => import('@/modules/math/MathModule'));
const FinanceModule = lazy(() => import('@/modules/finance/FinanceModule'));
const HealthModule = lazy(() => import('@/modules/health/HealthModule'));
const ProgrammingModule = lazy(() => import('@/modules/programming/ProgrammingModule'));
const TextModule = lazy(() => import('@/modules/text/TextModule'));
const QRModule = lazy(() => import('@/modules/qr/QRModule'));
const ScienceModule = lazy(() => import('@/modules/science/ScienceModule'));
const ProductivityModule = lazy(() => import('@/modules/productivity/ProductivityModule'));
const RandomModule = lazy(() => import('@/modules/random/RandomModule'));
const FormulaModule = lazy(() => import('@/modules/formulas/FormulaModule'));

export interface ToolProps {
  starred?: boolean;
  onStar?: () => void;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: string;
  keywords: string[];
  component: ComponentType<ToolProps>;
}

export const tools: Tool[] = [
  {
    id: 'calculator', name: 'Calculator', description: 'Scientific calculator with history and memory',
    icon: Calculator, group: 'Math', keywords: ['arithmetic', 'scientific', 'trig', 'log', 'power'],
    component: CalculatorModule,
  },
  {
    id: 'converter', name: 'Unit Converter', description: 'Length, mass, temperature, data & more',
    icon: Ruler, group: 'Convert', keywords: ['length', 'mass', 'volume', 'temperature', 'pressure', 'data'],
    component: ConverterModule,
  },
  {
    id: 'currency', name: 'Currency Converter', description: 'Live exchange rates with favorites',
    icon: Coins, group: 'Convert', keywords: ['money', 'exchange', 'forex', 'usd', 'eur'],
    component: CurrencyModule,
  },
  {
    id: 'datetime', name: 'Date & Time', description: 'Age, date diff, stopwatch, timer, world clock',
    icon: CalendarClock, group: 'Time', keywords: ['age', 'stopwatch', 'timer', 'world clock', 'timezone'],
    component: DateTimeModule,
  },
  {
    id: 'math', name: 'Mathematics', description: 'Percent, stats, fractions, combinatorics, trig',
    icon: Sigma, group: 'Math', keywords: ['percentage', 'statistics', 'fraction', 'permutation', 'combination'],
    component: MathModule,
  },
  {
    id: 'finance', name: 'Finance', description: 'EMI, loan, interest, GST, discount, profit/loss',
    icon: Wallet, group: 'Finance', keywords: ['emi', 'loan', 'interest', 'gst', 'vat', 'discount', 'profit'],
    component: FinanceModule,
  },
  {
    id: 'health', name: 'Health', description: 'BMI, BMR, body fat, water, calorie, heart rate',
    icon: HeartPulse, group: 'Health', keywords: ['bmi', 'bmr', 'calorie', 'water', 'heart rate'],
    component: HealthModule,
  },
  {
    id: 'programming', name: 'Programming Tools', description: 'Base convert, Base64, JSON, UUID, hash, regex',
    icon: Code2, group: 'Dev', keywords: ['binary', 'hex', 'base64', 'json', 'uuid', 'sha256', 'regex', 'url'],
    component: ProgrammingModule,
  },
  {
    id: 'text', name: 'Text Tools', description: 'Counter, case, dedupe, sort, find/replace, markdown',
    icon: Type, group: 'Text', keywords: ['word count', 'character', 'case', 'sort', 'markdown', 'escape'],
    component: TextModule,
  },
  {
    id: 'qr', name: 'QR Generator', description: 'Generate QR codes for any text or link',
    icon: QrCode, group: 'Productivity', keywords: ['qr code', 'generate'],
    component: QRModule,
  },
  {
    id: 'science', name: 'Science Reference', description: 'Constants, SI prefixes, formula library',
    icon: Atom, group: 'Reference', keywords: ['physical constants', 'si prefix', 'formulas', 'chemistry'],
    component: ScienceModule,
  },
  {
    id: 'productivity', name: 'Productivity', description: 'Notes, to-do list, checklist — saved offline',
    icon: StickyNote, group: 'Productivity', keywords: ['notes', 'todo', 'to-do', 'checklist', 'task'],
    component: ProductivityModule,
  },
  {
    id: 'random', name: 'Random & Chance', description: 'Dice roller, coin flip, lottery picker, random pick, shuffle',
    icon: Dices, group: 'Fun', keywords: ['dice', 'coin', 'flip', 'lottery', 'random', 'shuffle', 'pick', 'chance', 'number'],
    component: RandomModule,
  },
  {
    id: 'formulas', name: 'Formula Reference', description: 'Searchable library of physics, chemistry & math formulas',
    icon: BookOpen, group: 'Reference', keywords: ['formula', 'physics', 'chemistry', 'math', 'equation', 'reference', 'study', 'student', 'science'],
    component: FormulaModule,
  },
];

export const toolMap = Object.fromEntries(tools.map((t) => [t.id, t]));

export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools
    .map((t) => {
      let score = 0;
      if (t.name.toLowerCase().includes(q)) score += 10;
      if (t.name.toLowerCase().startsWith(q)) score += 8;
      if (t.description.toLowerCase().includes(q)) score += 3;
      if (t.keywords.some((k) => k.includes(q))) score += 5;
      if (t.group.toLowerCase().includes(q)) score += 2;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
