import React, { useState } from 'react';

export type PaywayAdminForm = {
  branchId: string;
  cuitCuil: string;
  baseUrl: string;
  apikey: string;
  defaultMerchantId: string;
  defaultTerminalId: string;
  defaultSerial: string;
  pollIntervalMs: number;
  pollMaxSeconds: number;
  settlementTime?: string;
  splitPolicy: 'ALL_OR_NOTHING'|'PARCIAL_PERMITIDO';
  allowUnrefRefund: boolean;
};

type Props = {
  initial?: Partial<PaywayAdminForm>;
  onSave: (cfg: PaywayAdminForm) => Promise<void>;
  onTestConnection: (cfg: PaywayAdminForm) => Promise<{ ok: boolean; message?: string }>;
  onTestPayment?: (cfg: PaywayAdminForm) => Promise<{ ok: boolean; message?: string }>;
  onSettlementNow?: (cfg: PaywayAdminForm) => Promise<{ ok: boolean; message?: string }>;
};

export default function PaywayAdmin({ initial, onSave, onTestConnection, onTestPayment, onSettlementNow }: Props){
  const [form, setForm] = useState<PaywayAdminForm>({
    branchId: '', cuitCuil: '', baseUrl: '', apikey: '',
    defaultMerchantId: '', defaultTerminalId: '', defaultSerial: '',
    pollIntervalMs: 1500, pollMaxSeconds: 120, settlementTime: '23:55',
    splitPolicy: 'ALL_OR_NOTHING', allowUnrefRefund: false, ...initial
  });
  const [msg, setMsg] = useState<string>('');

  const input = (k: keyof PaywayAdminForm, type: 'text'|'number'|'password' = 'text') => (
    <div className="mb-3">
      <label className="block text-sm mb-1">{k}</label>
      <input className="w-full border rounded px-2 py-1"
        type={type}
        value={(form[k] as any) ?? ''}
        onChange={(e)=> setForm(f => ({...f, [k]: type==='number' ? Number(e.target.value) : e.target.value}))}/>
    </div>
  );

  return (
    <div className="p-4 max-w-3xl">
      <h2 className="text-xl font-bold mb-4">Payway · Configuración</h2>
      <div className="grid grid-cols-2 gap-4">
        {input('branchId')}
        {input('cuitCuil')}
        {input('baseUrl')}
        {input('apikey','password')}
        {input('defaultMerchantId')}
        {input('defaultTerminalId')}
        {input('defaultSerial')}
        {input('pollIntervalMs','number')}
        {input('pollMaxSeconds','number')}
        {input('settlementTime')}
      </div>
      <div className="mb-3">
        <label className="block text-sm mb-1">splitPolicy</label>
        <select className="border rounded px-2 py-1"
          value={form.splitPolicy}
          onChange={e=> setForm(f => ({...f, splitPolicy: e.target.value as any}))}>
          <option value="ALL_OR_NOTHING">ALL_OR_NOTHING</option>
          <option value="PARCIAL_PERMITIDO">PARCIAL_PERMITIDO</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={form.allowUnrefRefund}
            onChange={e => setForm(f => ({...f, allowUnrefRefund: e.target.checked}))}/>
          <span>Permitir refund no referenciado (si cuenta habilitada)</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={async()=>{ setMsg(''); await onSave(form); setMsg('Guardado');}}>Guardar</button>
        <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={async()=>{ setMsg(''); const r = await onTestConnection(form); setMsg(r.ok ? 'Conexión OK' : (r.message || 'Fallo prueba'));}}>Probar conexión</button>
        {onTestPayment && <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={async()=>{ setMsg(''); const r = await onTestPayment(form); setMsg(r.ok ? 'Pago $1 OK' : (r.message || 'Fallo pago'));}}>Pago $1</button>}
        {onSettlementNow && <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={async()=>{ setMsg(''); const r = await onSettlementNow(form); setMsg(r.ok ? 'Cierre de lote OK' : (r.message || 'Fallo cierre'));}}>Cierre de lote</button>}
      </div>
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  );
}
