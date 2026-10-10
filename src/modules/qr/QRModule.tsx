import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download } from 'lucide-react';
import { Panel, ToolHeader, Field } from '@/components/ui';

export default function QRModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [text, setText] = useState('https://example.com');
  const [size, setSize] = useState(256);
  const [dark, setDark] = useState('#0f172a');
  const [light, setLight] = useState('#ffffff');
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setDataUrl(''); setError('');
    if (!text.trim()) return;
    if (!Number.isInteger(size) || size < 64 || size > 1024) { setError('Size must be an integer from 64 to 1024 pixels.'); return; }
    const timer = window.setTimeout(() => {
      QRCode.toDataURL(text, { width: size, margin: 2, color: { dark, light }, errorCorrectionLevel: 'M' })
        .then((url) => { if (current) { setDataUrl(url); setError(''); } })
        .catch((error: unknown) => { if (current) { setError(error instanceof Error ? error.message : 'Could not generate QR code'); setDataUrl(''); } });
    }, 150);
    return () => { current = false; clearTimeout(timer); };
  }, [text, size, dark, light]);

  return (
    <Panel>
      <ToolHeader title="QR Generator" subtitle="Create QR codes for links, text, or contact info" icon={QrCode} onStar={onStar} starred={starred} />
      <div className="space-y-4">
        <Field label="Content"><textarea maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[70px]" placeholder="Enter text or URL" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Size (px)"><input type="number" value={size} min="64" max="1024" step="32" onChange={(e) => setSize(+e.target.value)} className="input-base" /></Field>
          <Field label="Dark color"><input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="input-base h-[42px] !p-1" /></Field>
          <Field label="Light color"><input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="input-base h-[42px] !p-1" /></Field>
        </div>
        {error && <div className="text-sm text-error-500">{error}</div>}
        {dataUrl && (
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={dataUrl} alt="Generated QR code" className="rounded-lg border border-c" style={{ maxWidth: '100%' }} />
            <a href={dataUrl} download="qr-code.png" className="btn btn-primary"><Download size={16} /> Download PNG</a>
          </div>
        )}
      </div>
    </Panel>
  );
}
