(function(){
/* MB Consulting — Universe 3D · shader GLSL */

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/* ---------- stelle ---------- */
const starsVert = /* glsl */`
uniform float uTime; uniform float uScale;
attribute float aSize; attribute float aPhase;
varying float vAlpha; varying float vTint;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=aSize*uScale/max(1.0,-mv.z);
  vAlpha=0.35+0.65*pow(0.5+0.5*sin(uTime*(0.6+aPhase*1.4)+aPhase*40.0),2.0);
  vTint=aPhase;
}`;
const starsFrag = /* glsl */`
varying float vAlpha; varying float vTint;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=smoothstep(0.5,0.0,d);
  vec3 c=mix(vec3(0.75,0.88,1.0),vec3(1.0,0.93,0.85),step(0.85,vTint));
  gl_FragColor=vec4(c,a*a*vAlpha);
}`;

/* ---------- scie di velocità (warp) ---------- */
const warpVert = /* glsl */`
uniform float uTime; uniform float uLen; uniform float uSpeed;
attribute float aEnd; attribute float aZ;
varying float vA; varying float vEnd;
void main(){
  float z=-mod(aZ+uTime*uSpeed,140.0)-4.0;
  z+=aEnd*uLen;
  vec3 p=vec3(position.xy,z);
  vA=smoothstep(-140.0,-90.0,z)*smoothstep(0.0,-6.0,z);
  vEnd=aEnd;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const warpFrag = /* glsl */`
uniform float uWarp; varying float vA; varying float vEnd;
void main(){
  gl_FragColor=vec4(vec3(0.7,0.88,1.0),vA*uWarp*mix(0.0,0.9,vEnd));
}`;

/* ---------- pianeta di ghiaccio (cristallo sfaccettato) ---------- */
const crystalVert = /* glsl */`
${NOISE}
uniform float uTime; uniform float uAmp; uniform vec3 uMouse; uniform float uMouseStr; uniform float uMorph;
varying vec3 vWorld; varying float vPull;
void main(){
  float n=snoise(position*0.85+vec3(0.0,uTime*0.07,uTime*0.05));
  float n2=snoise(position*1.8+vec3(uTime*0.45,uTime*0.2,uTime*0.35));
  vec4 w0=modelMatrix*vec4(position,1.0);
  float md=length(w0.xyz-uMouse);
  float pull=smoothstep(2.4,0.0,md)*uMouseStr;
  float liquid=uMorph*0.28*n2+pull*0.38+pull*0.18*sin(md*7.0-uTime*6.0);
  vec3 p=position*(1.0+uAmp*n+liquid);
  vec4 w=modelMatrix*vec4(p,1.0);
  vWorld=w.xyz; vPull=pull;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const crystalFrag = /* glsl */`
uniform float uTime; uniform float uGlow; uniform float uMorph;
varying vec3 vWorld; varying float vPull;
void main(){
  vec3 N=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  vec3 V=normalize(cameraPosition-vWorld);
  if(dot(N,V)<0.0) N=-N;
  float ndv=max(dot(N,V),0.0);
  float fres=pow(1.0-ndv,2.2);
  vec3 L1=normalize(vec3(-0.6,0.85,0.55));
  vec3 L2=normalize(vec3(0.9,-0.35,0.3));
  float diff=max(dot(N,L1),0.0)*0.7+max(dot(N,L2),0.0)*0.3;
  float spec=pow(max(dot(N,normalize(L1+V)),0.0),70.0)*1.8+pow(max(dot(N,normalize(L2+V)),0.0),40.0)*0.5;
  vec3 deep=vec3(0.015,0.05,0.09);
  vec3 ice=vec3(0.56,0.83,1.0);
  vec3 irid=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+ndv*1.25+uTime*0.025+uMorph*0.6+vPull*0.8));
  float facet=fract(sin(dot(floor(N*7.0),vec3(12.9898,78.233,37.719)))*43758.5453);
  vec3 col=mix(deep,ice*0.42,diff);
  col+=fres*mix(ice,irid,0.4)*1.15;
  col+=spec*vec3(1.0,0.98,0.95);
  col+=facet*0.035*ice;
  col+=vPull*mix(ice,irid,0.6)*0.55+uMorph*fres*irid*0.5;
  col*=uGlow;
  gl_FragColor=vec4(col,1.0);
}`;

/* ---------- alone atmosferico ---------- */
const haloVert = /* glsl */`
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 w=modelMatrix*vec4(position,1.0);
  vN=normalize(mat3(modelMatrix)*normal);
  vV=normalize(cameraPosition-w.xyz);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const haloFrag = /* glsl */`
uniform vec3 uColor; uniform float uPower; uniform float uOpacity;
varying vec3 vN; varying vec3 vV;
void main(){
  float rim=pow(1.0-abs(dot(vN,vV)),uPower);
  gl_FragColor=vec4(uColor,rim*uOpacity);
}`;

/* ---------- guscio di particelle reattivo al mouse ---------- */
const shellVert = /* glsl */`
${NOISE}
uniform float uTime; uniform float uScale; uniform vec3 uMouse; uniform float uMouseStr; uniform vec3 uCenter; uniform float uSpeed;
attribute float aRand;
varying float vAlpha; varying float vGlow;
void main(){
  vec3 p=position;
  float w=1.0+0.05*sin(p.y*4.5+uTime*0.9)+0.06*snoise(p*1.1+uTime*0.12);
  p*=w;
  vec4 world=modelMatrix*vec4(p,1.0);
  vec3 d=world.xyz-uMouse;
  float dist=length(d);
  float f=smoothstep(2.7,0.0,dist)*uMouseStr;
  vec3 radial=normalize(world.xyz-uCenter);
  vec3 swirl=normalize(cross(d+1e-4,vec3(0.0,1.0,0.0)));
  float ripple=sin(dist*5.5-uTime*7.0)*exp(-dist*0.75)*uMouseStr*(0.35+uSpeed*0.9);
  float flow=snoise(world.xyz*0.9+vec3(uTime*0.6))*uSpeed;
  world.xyz+=normalize(d+1e-4)*f*(0.85+uSpeed*0.9)+swirl*f*(0.45+uSpeed*0.6)+radial*(ripple*0.32+flow*0.35);
  vec4 mv=viewMatrix*world;
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(0.018+aRand*0.03+f*0.06+abs(ripple)*0.03)*uScale/max(1.0,-mv.z);
  vec3 n=normalize(world.xyz-uCenter);
  float facing=dot(n,normalize(cameraPosition-world.xyz));
  vAlpha=0.12+0.88*smoothstep(-0.35,0.7,facing);
  vGlow=min(1.0,f+abs(ripple)*0.8);
}`;
const shellFrag = /* glsl */`
uniform float uOpacity;
varying float vAlpha; varying float vGlow;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=smoothstep(0.5,0.05,d);
  vec3 c=mix(vec3(0.55,0.8,1.0),vec3(1.0),vGlow*0.8);
  gl_FragColor=vec4(c,a*min(1.0,vAlpha+vGlow)*uOpacity);
}`;

/* ---------- anelli di polvere ---------- */
const dustVert = /* glsl */`
uniform float uScale; uniform float uTime;
attribute float aRand;
varying float vA;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(0.012+aRand*0.03)*uScale/max(1.0,-mv.z);
  vA=0.25+0.75*pow(0.5+0.5*sin(uTime*1.5+aRand*60.0),3.0);
}`;
const dustFrag = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){
  float d=length(gl_PointCoord-0.5);
  gl_FragColor=vec4(uColor,smoothstep(0.5,0.0,d)*vA*uOpacity);
}`;

/* ---------- card progetto ---------- */
const cardVert = /* glsl */`
uniform float uHover; uniform float uTime; uniform float uCurve;
varying vec2 vUv;
void main(){
  vUv=uv;
  vec3 p=position;
  p.z-=p.x*p.x*uCurve;
  p.z+=sin(uv.x*9.0+uTime*3.5)*0.035*uHover;
  p.z+=uHover*0.12;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const cardFrag = /* glsl */`
uniform sampler2D uTex; uniform float uImgAspect; uniform float uPlaneAspect;
uniform float uAlpha; uniform float uFocus; uniform float uHover; uniform float uDim; uniform float uFit; uniform float uTime;
varying vec2 vUv;
float sdRound(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}
void main(){
  vec2 uv=vUv-0.5;
  vec2 s=vec2(1.0);
  float ratio=uImgAspect/uPlaneAspect;
  if(uFit<0.5){ if(ratio>1.0) s.x=1.0/ratio; else s.y=ratio; }
  else { if(ratio>1.0) s.y=ratio; else s.x=1.0/ratio; s*=1.08; }
  vec2 tuv=uv*s*(1.0-0.07*uHover)+0.5;
  float shift=0.005*uHover;
  vec3 c=vec3(texture2D(uTex,tuv+vec2(shift,0.0)).r,texture2D(uTex,tuv).g,texture2D(uTex,tuv-vec2(shift,0.0)).b);
  if(uFit>0.5){
    float inside=step(0.0,tuv.x)*step(tuv.x,1.0)*step(0.0,tuv.y)*step(tuv.y,1.0);
    vec3 bg=mix(vec3(0.03,0.07,0.11),vec3(0.07,0.14,0.2),vUv.y);
    c=mix(bg,c,inside);
  }
  float gray=dot(c,vec3(0.299,0.587,0.114));
  c=mix(c,vec3(gray)*vec3(0.75,0.85,1.0),uDim*0.85);
  c*=mix(0.32,1.0,uFocus)*mix(1.0,0.45,uDim);
  c*=0.85+0.15*smoothstep(0.0,0.6,vUv.y);
  if(!gl_FrontFacing) c*=0.25;
  vec2 pp=uv*vec2(uPlaneAspect,1.0);
  float d=sdRound(pp,vec2(uPlaneAspect,1.0)*0.5,0.045);
  float mask=1.0-smoothstep(-0.004,0.002,d);
  float edge=smoothstep(0.012,0.0,abs(d+0.005));
  float sweep=smoothstep(0.08,0.0,abs(fract(vUv.x*0.5+vUv.y*0.3-uTime*0.12)-0.5))*0.35*uFocus;
  vec3 ice=vec3(0.56,0.83,1.0);
  c+=edge*ice*(0.25+0.75*max(uFocus,uHover));
  c+=sweep*ice*0.25*mask;
  gl_FragColor=vec4(c,mask*uAlpha);
}`;

/* ---------- mare di particelle ---------- */
const seaVert = /* glsl */`
${NOISE}
uniform float uTime; uniform float uScale;
varying float vA; varying float vH; varying float vPath;
void main(){
  vec3 p=position;
  float h=sin(p.x*0.22+uTime*0.55)*0.32+sin(p.z*0.3+uTime*0.75)*0.28+snoise(vec3(p.x*0.07,p.z*0.07,uTime*0.1))*0.95;
  p.y+=h;
  vec4 world=modelMatrix*vec4(p,1.0);
  vec4 mv=viewMatrix*world;
  float dist=-mv.z;
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(0.05+max(h,0.0)*0.03)*uScale/max(1.0,dist);
  vH=h;
  vPath=exp(-pow(world.x*0.16,2.0))*smoothstep(25.0,-50.0,world.z);
  vA=smoothstep(85.0,12.0,dist)*smoothstep(0.5,3.0,dist);
}`;
const seaFrag = /* glsl */`
uniform float uOpacity;
varying float vA; varying float vH; varying float vPath;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=smoothstep(0.5,0.0,d);
  vec3 deep=vec3(0.06,0.32,0.48);
  vec3 crest=vec3(0.62,0.88,1.0);
  vec3 gold=vec3(1.0,0.84,0.6);
  float k=smoothstep(-0.8,1.2,vH);
  vec3 c=mix(deep,crest,k);
  c=mix(c,gold,clamp(vPath*(0.35+k)*1.1,0.0,1.0));
  gl_FragColor=vec4(c,a*vA*uOpacity*(0.25+0.75*k+vPath*1.1));
}`;

/* ---------- luna / bagliore all'orizzonte ---------- */
const glowVert = /* glsl */`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const glowFrag = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
void main(){
  float d=length(vUv-0.5)*2.0;
  float core=smoothstep(0.16,0.12,d);
  float g=pow(max(0.0,1.0-d),3.0);
  gl_FragColor=vec4(uColor,(g*0.55+core)*uOpacity);
}`;

/* ---------- anelli del percorso (approccio) ---------- */
const ringFrag = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
void main(){
  float dash=0.55+0.45*sin(vUv.x*6.2831*24.0-uTime*2.0);
  gl_FragColor=vec4(uColor,uOpacity*dash);
}`;

