const fs=require('node:fs'),path=require('node:path'),{parse}=require('acorn');
const {analyzeKillFeedPrivacy}=require("../ast/kill-feed-privacy-ast.cjs");
function main(args){
 if(args.length!==1)throw Error('Usage: npm run prepare:kill-feed-privacy -- <main.js>');
 const source=fs.readFileSync(args[0],'utf8').replace(/^\uFEFF/,''),plan=analyzeKillFeedPrivacy(source);
 if(!plan.status.ready)throw Error(plan.status.issues.join(', '));
 let patched=source;for(const edit of [...plan.edits].reverse())patched=patched.slice(0,edit.start)+edit.text+patched.slice(edit.end);
 parse(patched,{ecmaVersion:'latest'});
 const output=path.join(__dirname,"../../src/generated/kill-feed-privacy.json");
 const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{plans:[]};
 fs.writeFileSync(output,JSON.stringify({plans:[...previous.plans.filter(p=>p.sha256!==plan.sha256),plan]},null,2)+'\n');
 console.log(JSON.stringify({status:plan.status,edits:plan.edits.length}));
}
if(require.main===module)try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={main};
