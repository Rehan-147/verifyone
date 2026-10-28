
import { COMPARE } from '../../../lib/data/compare';
export function generateStaticParams(){ return COMPARE.map(c=>({slug:c.slug})); }
export default function ComparePage({params}:{params:{slug:string}}){ const c = COMPARE.find(x=>x.slug===params.slug); return <div><h1>VerifyOne vs {c?.competitor}</h1><table><tr><th>Feature</th><th>VerifyOne</th><th>{c?.competitor}</th></tr><tr><td>Price/1k</td><td>{c?.pricePer1k}</td><td>-</td></tr></table><p>{c?.verifyOne}</p><p>{c?.competitorNote}</p></div> }
