
export const CREDIT_COSTS = { phone:1, email:1, ip:1, spam:1, hlr:5, mnp:3, dnc:10, reverse:10, skip:10, company:75, b2b:75 };
export function costFor(type:string){ return (CREDIT_COSTS as any)[type] ?? 1; }
export function deductCredits(userCredits:number, cost:number){ return Math.max(0, userCredits - cost); }
