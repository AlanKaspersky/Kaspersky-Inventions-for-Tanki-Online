const fs=require('node:fs'),path=require('node:path');

/** Fail before replacing a release if any declared runtime entry is absent. */
function validateRuntime(root){
 const requireFile=relative=>{
  const absolute=path.resolve(root,relative),base=path.resolve(root)+path.sep;
  if(!absolute.startsWith(base)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()||!fs.statSync(absolute).size){
   throw Error('Missing or invalid packaged runtime file: '+relative);
  }
 };
 requireFile('manifest.json');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 for(const script of manifest.content_scripts||[])for(const file of [...(script.js||[]),...(script.css||[])])requireFile(file);
 const gate='dist/kasp_game_gate.js';requireFile(gate);
 if(!manifest.web_accessible_resources?.some(entry=>entry.resources?.includes(gate)))throw Error('Game gate must be web-accessible');
 const resources=manifest.declarative_net_request?.rule_resources;
 if(!resources?.length)throw Error('Missing game bundle network rules');
 let redirectsToGate=false;
 for(const entry of resources){
  requireFile(entry.path);
  const rules=JSON.parse(fs.readFileSync(path.join(root,entry.path),'utf8'));
  for(const rule of rules){
   const target=rule.action?.redirect?.extensionPath;
   if(target){requireFile(target.replace(/^\//,''));if(entry.enabled&&target==='/'+gate)redirectsToGate=true;}
  }
 }
 if(!redirectsToGate)throw Error('Missing enabled game gate redirect');
}
module.exports={validateRuntime};
