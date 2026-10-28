
import { TOOLS } from '../../../lib/data/tools';
export function generateStaticParams(){ return TOOLS.map(t=>({slug:t.slug})); }
export default function ToolPage({params}:{params:{slug:string}}){
  const tool = TOOLS.find(t=>t.slug===params.slug);
  if(!tool) return <div>Tool not found</div>;
  return <div><h1>{tool.seoTitle}</h1><p>{tool.description}</p><div>Working tool UI here - input type: {tool.inputType} - use components/ToolChecker.tsx</div><h2>How it works</h2><h2>FAQ</h2>{tool.faq.map(f=><div key={f.q}><b>{f.q}</b><p>{f.a}</p></div>)}<a href='/dashboard'>Try Bulk Version</a></div>
}
