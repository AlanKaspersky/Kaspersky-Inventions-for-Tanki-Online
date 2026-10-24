const fs=require('node:fs'),path=require('node:path'),{parse}=require('acorn');
const {analyzeRain}=require("../ast/rain-weather-ast.cjs");
function main(args){
 if(args.length!==1)throw Error('Usage: npm run prepare:rain-weather -- <main.js>');
 const source=fs.readFileSync(args[0],'utf8').replace(/^\uFEFF/,''),plan=analyzeRain(source);
 if(!plan.status.ready)throw Error(plan.status.issues.join(', '));
 let patched=source;for(const e of [...plan.edits].reverse())patched=patched.slice(0,e.start)+e.text+patched.slice(e.end);
 parse(patched,{ecmaVersion:'latest'});
 const output=path.resolve(__dirname,"../../src/generated/rain-weather.json");
 const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{plans:[]};
 fs.writeFileSync(output,JSON.stringify({plans:[...previous.plans.filter(p=>p.sha256!==plan.sha256),plan]},null,2)+'\n');
 console.log(JSON.stringify({ready:true,edits:plan.edits.length,templates:plan.templates.length,schema:plan.schema}));
}
if(require.main===module)try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={main};
