
'use client';
import { useState } from 'react';
export default function Dashboard(){
  const [credits,setCredits] = useState(1000);
  const [apiKey,setApiKey] = useState('vk_live_51H7x...');
  const [csvRows,setCsvRows] = useState<any[]>([]);
  return <div><h1>Dashboard</h1><p>Credits: {credits}</p><p>API Key: {apiKey} <button onClick={()=>navigator.clipboard.writeText(apiKey)}>Copy</button></p><h2>Bulk CSV</h2><input type='file' accept='.csv' onChange={e=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>{ const text=r.result as string; const rows=text.split('\n').slice(1,6).map(l=>({raw:l, status:'valid'})); setCsvRows(rows); setCredits(c=>c-rows.length); }; r.readAsText(f); }}} /><div>{csvRows.map((r,i)=><div key={i}>{r.raw} - {r.status}</div>)}</div></div>
}
