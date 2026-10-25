/** Surface optics adapted from the user-supplied Weather 3D 3.20.2 userscript.
 * No tank sampling, wake, foam, terrain grid or additional weather systems.
 * The original three ripple-field evaluations are replaced by one analytic gradient.
 */
export const HIGH_PUDDLE_SURFACE = `
const float WATER_UNIT=540.;
uniform float uWind;
uniform vec4 uRippleTuning; // size reduction, speed, active-cell fraction, strength
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+17.1;a*=.5;}return v;}
float hq(ivec2 c,uint s){return float(pcg(uint(c.x)+pcg(uint(c.y)+pcg(s))))*(1./4294967296.);}
float pn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);ivec2 c=ivec2(i);
 return mix(mix(hq(c,8u),hq(c+ivec2(1,0),8u),f.x),mix(hq(c+ivec2(0,1),8u),hq(c+ivec2(1,1),8u),f.x),f.y);}
float pfbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*pn(p);p=p*2.03+17.1;a*=.5;}return v;}
vec2 puddleAt(vec2 g){
 vec2 p=g+(vec2(pfbm(g*.33+3.1),pfbm(g*.33+8.7))-.5)*1.7;
 const float C=5.2;ivec2 ci=ivec2(floor(p/C));float mask=0.,rim=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
   ivec2 cell=ci+ivec2(i,j);if(hq(cell,1u)>.80)continue;
   vec2 c=(vec2(cell)+.2+.6*vec2(hq(cell,2u),hq(cell,3u)))*C;
   float R=1.15+1.85*hq(cell,4u);vec2 q=p-c;if(dot(q,q)>3.2*R*R)continue;
   float ang=hq(cell,5u)*6.2831;q=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*q;
   q.y*=1.+.5*hq(cell,6u);
   float d=length(q)+(pfbm(p*1.85+hq(cell,7u)*40.)-.5)*.42*R+(pn(p*6.2)-.5)*.10*R;
   float m=1.-smoothstep(.78*R,1.02*R,d);
   float r=smoothstep(.68*R,.82*R,d)*(1.-smoothstep(1.01*R,1.10*R,d));
   mask=max(mask,m);rim=max(rim,r*step(.001,m));
 }
 return vec2(mask,rim);
}
// xy = analytic height gradient, z = height. Each impact centre stays fixed.
vec3 rippleField(vec2 p){
 p*=uRippleTuning.x;
 float footprint=max(length(dFdx(p)),length(dFdy(p)));
 float visible=1.-smoothstep(.18,.8,footprint);
 if(visible<.001||uRippleTuning.z<=0.||uRippleTuning.w<=0.)return vec3(0.);
 const float C=1.12;vec2 ci=floor(p/C);vec2 grad=vec2(0.);float acc=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
   vec2 cell=ci+vec2(float(i),float(j)),h=hash22(cell*1.37+3.1);
   if(hash21(cell+vec2(71.7,28.9))>uRippleTuning.z*uRain)continue;
   float per=1.15+1.35*h.x,ph=fract(uTime*uRippleTuning.y/per+h.y*4.7);
   vec2 delta=p-(cell+.15+.7*hash22(cell+3.1))*C;float d=length(delta);
   float fade=1.-smoothstep(.72,1.,ph),w1=max(.045+.015*ph,footprint*.55),q1=(d-ph*.46)/w1;
   float r1=exp(-q1*q1)*fade;
   float ph2=max(0.,ph-.24),w2=max(.05+.018*ph2,footprint*.55),q2=(d-ph2*.35)/w2;
   float r2=exp(-q2*q2)*pow(1.-ph2,1.8)*.30;
   float dotv=exp(-pow(d/.055,2.))*(1.-smoothstep(0.,.12,ph))*.16;
   acc+=r1+r2+dotv;
   grad+=delta/max(d,.0001)*(-2.*q1/w1*r1-2.*q2/w2*r2-2.*d/(.055*.055)*dotv);
 }
 grad*=min(1.,8./max(length(grad),.001));
 return vec3(grad,clamp(acc,0.,1.))*visible*uRippleTuning.w;
}
vec2 microWindGrad(vec2 p,vec2 wind,float t){
 vec2 wd=length(wind)>.01?normalize(wind):vec2(.8,.6);float spd=max(.2,length(wind));
 vec2 p1=p*4.5+wd*(t*2.8*spd),p2=p*8.2-vec2(-wd.y,wd.x)*(t*1.9*spd)+vec2(13.7,7.3);
 float n1=noise(p1),n2=noise(p2);
 vec2 g1=vec2(noise(p1+vec2(.08,0.))-n1,noise(p1+vec2(0.,.08))-n1);
 vec2 g2=vec2(noise(p2+vec2(.05,0.))-n2,noise(p2+vec2(0.,.05))-n2);
 return(g1*3.5+g2*4.5)*(.15+.35*spd);
}
vec2 microWaveGrad(vec2 p,vec2 wind,float t){
 vec2 wd=length(wind)>.01?normalize(wind):normalize(vec2(.8,.6));float spd=clamp(length(wind),.2,1.5);
 vec2 d1=normalize(wd+vec2(.28,.17)),d2=normalize(vec2(-wd.y,wd.x)+wd*.22),d3=normalize(-wd*.48+vec2(.61,.73));
 float a=dot(p,d1)*3.2-t*(1.+spd*1.8),b=dot(p,d2)*6.7+t*(1.35+spd*1.25),c=dot(p,d3)*12.4-t*(2.+spd*1.6);
 return d1*cos(a)*.105+d2*cos(b)*.046+d3*cos(c)*.018;
}
`;
