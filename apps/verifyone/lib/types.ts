
export type ValidationResult = { valid: boolean; status: 'valid'|'risky'|'invalid'; riskScore: number; riskLevel: 'low'|'medium'|'high'; details: Record<string, any>; creditsUsed: number; latencyMs: number; }
export type ToolDef = { slug: string; title: string; seoTitle: string; description: string; category: 'phone'|'email'|'ip'|'domain'|'other'; searchVolume: string; inputType: 'phone'|'email'|'ip'|'domain'|'url'|'vin'|'text'; faq: {q:string;a:string}[]; }
