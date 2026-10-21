const {parse}=require('acorn');
const walk=require('acorn-walk');
const {createHash}=require('node:crypto');
const {compileTemplates}=require('./overdrive-templates.cjs');
const prop=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;

function analyzeSupplyPrivacy(source) {
    const plan={format:'ki-supply-privacy-v1',sourceLength:source.length,sha256:createHash('sha256').update(source).digest('hex'),
        status:{ready:false,issues:[],renderers:0},edits:[],templates:[]};
    try {
        const ast=parse(source,{ecmaVersion:'latest'}),methods=[];
        walk.simple(ast,{AssignmentExpression(node){
            if(node.right.type==='FunctionExpression'&&node.left.type==='MemberExpression')methods.push(node);
        }});
        const renderers=methods.filter(node=>{
            const fn=node.right;
            if(fn.params.length!==1||fn.params[0].type!=='Identifier'||fn.body.body.length!==2)return false;
            const [guard,statement]=fn.body.body;
            let countGuard=false;
            walk.simple(guard,{Literal(n){if(n.value==='Count must be non-negative, was ')countGuard=true;}});
            const call=statement.expression;
            if(!countGuard||guard.type!=='IfStatement'||call?.type!=='CallExpression'||call.arguments.length!==1)return false;
            const label=call.callee.object;
            if(!prop(call.callee)||label?.type!=='MemberExpression'||label.object.type!=='ThisExpression')return false;
            let kilo=false,million=false;
            walk.simple(call.arguments[0],{Literal(n){if(n.value==='k')kilo=true;if(n.value==='m')million=true;}});
            return kilo&&million;
        });
        if(renderers.length!==4)throw Error('supply-text-renderers-missing-or-ambiguous');
        if(new Set(renderers.map(node=>prop(node.left))).size!==1)throw Error('supply-count-methods-disagree');
        const owners=new Map();
        for(const node of renderers){
            const call=node.right.body.body[1].expression,argument=call.arguments[0];
            const label=source.slice(call.callee.object.start,call.callee.object.end),method=prop(call.callee);
            const original=source.slice(argument.start,argument.end);
            plan.edits.push({start:argument.start,end:argument.end,expected:original,
                text:`(window.__kaspSupplyPrivacy?.text(${label},${JSON.stringify(method)},${original})??(${original}))`,
                before:source.slice(argument.start-24,argument.start),after:source.slice(argument.end,argument.end+24)});
            owners.set(node,{});
        }
        plan.edits.sort((a,b)=>a.start-b.start);
        plan.templates=compileTemplates(source,plan.edits,owners);
        plan.status.ready=true;plan.status.renderers=renderers.length;
    }catch(error){plan.status.issues.push(error.message);plan.edits=[];plan.templates=[];}
    return plan;
}
module.exports={analyzeSupplyPrivacy};
