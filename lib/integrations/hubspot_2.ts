// HubSpot Integration - Validate contacts as they enter HubSpot
export async function handleHubSpotWebhook(payload:any, apiKey:string){
  const validation = await fetch(`${process.env.APP_URL}/api/v1/validate`, {method:'POST', headers:{'x-api-key':apiKey, 'Content-Type':'application/json'}, body: JSON.stringify({phone: payload.phone, email: payload.email})}).then(r=>r.json())
  await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${payload.contactId}`, {
    method:'PATCH',
    headers:{ Authorization:`Bearer ${process.env.HUBSPOT_TOKEN}`, 'Content-Type':'application/json'},
    body: JSON.stringify({properties:{ verifyone_status: validation.status, verifyone_carrier: validation.phone?.carrier, verifyone_email_valid: validation.email?.is_valid, verifyone_fraud_score: validation.email?.fraud_score }})
  })
  return validation
}
