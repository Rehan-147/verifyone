// Google Sheets Custom Function =VERIFYONE(phone)
// Paste in Extensions > Apps Script
function VERIFYONE(value, type) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('VERIFYONE_KEY');
  if(!apiKey) throw new Error('Set VERIFYONE_KEY in Script Properties');
  var url = 'https://app.verifyone.io/api/v1/validate';
  var payload = type === 'email' ? {email:value} : {phone:value};
  var res = UrlFetchApp.fetch(url, {method:'post', headers:{'x-api-key':apiKey,'Content-Type':'application/json'}, payload: JSON.stringify(payload)});
  var j = JSON.parse(res.getContentText());
  return j.is_valid ? 'Valid - ' + (j.carrier||j.provider) : 'Invalid';
}