/* ---------- sole splendente (sezione Territorio) ---------- */
const sunFrag = /* glsl */`
uniform float uOpacity; uniform float uTime; varying vec2 vUv;
void main(){
  vec2 p=vUv-0.5;
  float d=length(p)*2.0;
  float a=atan(p.y,p.x);
  float pulse=1.0+0.06*sin(uTime*1.7)+0.03*sin(uTime*3.1);
  float core=smoothstep(0.12,0.085,d);
  float inner=pow(max(0.0,1.0-d*2.4),2.0)*1.6*pulse;
  float corona=pow(max(0.0,1.0-d),2.6)*0.95*pulse;
  float rays=pow(abs(sin(a*6.0+uTime*0.12)),28.0)*0.75+pow(abs(sin(a*11.0-uTime*0.08+1.3)),48.0)*0.5;
  rays*=smoothstep(1.0,0.12,d)*smoothstep(0.06,0.16,d);
  float flare=exp(-abs(p.y)*90.0)*smoothstep(1.0,0.0,abs(p.x)*2.0)*0.55;
  vec3 hot=vec3(1.0,0.98,0.9);
  vec3 gold=vec3(1.0,0.74,0.34);
  vec3 c=hot*core*1.4+mix(gold,hot,0.55)*inner+gold*corona+mix(gold,hot,0.4)*rays+hot*flare;
  gl_FragColor=vec4(c,uOpacity);
}`;
window.SHADERS={sunFrag,NOISE,starsVert,starsFrag,warpVert,warpFrag,crystalVert,crystalFrag,haloVert,haloFrag,shellVert,shellFrag,dustVert,dustFrag,cardVert,cardFrag,seaVert,seaFrag,glowVert,glowFrag,ringFrag};
})();
