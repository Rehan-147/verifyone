
// TODO FOR CLAUDE CODE: Replace mock in validators.ts with real upstream calls
// Phone: Twilio Lookup v2 - https://www.twilio.com/docs/lookup/api
// Email: ZeroBounce - https://www.zerobounce.net/docs/
// IP: IPinfo - https://ipinfo.io/developers
// HLR: Use 3rd party HLR provider via Twilio or HLR Lookup API
// DNC: National DNC Registry + Litigator scrub via DNC.com API
// Keep same return shape as validators.ts so frontend does not change.
// Cost target: < $1 per 1000 core checks to keep 60% margin at $4.95/1k starter price.
export async function upstreamPhone(phone:string){ throw new Error('Plug TWILIO_ACCOUNT_SID'); }
export async function upstreamEmail(email:string){ throw new Error('Plug ZEROBOUNCE_API_KEY'); }
export async function upstreamIP(ip:string){ throw new Error('Plug IPINFO_TOKEN'); }
