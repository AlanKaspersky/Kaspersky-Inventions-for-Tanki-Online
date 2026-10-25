import { COMMON } from './shaders';
import { HIGH_PUDDLE_SURFACE } from './puddleSurface';
import type { PuddleDetail } from './preferences';
import { MAP_SURFACE } from './mapSurface';

/** Bounded, opt-in screen-space reflections. Native units are centimetres. */
export const PUDDLES = Object.freeze({ steps: 24, refinements: 6, distance: 6000, far: 25000, fadeSeconds: 1.2 });
export const PUDDLE_SURFACE_REVISION='native-fog-off-v13';

export function buildPuddleFragment(detail: PuddleDetail = 'low') {
 const high=detail==='high';
 return `#version 300 es
${COMMON}
in vec2 uv;
uniform highp sampler2D uDepth;
uniform highp sampler2D uMapDepth,uMapSupportDepth;
uniform sampler2D uScene,uCloudTexture;
uniform mat4 uVP;
uniform float uPuddles;
uniform vec3 uWaveTuning;
uniform vec4 uOptics;
uniform float uEdgeInset;
uniform vec3 uSunDirection,uCloudTone;
${high ? HIGH_PUDDLE_SURFACE : ''}

vec3 environment(vec3 direction){
 vec2 skyUV=vec2(atan(direction.y,direction.x)/6.283185307+.5,asin(clamp(direction.z,0.,1.))/1.570796327);
 vec4 cloud=texture(uCloudTexture,skyUV);
 vec3 sky=mix(vec3(.44,.55,.65),vec3(.18,.22,.27),uCloud);
 return cloud.rgb+sky*uCloudTone*(1.-uSkyDarkness)*(1.-cloud.a);
}
bool project(vec3 p,out vec2 screen){
 vec4 clip=uVP*vec4(p,1.);screen=clip.xy/max(clip.w,.001)*.5+.5;
 return clip.w>0.&&all(greaterThan(screen,vec2(.002)))&&all(lessThan(screen,vec2(.998)));
}
float openEdgeFade(vec3 p){
 if(uEdgeInset<.01)return 1.;
 float inside=1.,outside=1.;
 // World-fixed multiscale erosion. Never reduce the configured minimum inset;
 // remove extra water inward in broad bays, fine notches and detached islands.
 float shoreSeed=uSeed*.001;
 float erosion=noise3(vec3(p.xy/(uEdgeInset*3.4+80.),shoreSeed+47.))*.55
              +noise3(vec3(p.xy/(uEdgeInset*.9+35.),shoreSeed+109.))*.30
              +noise3(vec3(p.xy/(uEdgeInset*.23+15.),shoreSeed+211.))*.15;
 float shoreInset=uEdgeInset*(1.083+2.2*pow(erosion,1.5));
 float pixelRadius=max(length(dFdx(p.xy)),length(dFdy(p.xy)));
 float baseDepth=texture(uMapDepth,uv).r;
 vec4 plane=transpose(uInvVP)*vec4(0.,0.,1.,-p.z);
 // Query the union of map collision faces, never individual triangles/props.
 // Same-height neighbours therefore retain water across their shared seam.
 for(int i=0;i<8;i++){
  float angle=float(i)*.7853981634;vec2 direction=vec2(cos(angle),sin(angle));
  for(int j=0;j<2;j++){
   vec2 screen;vec3 probe=p+vec3(direction*(shoreInset*(j==0?1.:1.25)+pixelRadius),0.);
   // Beyond the viewport is unknown, not an open world edge.
   if(!project(probe,screen))continue;
   // Depth belongs to a texel centre. Reconstructing at the fractional probe
   // UV turns half a far-away pixel into a false height discontinuity.
   vec2 size=vec2(textureSize(uMapDepth,0));screen=(floor(screen*size)+.5)/size;
   float d=texture(uMapSupportDepth,screen).r;
   // Compare plane-relative depth, not two ill-conditioned absolute world Zs.
   float expected=baseDepth-dot(plane.xy,screen-uv)/plane.z;
   vec4 h=uInvVP*vec4(screen*2.-1.,d*2.-1.,1.);
   float tolerance=max(2./16777215.,${MAP_SURFACE.tolerance}.*abs(h.w/plane.z)*.5);
   // Positive means a higher map surface: a retaining wall is a closed bank,
   // not a drain. Only missing/lower support creates the configurable dry inset.
   float relativeHeight=(d-expected)*sign(plane.z*h.w);
   float supported=float(d<.999999)*(1.-smoothstep(tolerance,tolerance*1.5,-relativeHeight));
   if(j==0)inside=min(inside,supported);else outside=min(outside,supported);
  }
 }
 return inside*mix(.45,1.,outside);
}
float sunlightVisibility(vec3 p){
 if(uSunDirection.z<=.01)return 0.;
 vec3 direction=normalize(uSunDirection);
 for(int i=1;i<=8;i++){
  vec3 q=p+vec3(0.,0.,10.)+direction*(20.+float(i*i)*35.);vec2 screen;
  if(!project(q,screen))break;
  float d=texture(uDepth,screen).r;if(d>=.999999)continue;
  vec3 surface=worldAt(screen,d);
  if(surface.z>p.z+14.&&distance(q,uCam)>distance(surface,uCam)+8.)return 0.;
 }return 1.;
}
vec3 reflectionNormal(vec2 screen,vec3 p){
 vec2 pixel=1./vec2(textureSize(uDepth,0));
 vec3 l=worldAt(screen-vec2(pixel.x,0.),texture(uDepth,screen-vec2(pixel.x,0.)).r);
 vec3 r=worldAt(screen+vec2(pixel.x,0.),texture(uDepth,screen+vec2(pixel.x,0.)).r);
 vec3 b=worldAt(screen-vec2(0.,pixel.y),texture(uDepth,screen-vec2(0.,pixel.y)).r);
 vec3 t=worldAt(screen+vec2(0.,pixel.y),texture(uDepth,screen+vec2(0.,pixel.y)).r);
 vec3 dx=length(r-p)<length(p-l)?r-p:p-l,dy=length(t-p)<length(p-b)?t-p:p-b;
 vec3 n=cross(dx,dy);n/=max(length(n),.00001);
 return dot(n,uCam-p)<0.?-n:n;
}
vec3 waterNormal(vec3 surface,vec2 gradient){
 // Perturb within the actual surface plane, rather than resetting a ramp's
 // normal to world-up. Flat ground retains the original normal calculation.
 vec3 perturb=vec3(gradient,0.);
 return normalize(surface+perturb-surface*dot(perturb,surface));
}
vec2 scenePixel(vec2 screen){vec2 size=vec2(textureSize(uDepth,0));return(floor(screen*size)+.5)/size;}
float sameSurface(vec2 q,vec3 p,vec3 normal){
 if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))return 0.;
 float d=texture(uDepth,q).r;
 return float(d<.999999)*(1.-smoothstep(6.,24.,abs(dot(worldAt(q,d)-p,normal))));
}
vec3 reflectionColour(vec2 q,vec3 p,vec3 normal){
 vec3 result=texture(uScene,q).rgb*2.;float weight=2.;
 if(uOptics.z>.001){
  vec2 radius=vec2(uOptics.z*12.)/vec2(textureSize(uScene,0));
  for(int i=0;i<4;i++){
   vec2 delta=i==0?vec2(radius.x,0.):i==1?vec2(-radius.x,0.):i==2?vec2(0.,radius.y):vec2(0.,-radius.y);
   vec2 sample_=scenePixel(q+delta);float valid=sameSurface(sample_,p,normal);
   result+=texture(uScene,sample_).rgb*valid;weight+=valid;
  }
 }return result/weight;
}
vec3 refractedFloor(vec2 screen,vec3 p,vec3 fallback){
 // Validate every bilinear colour tap against depth. A linear colour sample
 // combined with one nearest depth sample can pull a gun silhouette onto water.
 vec2 size=vec2(textureSize(uScene,0)),pixel=screen*size-.5,base=floor(pixel),f=fract(pixel);
 vec3 colour=vec3(0.);float total=0.;
 for(int i=0;i<4;i++){
  vec2 offset=vec2(float(i&1),float(i>>1)),q=(base+offset+.5)/size;
  vec2 weights=mix(1.-f,f,offset);float weight=weights.x*weights.y*sameSurface(q,p,vec3(0.,0.,1.));
  colour+=texture(uScene,q).rgb*weight;total+=weight;
 }return mix(fallback,colour/max(total,.0001),clamp(total,0.,1.));
}
void main(){
 float depth=texture(uDepth,uv).r;
 if(depth>=.999999)discard;
 vec3 p=worldAt(uv,depth);
 float mapDepth=texture(uMapDepth,uv).r;
 if(mapDepth>=.999999||abs(worldAt(uv,mapDepth).z-p.z)>${MAP_SURFACE.tolerance}.)discard;
 vec2 pixel=1./vec2(textureSize(uDepth,0));
 vec3 l=worldAt(uv-vec2(pixel.x,0.),texture(uDepth,uv-vec2(pixel.x,0.)).r);
 vec3 r=worldAt(uv+vec2(pixel.x,0.),texture(uDepth,uv+vec2(pixel.x,0.)).r);
 vec3 b=worldAt(uv-vec2(0.,pixel.y),texture(uDepth,uv-vec2(0.,pixel.y)).r);
 vec3 t=worldAt(uv+vec2(0.,pixel.y),texture(uDepth,uv+vec2(0.,pixel.y)).r);
 // No coarse collision tiles: the current geometry depth clips every fragment.
 // Fade at discontinuities instead of stretching a normal across a wall edge.
 vec3 dx=length(r-p)<length(p-l)?r-p:p-l,dy=length(t-p)<length(p-b)?t-p:p-b;
 vec3 normal=normalize(cross(dx,dy));if(normal.z<0.)normal=-normal;
 vec3 surfaceNormal=vec3(0.,0.,1.);
 // A change in world Z is normal on a ramp. Only distance away from the local
 // tangent plane indicates a depth discontinuity at a wall or an object edge.
 float planeGap=max(max(abs(dot(l-p,normal)),abs(dot(r-p,normal))),max(abs(dot(t-p,normal)),abs(dot(b-p,normal))));
 float contact=1.-smoothstep(6.,24.,planeGap);
 float flatness=smoothstep(.985,.998,normal.z),distance_=distance(p,uCam);
 contact*=mix(1.-smoothstep(.5,3.,planeGap),1.,flatness);
 // Eligibility already comes from horizontal collision faces. Ignore small
 // visual-mesh bumps while still rejecting vertical silhouettes at their feet.
 float upward=smoothstep(.55,.85,normal.z);
 if(upward<.001||contact<.001||distance_>${PUDDLES.far}.)discard;
 float distanceFade=1.-smoothstep(${PUDDLES.far * .65}.,${PUDDLES.far}.,distance_);
 ${high ? `
 // The reference's organic, world-fixed shoreline. Rain fades its opacity rather
 // than moving the bank or depending on the underlying game's texture.
 vec2 gp=p.xy/WATER_UNIT+vec2(uSeed*.00073,uSeed*.00019);
 vec2 field=puddleAt(gp);
 float coverage=field.x*upward*contact;
 ` : `
 // Stable world-space islands, independent of the camera and the original albedo.
 float broad=noise3(vec3(p.xy/1050.,uSeed*.001));
 float detail=noise3(vec3(p.xy/270.,uSeed*.001+13.));
 float shape=broad*.8+detail*.2;
 float coverage=smoothstep(.56,.64,shape)*upward*contact;
 `}
 coverage*=distanceFade;
 if(coverage<.002)discard;
 coverage*=openEdgeFade(p);
 float alpha=coverage*uPuddles*uRain*uFade*mix(.90,1.,flatness);
 if(alpha<.002)discard;
 ${high ? `
 vec2 wind=vec2(-uWind*.85,-uWind*.255);
 float surfaceDetail=1.-smoothstep(7000.,18000.,distance_);
 vec3 waterRipple=vec3(0.);vec2 totalGrad=vec2(0.);
 if(surfaceDetail>.001){
   waterRipple=rippleField(gp)*surfaceDetail;
   float wavePixel=max(length(dFdx(gp)),length(dFdy(gp)))*uWaveTuning.x;
   float waveVisible=1.-smoothstep(.04,.25,wavePixel);
   if(waveVisible>.001&&uWaveTuning.z>0.)totalGrad=(microWindGrad(gp*uWaveTuning.x,wind,uTime*uWaveTuning.y)*.030+microWaveGrad(gp*uWaveTuning.x,wind,uTime*uWaveTuning.y)*.55)*surfaceDetail*uWaveTuning.z*waveVisible;
   totalGrad+=waterRipple.xy*.025*uRain;
 }
 normal=waterNormal(surfaceNormal,-totalGrad*smoothstep(.01,.15,field.x)*mix(.18,1.,flatness));
 ` : `
 // Tiny wind ripples perturb the reflection, never the puddle's outline.
 vec2 phase=vec2(p.x*.034+p.y*.021,p.y*.029-p.x*.017)*uWaveTuning.x;
 vec2 waveVisible=1.-smoothstep(vec2(1.),vec2(3.14159),abs(dFdx(phase))+abs(dFdy(phase)));
 vec2 ripple=vec2(sin(phase.x-uTime*3.*uWaveTuning.y),cos(phase.y-uTime*2.4*uWaveTuning.y))*.009*uRain*uWaveTuning.z*waveVisible;
 normal=waterNormal(surfaceNormal,ripple*mix(.18,1.,flatness));
 `}
 vec3 incident=normalize(p-uCam),ray=reflect(incident,normal),origin=p+normal*5.;
 vec3 ground=texture(uScene,uv).rgb;
 vec3 sky=environment(ray);
 // A missing screen-space hit is not evidence of an unobstructed light source.
 // Native sun visibility and the locally shaded ground bound only the fallback;
 // actual reflected objects keep their own colour and dynamic illumination.
 float localLight=dot(ground,vec3(.2126,.7152,.0722));
 float skyLight=max(.001,dot(sky,vec3(.2126,.7152,.0722)));
 float skyLimit=(localLight*1.4+.004)*mix(.45,1.,sunlightVisibility(p));
 vec3 reflected=sky*min(1.,skyLimit/skyLight);
 float previous=0.;
 if(uOptics.x>0.)for(int i=0;i<${PUDDLES.steps};i++){
   float travel=8.*(pow(1.+uOptics.y/8.,float(i+1)/float(${PUDDLES.steps}))-1.);
   vec3 sample_=origin+ray*travel;vec2 screen;
   if(!project(sample_,screen))break;
   float sceneDepth=texture(uDepth,screen).r;
   if(sceneDepth<.999999){
     vec3 surface=worldAt(screen,sceneDepth);
     float delta=distance(sample_,uCam)-distance(surface,uCam);
     if(delta>0.){
       float lo=previous,hi=travel;
       for(int j=0;j<${PUDDLES.refinements};j++){
         float mid=(lo+hi)*.5;vec3 point_=origin+ray*mid;vec2 q;
         if(!project(point_,q)){hi=mid;continue;}
         float d=texture(uDepth,q).r;
         if(d<.999999&&distance(point_,uCam)>distance(worldAt(q,d),uCam))hi=mid;else lo=mid;
       }
       vec3 hit=origin+ray*((lo+hi)*.5);vec2 q;
       if(project(hit,q)){
         q=scenePixel(q);float d=texture(uDepth,q).r;vec3 surface_=worldAt(q,d);
         // Reject self intersections and false hits behind depth discontinuities.
         float confidence=(1.-smoothstep(20.,100.,distance(hit,surface_)))*smoothstep(2.,12.,surface_.z-p.z);
         // The depth buffer contains only the face visible to the camera. A ray
         // from water underneath a floating box cannot reflect its visible top.
         // Reject that false back-face hit instead of drawing a sliced decal.
         vec3 hitNormal=reflectionNormal(q,surface_);
         if(confidence>.001){
           confidence*=smoothstep(.02,.18,dot(hitNormal,-ray));
         }
         confidence*=1.-smoothstep(uOptics.y*.75,uOptics.y,travel);
         confidence*=smoothstep(0.,.08,min(min(q.x,q.y),min(1.-q.x,1.-q.y)));
         vec3 colour=reflectionColour(q,surface_,hitNormal);
         reflected=mix(reflected,colour,confidence);
       }
       break;
     }
   }
   previous=travel;
 }
 // Shallow rainwater is a dielectric. Keep the ground visible head-on and
 // reserve strong reflection for grazing views, on both quality levels.
 float cosTheta=clamp(dot(-incident,normal),0.,1.);
 float fresnel=min(.72,(.02+.98*pow(1.-cosTheta,5.))*uOptics.x);
 ${high ? `
 float bedNoise=fbm(gp*2.7+vec2(4.1,9.7)),depthK=field.x*(.50+.50*bedNoise)*(1.-.75*field.y)*mix(.60,1.,flatness);
 // Invalid refraction uses the current ground pixel, never a fixed black bed.
 vec3 waterFloor=ground*.86;
 vec2 bedUV;
 vec3 refraction=vec3(normal.xy,0.);refraction-=surfaceNormal*dot(refraction,surfaceNormal);
 if(project(p-refraction*WATER_UNIT*(.05+.11*depthK)*uOptics.w,bedUV)){
   float valid=smoothstep(0.,.04,min(min(bedUV.x,bedUV.y),min(1.-bedUV.x,1.-bedUV.y)));
   vec3 absorption=mix(vec3(.96),vec3(.70,.76,.74),clamp(depthK,0.,1.));
   waterFloor=mix(waterFloor,refractedFloor(bedUV,p,ground)*absorption,valid);
 }
 vec3 water=mix(waterFloor,reflected,fresnel);
 water+=vec3(.68,.78,.88)*clamp(waterRipple.z*.17,0.,.30)*.19;
 water*=1.-.06*field.y;water+=vec3(.30,.42,.45)*field.y*.025;
 alpha*=.90+.10*fresnel*.9;
 ` : `
 vec3 water=mix(ground*.82,reflected,fresnel);
 `}
 // A dark SSR hit/cloud cannot erase the bottom of a shallow puddle. This
 // relative bound preserves dark maps and their texture instead of adding a
 // constant grey glow. It does not change silhouettes, normals or reflections.
 const vec3 luminance=vec3(.2126,.7152,.0722);
 float groundLight=dot(ground,luminance),waterLight=dot(water,luminance);
 water+=ground*max(0.,.72-waterLight/max(groundLight,.0001));
 o=vec4(water*alpha,alpha);
}`;
}
export const PUDDLE_FRAGMENT = buildPuddleFragment('low');
export const HIGH_PUDDLE_FRAGMENT = buildPuddleFragment('high');
