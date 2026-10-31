/** Fixed snowfall shaders. Snowbank/tuner experiments live in the archive. */
export const SNOW_VERTEX=`#version 300 es
precision highp float;precision highp int;
uniform mat4 uVP;uniform vec3 uCam;uniform vec2 uViewport;
uniform float uTime,uRain,uSeed,uWind,uCount,uIdOffset;uniform vec4 uParticle,uSnowMotion;
const float uSnowP[32]=float[32](8.0,1.8,3.6,65.0,220.0,35.0,520.0,196.699,1100.0,420.0,0.65,1.37,15.0,65.0,45.0,2.5,11.0,1.2,3.8,24.0,65.0,1.0,1.0,5000.0,6800.0,7000.0,5000.0,4600.0,3400.0,0.72,0.4,3.0);
out vec2 q;out float opacity;out float distance_;out float variation;out float light_;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float h(uint id,uint salt){return float(pcg(id+pcg(salt+uint(uSeed))))*(1./4294967296.);}
void main(){
 uint id=uint(gl_InstanceID)+uint(uIdOffset);float size=h(id,3u),phase=h(id,4u)*6.2831853;
 // Calm presets keep their original motion; a blizzard adds fast advection and gusts.
 float blizzard=smoothstep(.45,.95,uWind);
 float windScale=mix(1.,uSnowP[0],blizzard);
 float speed=mix(uSnowP[3],uSnowP[4],size)*(1.+uWind*.55)*mix(1.,uSnowP[1],blizzard);
 vec3 box=mix(vec3(uSnowP[25],uSnowP[25],uSnowP[26]),vec3(uSnowP[27],uSnowP[27],uSnowP[28]),blizzard);
 vec3 base=vec3(h(id,1u),h(id,2u),h(id,5u))*box;
 vec2 windDirection=vec2(cos(radians(uSnowP[7])),sin(radians(uSnowP[7])))*vec2(1.,1.);
 vec2 windVelocity=windDirection*vec2(1.04403065)*(uSnowP[5]+uWind*uSnowP[6])*windScale;
 vec3 drift=vec3(windVelocity*uTime*(1.+uSnowMotion.x),-speed*uTime);
 // Integrate gust velocity analytically: multiplying time by a changing gust would teleport flakes.
 float gustTravel=uSnowP[8]/uSnowP[10]*sin(uTime*uSnowP[10])+uSnowP[9]/uSnowP[11]*sin(uTime*uSnowP[11]);
 drift.xy+=windDirection*1.04403065*blizzard*gustTravel*(1.+uSnowMotion.x);
 float flutter=mix(uSnowP[12],uSnowP[13],uWind)*mix(1.,uSnowP[2],blizzard);
 drift.xy+=vec2(sin(uTime*(.7+size)+phase),cos(uTime*(.5+size*.5)+phase))*flutter*(1.+uSnowMotion.y);
 drift.z+=blizzard*uSnowP[14]*sin(uTime*2.2+phase);
 vec3 relative=mod(base+drift-uCam+box*.5,box)-box*.5;
 vec3 center=relative+uCam;distance_=length(relative);variation=h(id,9u);
 int face=gl_VertexID/6,corner=gl_VertexID%6;
 q=vec2(corner==0||corner==3||corner==5?-1.:1.,corner<2||corner==3?-1.:1.);
 float spin=phase+uTime*uSnowP[22]*(.35+h(id,6u)*1.1)*(1.+blizzard*1.8),tilt=sin(uTime*(.55+blizzard*.7)+phase)*.9;
 vec3 a=vec3(cos(spin),sin(spin),0.);
 vec3 b=face==0?vec3(-sin(spin)*cos(tilt),cos(spin)*cos(tilt),sin(tilt)):
   vec3(sin(spin)*sin(tilt),-cos(spin)*sin(tilt),cos(tilt));
 if(face==2){a=vec3(-sin(spin),cos(spin),0.);b=vec3(0.,0.,1.);}
 vec3 normal=normalize(cross(a,b));light_=.68+.32*abs(dot(normal,normalize(vec3(.3,.2,1.))));
 float radius=mix(uSnowP[15],uSnowP[16],size)*(1.+uParticle.x);
 gl_Position=uVP*vec4(center+(a*q.x+b*q.y)*radius,1.);
 float rim=1.-smoothstep(.60,.98,length(relative.xy/(box.xy*.5)));
 float vertical=1.-smoothstep(.70,.99,abs(relative.z)/(box.z*.5));
 opacity=mix(.45,.85,size)*rim*vertical*smoothstep(60.,220.,distance_)
   *(1.-smoothstep(uSnowP[23],uSnowP[24],distance_))*smoothstep(0.,48.,uCount-float(gl_InstanceID));
 float bands=.65+.35*smoothstep(-.6,.8,sin(dot(center.xy,vec2(.0018,.00054))+uTime*2.5)+.3*sin(center.z*.003));
 opacity*=mix(1.,bands,blizzard);
 opacity*=1.-blizzard*smoothstep(1600.,3000.,distance_);
}`;
export const SNOW_FRAGMENT=`#version 300 es
precision highp float;
in vec2 q;in float opacity;in float distance_;in float variation;in float light_;
const float uSnowP[32]=float[32](8.0,1.8,3.6,65.0,220.0,35.0,520.0,196.699,1100.0,420.0,0.65,1.37,15.0,65.0,45.0,2.5,11.0,1.2,3.8,24.0,65.0,1.0,1.0,5000.0,6800.0,7000.0,5000.0,4600.0,3400.0,0.72,0.4,3.0);
uniform vec4 uParticle,uSnowMotion;uniform float uFade;uniform vec3 uFog;uniform vec4 uFogColor;out vec4 o;
void main(){
 float radius=length(q),aa=max(fwidth(radius),.015);
 if(radius>1.+aa)discard;
 float angle=atan(q.y,q.x),fold=abs(mod(angle+3.14159265/6.,3.14159265/3.)-3.14159265/6.);
 vec2 arm=vec2(cos(fold),sin(fold))*radius;
 float shaft=1.-smoothstep(.025+aa,.065+aa,arm.y);
 float branch=0.;
 for(int i=0;i<8;i++){if(float(i)>=max(0.,uSnowP[31]+uSnowMotion.z))break;
  float at=.30+float(i)*.22;
  float line=abs(arm.y-(arm.x-at)*.72);
  branch=max(branch,(1.-smoothstep(.018+aa,.045+aa,line))*smoothstep(at-.02,at+.03,arm.x)
    *(1.-smoothstep(at+.20,at+.30,arm.x)));
 }
 float crystal=max(shaft,branch)*(1.-smoothstep(.86,1.,radius));
 float soft=exp(-radius*radius*4.5)*(1.-smoothstep(.75,1.,radius));
 float detail=1.-smoothstep(.035,.13,aa);
 float coverage=mix(soft,mix(crystal,soft,step(.72,variation)),detail);
 float alpha=coverage*opacity*uFade*uSnowP[29]*(1.+uParticle.z);if(alpha<.004)discard;
 float fog=uFog.x*smoothstep(uFog.y,uFog.z,distance_)*uFogColor.a;
 vec3 color=mix(vec3(.84,.90,.98),vec3(1.),light_)*light_;
 o=vec4(mix(color,uFogColor.rgb,fog)*alpha,alpha);
}`;
export const SNOW_STREAK_VERTEX=`#version 300 es
precision highp float;precision highp int;
uniform mat4 uVP;uniform vec3 uCam;uniform vec2 uViewport;
uniform float uTime,uRain,uSeed,uWind,uCount,uIdOffset;uniform vec4 uParticle,uSnowMotion;
const float uSnowP[32]=float[32](8.0,1.8,3.6,65.0,220.0,35.0,520.0,196.699,1100.0,420.0,0.65,1.37,15.0,65.0,45.0,2.5,11.0,1.2,3.8,24.0,65.0,1.0,1.0,5000.0,6800.0,7000.0,5000.0,4600.0,3400.0,0.72,0.4,3.0);
out vec2 q;out float opacity;out float distance_;out float variation;out float light_;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float h(uint id,uint salt){return float(pcg(id+pcg(salt+uint(uSeed))))*(1./4294967296.);}
void main(){
 uint id=uint(gl_InstanceID)+uint(uIdOffset);float size=h(id,3u),phase=h(id,4u)*6.2831853;
 // Calm presets keep their original motion; a blizzard adds fast advection and gusts.
 float blizzard=smoothstep(.45,.95,uWind);
 float windScale=mix(1.,uSnowP[0],blizzard);
 float speed=mix(uSnowP[3],uSnowP[4],size)*(1.+uWind*.55)*mix(1.,uSnowP[1],blizzard);
 vec3 box=mix(vec3(uSnowP[25],uSnowP[25],uSnowP[26]),vec3(uSnowP[27],uSnowP[27],uSnowP[28]),blizzard);
 vec3 base=vec3(h(id,1u),h(id,2u),h(id,5u))*box;
 vec2 windDirection=vec2(cos(radians(uSnowP[7])),sin(radians(uSnowP[7])))*vec2(1.,1.);
 vec2 windVelocity=windDirection*vec2(1.04403065)*(uSnowP[5]+uWind*uSnowP[6])*windScale;
 vec3 drift=vec3(windVelocity*uTime*(1.+uSnowMotion.x),-speed*uTime);
 // Integrate gust velocity analytically: multiplying time by a changing gust would teleport flakes.
 float gustTravel=uSnowP[8]/uSnowP[10]*sin(uTime*uSnowP[10])+uSnowP[9]/uSnowP[11]*sin(uTime*uSnowP[11]);
 drift.xy+=windDirection*1.04403065*blizzard*gustTravel*(1.+uSnowMotion.x);
 float flutter=mix(uSnowP[12],uSnowP[13],uWind)*mix(1.,uSnowP[2],blizzard);
 drift.xy+=vec2(sin(uTime*(.7+size)+phase),cos(uTime*(.5+size*.5)+phase))*flutter*(1.+uSnowMotion.y);
 drift.z+=blizzard*uSnowP[14]*sin(uTime*2.2+phase);
 vec3 relative=mod(base+drift-uCam+box*.5,box)-box*.5;
 vec3 center=relative+uCam;distance_=length(relative);variation=h(id,9u);
 int corner=gl_VertexID%6;
 q=vec2(corner==0||corner==3||corner==5?-1.:1.,corner<2||corner==3?-1.:1.);
 float gustSpeed=uSnowP[8]*cos(uTime*uSnowP[10])+uSnowP[9]*cos(uTime*uSnowP[11]);
 vec3 velocity=vec3((windVelocity+windDirection*1.04403065*blizzard*gustSpeed)*(1.+uSnowMotion.x),-speed);
 vec3 axis=normalize(velocity),side=cross(axis,uCam-center);if(length(side)<.001)side=vec3(1.,0.,0.);side=normalize(side);
 vec4 clip=uVP*vec4(center,1.),delta=uVP*vec4(side,0.);
 float pixelScale=length((delta.xy*clip.w-clip.xy*delta.w)/max(clip.w*clip.w,.001)*uViewport*.5);
 float width=max(mix(uSnowP[17],uSnowP[18],size),.65/max(pixelScale,.0001));
 float trail=mix(uSnowP[19],uSnowP[20],size)+length(velocity)*mix(.009,.028,size)*uSnowP[21];
 light_=.88;
 gl_Position=uVP*vec4(center+(axis*q.y*trail*.5+side*q.x*width)*(1.+uParticle.x),1.);
 float rim=1.-smoothstep(.60,.98,length(relative.xy/(box.xy*.5)));
 float vertical=1.-smoothstep(.70,.99,abs(relative.z)/(box.z*.5));
 opacity=mix(.45,.85,size)*rim*vertical*smoothstep(60.,220.,distance_)
   *(1.-smoothstep(uSnowP[23],uSnowP[24],distance_))*smoothstep(0.,48.,uCount-float(gl_InstanceID));
 float bands=.65+.35*smoothstep(-.6,.8,sin(dot(center.xy,vec2(.0018,.00054))+uTime*2.5)+.3*sin(center.z*.003));
 opacity*=mix(1.,bands,blizzard);
 opacity*=smoothstep(180.,450.,distance_);
}`;
export const SNOW_STREAK_FRAGMENT=`#version 300 es
precision highp float;
in vec2 q;in float opacity;in float distance_;in float variation;in float light_;
const float uSnowP[32]=float[32](8.0,1.8,3.6,65.0,220.0,35.0,520.0,196.699,1100.0,420.0,0.65,1.37,15.0,65.0,45.0,2.5,11.0,1.2,3.8,24.0,65.0,1.0,1.0,5000.0,6800.0,7000.0,5000.0,4600.0,3400.0,0.72,0.4,3.0);
uniform vec4 uParticle,uSnowMotion;uniform float uFade;uniform vec3 uFog;uniform vec4 uFogColor;out vec4 o;
void main(){
 float edge=1.-smoothstep(.55,1.,abs(q.x)),cap=1.-smoothstep(.45,1.,abs(q.y));
 float alpha=edge*cap*exp(-q.x*q.x*2.)*opacity*uFade*uSnowP[30]*(1.+uParticle.z);
 if(alpha<.003)discard;
 float fog=uFog.x*smoothstep(uFog.y,uFog.z,distance_)*uFogColor.a;
 o=vec4(mix(vec3(.86,.91,.98),uFogColor.rgb,fog)*alpha,alpha);
}`;
