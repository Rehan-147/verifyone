
'use client';
import { useState } from 'react';
import { validatePhone, verifyEmail, ipLookup } from '../lib/validators';
export default function HeroValidator(){
  const [tab,setTab] = useState<'phone'|'email'|'ip'>('phone');
  const [input,setInput] = useState('');
  const [result,setResult] = useState<any>(null);
  const [credits,setCredits] = useState(1000);
  const run = () => { if(tab==='phone') setResult(validatePhone(input)); if(tab==='email') setResult(verifyEmail(input)); if(tab==='ip') setResult(ipLookup(input)); setCredits(c=>c-1); };
  return <div><h1>Validate Phone, Email & IP in 300ms. One API. One Credit Balance.</h1><p>Credits: {credits}</p><div><button onClick={()=>setTab('phone')}>Phone</button><button onClick={()=>setTab('email')}>Email</button><button onClick={()=>setTab('ip')}>IP</button></div><input value={input} onChange={e=>setInput(e.target.value)} placeholder={tab==='phone'?'+14155552671':tab==='email'?'test@gmail.com':'8.8.8.8'} /><button onClick={run}>Validate - 1 credit</button>{result && <pre>{JSON.stringify(result,null,2)}</pre>}</div>
}
