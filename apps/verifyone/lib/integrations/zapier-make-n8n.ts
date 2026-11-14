// Zapier + Make + n8n integration specs
export const ZAPIER_APP = {
  platformVersion: '15.0.0',
  triggers: { validation_completed: { key:'validation_completed', label:'New Validation Completed', operation:{ type:'hook', perform: async (z:any, bundle:any)=>{ return [bundle.cleanedRequest] } } } },
  creates: {
    validate_phone: { key:'validate_phone', label:'Validate Phone', operation:{ perform: async (z:any, bundle:any)=>{ const res = await z.request({url:'https://app.verifyone.io/api/v1/validate_phone', method:'POST', headers:{'x-api-key':bundle.authData.api_key}, body:{phone:bundle.inputData.phone}}); return res.json }, inputFields:[{key:'phone', required:true}] } },
    verify_email: { key:'verify_email', label:'Verify Email', operation:{ perform: async (z:any, bundle:any)=>{ const r=await z.request({url:'https://app.verifyone.io/api/v1/verify_email', method:'POST', headers:{'x-api-key':bundle.authData.api_key}, body:{email:bundle.inputData.email}}); return r.json }, inputFields:[{key:'email', required:true}] } }
  }
}
export const N8N_WORKFLOW = {
  nodes: [
    { name:'VerifyOne Phone', type:'n8n-nodes-base.httpRequest', parameters:{ method:'POST', url:'https://app.verifyone.io/api/v1/validate_phone', headerParameters:{parameters:[{name:'x-api-key', value:'={{ $credentials.apiKey }}'}]} } },
    { name:'VerifyOne Email', type:'n8n-nodes-base.httpRequest', parameters:{ method:'POST', url:'https://app.verifyone.io/api/v1/verify_email' } }
  ]
}
export const MAKE_SCENARIO = { name:'VerifyOne Validate in Make', modules:[{type:'http', action:'POST', url:'https://app.verifyone.io/api/v1/validate_phone'}] }
