import { useState } from 'react';
import { Wallet, Landmark, Percent, TrendingDown, BadgePercent, PiggyBank, LineChart, Briefcase, Receipt } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, ResultCard, ResultRow } from '@/components/ui';

function EMITab() {
  const [p, setP] = useState('100000'); const [r, setR] = useState('8'); const [n, setN] = useState('5');
  const pv = parseFloat(p), rate = parseFloat(r) / 1200, months = parseFloat(n) * 12;
  const emi = rate ? pv * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1) : pv / months;
  const total = emi * months; const interest = total - pv;
  return (
    <div className="space-y-4">
      <Field label="Loan amount"><input type="number" value={p} onChange={(e) => setP(e.target.value)} className="input-base" /></Field>
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Annual rate %"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
        <Field label="Years"><input type="number" value={n} onChange={(e) => setN(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(emi) && pv >= 0 && rate >= 0 && months > 0 && (
        <div className="space-y-2">
          <ResultCard label="Monthly payment" value={emi.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Total interest" value={interest.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Total payable" value={total.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        </div>
      )}
    </div>
  );
}

function InterestTab() {
  const [p, setP] = useState('10000'); const [r, setR] = useState('5'); const [t, setT] = useState('3'); const [n, setN] = useState('12');
  const pv = parseFloat(p), rate = parseFloat(r) / 100, time = parseFloat(t), freq = parseFloat(n);
  const ci = pv * Math.pow(1 + rate / freq, freq * time);
  const si = pv * rate * time;
  return (
    <div className="space-y-4">
      <Field label="Principal"><input type="number" value={p} onChange={(e) => setP(e.target.value)} className="input-base" /></Field>
      <div className="grid grid-cols-3 gap-3 responsive-fields">
        <Field label="Rate %"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
        <Field label="Years"><input type="number" value={t} onChange={(e) => setT(e.target.value)} className="input-base" /></Field>
        <Field label="Freq/yr"><input type="number" value={n} onChange={(e) => setN(e.target.value)} className="input-base" /></Field>
      </div>
      {[pv, rate, time, freq, ci, si].every(Number.isFinite) && pv >= 0 && rate >= 0 && time >= 0 && freq > 0 && <div className="space-y-2">
        <ResultCard label="Compound interest" value={(ci - pv).toLocaleString(undefined, { maximumFractionDigits: 2 })} sub={`Total: ${ci.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <ResultCard label="Simple interest" value={si.toLocaleString(undefined, { maximumFractionDigits: 2 })} sub={`Total: ${(pv + si).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
      </div>}
    </div>
  );
}

function GSTTab() {
  const [amt, setAmt] = useState('1000'); const [rate, setRate] = useState('18');
  const a = parseFloat(amt), r = parseFloat(rate);
  const net = a / (1 + r / 100); const tax = a - net;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Amount (tax-inclusive)"><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} className="input-base" /></Field>
        <Field label="Tax rate %"><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="input-base" /></Field>
      </div>
      {Number.isFinite(a) && a >= 0 && Number.isFinite(r) && r >= 0 && <div className="space-y-2">
        <ResultCard label="Tax amount" value={tax.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <ResultRow label="Net (ex-tax)" value={net.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <ResultRow label="Gross (inc-tax)" value={a.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>}
    </div>
  );
}

function DiscountTab() {
  const [price, setPrice] = useState('200'); const [disc, setDisc] = useState('25');
  const p = parseFloat(price), d = parseFloat(disc);
  const saved = p * d / 100; const final = p - saved;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Original price"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-base" /></Field>
        <Field label="Discount %"><input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} className="input-base" /></Field>
      </div>
      {Number.isFinite(p) && p >= 0 && Number.isFinite(d) && d >= 0 && d <= 100 && <div className="space-y-2">
        <ResultCard label="You save" value={saved.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <ResultCard label="Final price" value={final.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>}
    </div>
  );
}

function ProfitLossTab() {
  const [cost, setCost] = useState('100'); const [sell, setSell] = useState('150');
  const c = parseFloat(cost), s = parseFloat(sell);
  const pl = s - c; const pct = c ? (pl / c * 100) : 0;
  const profit = pl >= 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Cost price"><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="input-base" /></Field>
        <Field label="Selling price"><input type="number" value={sell} onChange={(e) => setSell(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(pl) && c > 0 && s >= 0 && (
        <div className={`rounded-xl p-4 text-center border ${profit ? 'bg-success-500/10 border-success-500/30' : 'bg-error-500/10 border-error-500/30'}`}>
          <div className="text-xs text-muted uppercase">{profit ? 'Profit' : 'Loss'}</div>
          <div className={`text-2xl font-bold font-mono ${profit ? 'text-success-500' : 'text-error-500'}`}>{Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-muted mt-1">{pct.toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}

function InvestmentTab() {
  const [p, setP] = useState('50000'); const [r, setR] = useState('7'); const [t, setT] = useState('10'); const [freq, setFreq] = useState('12');
  const pv = parseFloat(p), rate = parseFloat(r) / 100, time = parseFloat(t), f = parseFloat(freq);
  const fv = pv * Math.pow(1 + rate / f, f * time);
  const gain = fv - pv;
  return (
    <div className="space-y-4">
      <Field label="Initial investment"><input type="number" value={p} onChange={(e) => setP(e.target.value)} className="input-base" /></Field>
      <div className="grid grid-cols-3 gap-3 responsive-fields">
        <Field label="Rate %"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
        <Field label="Years"><input type="number" value={t} onChange={(e) => setT(e.target.value)} className="input-base" /></Field>
        <Field label="Freq/yr"><input type="number" value={freq} onChange={(e) => setFreq(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(fv) && pv > 0 && rate >= 0 && time >= 0 && f > 0 && (
        <div className="space-y-2">
          <ResultCard label="Future value" value={fv.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Total gain" value={gain.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Return multiple" value={(fv / pv).toFixed(2) + '×'} />
        </div>
      )}
    </div>
  );
}

function SavingsTab() {
  const [p, setP] = useState('1000'); const [monthly, setMonthly] = useState('500'); const [r, setR] = useState('6'); const [t, setT] = useState('20');
  const pv = parseFloat(p), pmt = parseFloat(monthly), rate = parseFloat(r) / 100 / 12, n = parseFloat(t) * 12;
  const fvP = pv * Math.pow(1 + rate, n);
  const fvPmt = rate ? pmt * ((Math.pow(1 + rate, n) - 1) / rate) : pmt * n;
  const total = fvP + fvPmt; const contributed = pv + pmt * n;
  return (
    <div className="space-y-4">
      <Field label="Starting amount"><input type="number" value={p} onChange={(e) => setP(e.target.value)} className="input-base" /></Field>
      <div className="grid grid-cols-3 gap-3 responsive-fields">
        <Field label="Monthly deposit"><input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="input-base" /></Field>
        <Field label="Rate %"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
        <Field label="Years"><input type="number" value={t} onChange={(e) => setT(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(total) && pv >= 0 && pmt >= 0 && rate >= 0 && n >= 0 && (
        <div className="space-y-2">
          <ResultCard label="Total balance" value={total.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Total contributed" value={contributed.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <ResultRow label="Interest earned" value={(total - contributed).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        </div>
      )}
    </div>
  );
}

function RetirementTab() {
  const [current, setCurrent] = useState('30'); const [retire, setRetire] = useState('65'); const [need, setNeed] = useState('40000'); const [r, setR] = useState('6'); const [inflation, setInflation] = useState('3');
  const ageNow = parseFloat(current), ageRetire = parseFloat(retire), annualNeed = parseFloat(need), rate = parseFloat(r) / 100, infl = parseFloat(inflation) / 100;
  const yearsToRetire = ageRetire - ageNow;
  const futureNeed = annualNeed * Math.pow(1 + infl, yearsToRetire);
  const nestEgg = rate > 0 ? futureNeed / rate : NaN;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Current age"><input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} className="input-base" /></Field>
        <Field label="Retire age"><input type="number" value={retire} onChange={(e) => setRetire(e.target.value)} className="input-base" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3 responsive-fields">
        <Field label="Annual need today"><input type="number" value={need} onChange={(e) => setNeed(e.target.value)} className="input-base" /></Field>
        <Field label="Withdrawal rate %"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
        <Field label="Inflation %"><input type="number" value={inflation} onChange={(e) => setInflation(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(nestEgg) && yearsToRetire >= 0 && annualNeed >= 0 && infl >= 0 && (
        <div className="space-y-2">
          <ResultCard label="Nest egg needed" value={nestEgg.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub={`Assumed withdrawal rate: ${(rate * 100).toFixed(2)}%`} />
          <ResultRow label="Annual need at retirement" value={futureNeed.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
          <ResultRow label="Years to retire" value={String(yearsToRetire)} />
        </div>
      )}
    </div>
  );
}

function TipTab() {
  const [bill, setBill] = useState('50'); const [tipPct, setTipPct] = useState('15'); const [people, setPeople] = useState('1');
  const b = parseFloat(bill), t = parseFloat(tipPct), p = Math.max(1, parseInt(people) || 1);
  const tip = b * (t / 100); const total = b + tip; const perPerson = total / p;
  return (
    <div className="space-y-4">
      <Field label="Bill amount"><input type="number" value={bill} onChange={(e) => setBill(e.target.value)} className="input-base" /></Field>
      <Field label="Tip %"><input type="number" value={tipPct} onChange={(e) => setTipPct(e.target.value)} className="input-base" /></Field>
      <div className="flex gap-2 flex-wrap">
        {[10, 15, 18, 20, 25].map((v) => (
          <button key={v} onClick={() => setTipPct(String(v))} className={`px-3 py-1.5 rounded-lg text-sm ${tipPct === String(v) ? 'bg-primary-500 text-white' : 'bg-surface-2 text-muted'}`}>{v}%</button>
        ))}
      </div>
      <Field label="Split between (people)"><input type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} className="input-base" /></Field>
      {isFinite(total) && b >= 0 && t >= 0 && (
        <div className="space-y-2">
          <ResultCard label="Total bill" value={total.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
          <ResultRow label="Tip amount" value={tip.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
          <ResultRow label="Per person" value={perPerson.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
        </div>
      )}
    </div>
  );
}

export default function FinanceModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('emi');
  return (
    <Panel>
      <ToolHeader title="Finance" subtitle="EMI, interest, GST, discount, P/L, investing, tip" icon={Wallet} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'emi', label: 'EMI', icon: Landmark },
        { id: 'interest', label: 'Interest', icon: Percent },
        { id: 'gst', label: 'GST/VAT', icon: BadgePercent },
        { id: 'discount', label: 'Discount', icon: TrendingDown },
        { id: 'profit', label: 'P/L', icon: Wallet },
        { id: 'invest', label: 'Invest', icon: LineChart },
        { id: 'savings', label: 'Savings', icon: PiggyBank },
        { id: 'retire', label: 'Retirement', icon: Briefcase },
        { id: 'tip', label: 'Tip', icon: Receipt },
      ]} />
      <div className="mt-4">
        {tab === 'emi' && <EMITab />}
        {tab === 'interest' && <InterestTab />}
        {tab === 'gst' && <GSTTab />}
        {tab === 'discount' && <DiscountTab />}
        {tab === 'profit' && <ProfitLossTab />}
        {tab === 'invest' && <InvestmentTab />}
        {tab === 'savings' && <SavingsTab />}
        {tab === 'retire' && <RetirementTab />}
        {tab === 'tip' && <TipTab />}
      </div>
    </Panel>
  );
}
