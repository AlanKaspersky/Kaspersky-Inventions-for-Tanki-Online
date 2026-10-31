const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {buildSync}=require('esbuild');
const code=buildSync({stdin:{contents:"export {temperatureTint} from './src/core/sunRays/appearance';export {sunProjection} from './src/core/sunRays/math';export {readSunIntensity,mapAllowsSun,SUN_RAYS} from './src/core/sunRays/config';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const moduleData={exports:{}};vm.runInNewContext(code,{module:moduleData,exports:moduleData.exports,Float32Array});
const {sunProjection,readSunIntensity,mapAllowsSun,SUN_RAYS}=moduleData.exports;

test('artistic sunlight temperature is neutral by default, continuous and bounded at both ends',()=>{
 const tint=moduleData.exports.temperatureTint;assert.deepEqual([...tint(6500)],[1,1,1]);assert.deepEqual([...tint(NaN)],[1,1,1]);
 assert.ok(tint(4500)[0]>tint(4500)[2]);assert.ok(tint(9000)[2]>tint(9000)[0]);
 for(const k of [-100,2500,4500,6499,6500,6501,10000,99999])assert.ok(tint(k).every(v=>v>0&&v<=1));
 assert.ok(Math.abs(tint(6499)[2]-tint(6501)[2])<.001);
});
test('whole-map solar projection contains collisions and remains independent of the camera',()=>{
 const vertices=new Float32Array([-2000,-3000,0, 3000,-3000,0, 3000,4000,3000, -2000,-3000,0, 3000,4000,3000, -2000,4000,0]);
 for(const direction of [[0,0,1],[.4,.7,.6],[-1,.1,.2]]){
  const result=sunProjection(vertices,direction);assert.ok(result);assert.equal(result.floor,0);assert.equal(result.top,3000);
  for(let i=0;i<vertices.length;i+=3)for(let r=0;r<3;r++){
   const m=result.vp,v=m[r]*vertices[i]+m[4+r]*vertices[i+1]+m[8+r]*vertices[i+2]+m[12+r];assert.ok(Math.abs(v)<1);
  }
  assert.deepEqual(result.vp,sunProjection(vertices,direction).vp);
 }
 assert.equal(sunProjection(vertices,[0,0,0]),undefined);
 const bad=vertices.slice();bad[1]=NaN;assert.equal(sunProjection(bad,[0,0,1]),undefined);
});
test('sun intensity preserves zero, allows overrides without an upper limit and recovers from unavailable storage',()=>{
 for(const [raw,expected]of [[null,4],['',4],['0',0],['2',2],['99',99],['-1',0],['NaN',4],['Infinity',4]])assert.equal(readSunIntensity({getItem:()=>raw}),expected);
 assert.equal(readSunIntensity({getItem(){throw Error('blocked');}}),4);
 assert.ok(SUN_RAYS.steps<=48&&SUN_RAYS.maxWidth<=640&&SUN_RAYS.maxShadowTriangles<=120000);
});
test('night/space titles also suppress sun without optional theme metadata; winter days and Massacre permit it',()=>{
 for(const theme of ['SPACE','SUMMER_NIGHT','WINTER_NIGHT'])assert.equal(mapAllowsSun(theme,'Rio'),false);
 for(const name of ['Космос TDM','Moon Night CTF','Зимняя ночь DM'])assert.equal(mapAllowsSun(undefined,name),false);
 for(const name of ['Бойня','Massacre TDM','Year 2042 RGB','Winter CTF'])assert.equal(mapAllowsSun(undefined,name),true);
 assert.equal(mapAllowsSun('WINTER_DAY','Night CTF'),true,'explicit native theme takes priority');
});
