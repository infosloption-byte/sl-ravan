/**
 * Original, self-contained SL Ravan glTF/GLB art generator.
 * No third-party models or network downloads. Node.js 22+.
 * Output is reproducible game assets, not cinematic final art.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const output = resolve(dirname(fileURLToPath(import.meta.url)), "../public/assets/generated");
const TAU = Math.PI * 2;
const plus = (a,b) => a.map((v,i)=>v+b[i]);
const minus = (a,b) => a.map((v,i)=>v-b[i]);
const times = (a,k) => a.map(v=>v*k);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = v => {const n=Math.hypot(...v);return n>1e-9?times(v,1/n):[0,1,0];};
const blend = (a,b,t) => plus(times(a,1-t),times(b,t));
const rnd = n => {const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};

export class GlbModel {
  constructor(name){this.name=name;this.materials=[];this.parts=new Map();}
  material(name,rgb,opts={}){
    const i=this.materials.length;
    this.materials.push({
      name, pbrMetallicRoughness:{
        baseColorFactor:[...rgb,1],
        metallicFactor:opts.metallic??0,roughnessFactor:opts.roughness??.93
      },doubleSided:true,alphaMode:"OPAQUE"
    });
    this.parts.set(i,{positions:[],normals:[],indices:[]});
    return i;
  }
  triangle(mat,a,b,c){
    const part=this.parts.get(mat);
    const n=unit(cross(minus(b,a),minus(c,a))),at=part.positions.length/3;
    for(const p of [a,b,c]){part.positions.push(...p);part.normals.push(...n);}
    part.indices.push(at,at+1,at+2);
  }
  quad(mat,a,b,c,d){this.triangle(mat,a,b,c);this.triangle(mat,a,c,d);}
  box(mat,center,size){
    const [x,y,z]=center,[w,h,d]=size;
    const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
    this.quad(mat,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
    this.quad(mat,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]);
    this.quad(mat,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
    this.quad(mat,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]);
    this.quad(mat,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]);
    this.quad(mat,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
  }
  cylinder(mat,start,end,bottom,top,sides=9){
    const axis=unit(minus(end,start)),aux=Math.abs(axis[1])>.9?[1,0,0]:[0,1,0];
    const u=unit(cross(axis,aux)),v=unit(cross(axis,u));
    const ring=(c,r,a)=>plus(c,plus(times(u,r*Math.cos(a)),times(v,r*Math.sin(a))));
    for(let i=0;i<sides;i++){
      const a=i*TAU/sides,b=(i+1)*TAU/sides;
      this.quad(mat,ring(start,bottom,a),ring(start,bottom,b),ring(end,top,b),ring(end,top,a));
    }
  }
  leaf(mat,base,direction,length,width){
    const d=unit(direction);let tangent=unit(cross(d,[0,1,0]));
    if(Math.hypot(...tangent)<.1)tangent=[1,0,0];
    const lift=unit(cross(d,tangent));
    const middle=plus(base,plus(times(d,length*.53),times(lift,length*.1)));
    const left=plus(middle,times(tangent,width*.52));
    const right=minus(middle,times(tangent,width*.52));
    const mid=plus(middle,times(lift,.11));
    const tip=plus(base,times(d,length));
    this.triangle(mat,base,left,mid);this.triangle(mat,base,mid,right);
    this.triangle(mat,left,tip,mid);this.triangle(mat,mid,tip,right);
  }
  /** Real little-endian GLB v2 with indexed mesh primitives and PBR materials. */
  toGlb(){
    const buffers=[],views=[],accessors=[],primitives=[];let byteOffset=0;
    const store=(buffer,target)=>{
      const aligned=buffer.length%4?Buffer.concat([buffer,Buffer.alloc(4-buffer.length%4)]):buffer;
      const at=byteOffset;byteOffset+=aligned.length;buffers.push(aligned);
      const index=views.length;views.push({buffer:0,byteOffset:at,byteLength:buffer.length,target});
      return index;
    };
    const accessor=(array,type,componentType,target,min,max)=>{
      const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
      const bufferView=store(data,target),index=accessors.length;
      accessors.push({
        bufferView,componentType,count:array.length/(type==="VEC3"?3:1),type,
        ...(min?{min,max}:{})
      });
      return index;
    };
    for(const [mat,part] of this.parts){
      if(!part.indices.length)continue;
      const positions=new Float32Array(part.positions),normals=new Float32Array(part.normals);
      const indices=new Uint32Array(part.indices);
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<positions.length;i+=3)for(let j=0;j<3;j++){
        min[j]=Math.min(min[j],positions[i+j]);max[j]=Math.max(max[j],positions[i+j]);
      }
      const p=accessor(positions,"VEC3",5126,34962,min,max);
      const n=accessor(normals,"VEC3",5126,34962);
      const id=accessor(indices,"SCALAR",5125,34963);
      primitives.push({attributes:{POSITION:p,NORMAL:n},indices:id,material:mat,mode:4});
    }
    const binary=Buffer.concat(buffers);
    const document={
      asset:{version:"2.0",generator:"SL Ravan original art v1"},
      scene:0,scenes:[{nodes:[0]}],nodes:[{name:this.name,mesh:0}],
      meshes:[{name:this.name,primitives}],materials:this.materials,
      bufferViews:views,accessors,buffers:[{byteLength:binary.length}]
    };
    const json=Buffer.from(JSON.stringify(document),"utf8");
    const j=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
    const b=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
    const glb=Buffer.alloc(12+8+j.length+8+b.length);
    glb.write("glTF",0,"ascii");glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
    glb.writeUInt32LE(j.length,12);glb.write("JSON",16,"ascii");j.copy(glb,20);
    const at=20+j.length;glb.writeUInt32LE(b.length,at);glb.write("BIN\0",at+4,"ascii");b.copy(glb,at+8);
    return glb;
  }
}

export function createHeritageTree(){
  const m=new GlbModel("SL Ravan heritage rain tree");
  const bark=m.material("old teak bark",[.25,.17,.105]);
  const ridges=m.material("bark ridges",[.43,.3,.16]);
  const leaves=[
    m.material("deep emerald",[.12,.33,.16]),
    m.material("tropical green",[.2,.47,.2]),
    m.material("sunlit canopy",[.35,.57,.24])
  ];
  m.cylinder(bark,[0,0,0],[0,10.7,0],.82,.25,13);
  for(let i=0;i<7;i++){
    const a=TAU*i/7;
    m.cylinder(bark,[0,0,0],[Math.cos(a)*2.6,.45,Math.sin(a)*2.6],.34,.05,7);
  }
  for(let i=0;i<24;i++){
    const a=i*TAU/24,x=Math.cos(a)*.76,z=Math.sin(a)*.76;
    m.cylinder(ridges,[x,.3,z],[x*.61,9.8+rnd(i)*.7,z*.61],.065,.012,5);
  }
  for(let tier=0;tier<4;tier++){
    const y=5.8+tier*1.45,count=[7,9,9,6][tier],spread=[5.7,6.9,6.1,3.6][tier];
    for(let branch=0;branch<count;branch++){
      const n=tier*20+branch,a=TAU*branch/count+tier*.44+rnd(n)*.2;
      const start=[Math.cos(a)*.17,y,Math.sin(a)*.17];
      const end=[Math.cos(a)*spread,y+1.3+rnd(n*2)*.65,Math.sin(a)*spread];
      m.cylinder(bark,start,end,.25,.055,8);
      for(let twig=0;twig<4;twig++){
        const t=.46+twig*.14,b=blend(start,end,t),sideA=a+(twig%2?1:-1)*(.43+rnd(n*7+twig)*.32);
        const endTwig=plus(b,[Math.cos(sideA)*1.3,.48,Math.sin(sideA)*1.3]);
        m.cylinder(bark,b,endTwig,.065,.015,5);
        for(let leaf=0;leaf<5;leaf++){
          const v=leaf*TAU/5+rnd(n*17+twig*5+leaf)*.35;
          const dir=[Math.cos(v)*(.7+rnd(leaf+n)*.5),.04+rnd(n+leaf*20)*.55,Math.sin(v)*(.7+rnd(leaf*13+n)*.5)];
          m.leaf(leaves[(twig+leaf+n)%3],endTwig,dir,
            1+rnd(n*29+twig*7+leaf)*.72,.54+rnd(n+leaf)*.34);
        }
      }
    }
  }
  for(let i=0;i<28;i++){
    const a=i*TAU/28,r=4.6+rnd(i*39)*1.6;
    const start=[Math.cos(a)*r,9.2+rnd(i*3)*2.8,Math.sin(a)*r];
    m.cylinder(leaves[1],start,plus(start,[.14,-(.7+rnd(i*11)*2.1),.09]),.019,.004,4);
  }
  return m;
}

export function createStonePavilion(){
  const m=new GlbModel("SL Ravan ancient Lanka ceremonial pavilion");
  const stone=m.material("worn granite",[.43,.42,.36]);
  const pale=m.material("carved stone",[.64,.60,.49]);
  const dark=m.material("basalt detail",[.24,.28,.27]);
  const bronze=m.material("aged bronze",[.61,.44,.20],{metallic:.6,roughness:.56});
  const moss=m.material("temple moss",[.21,.36,.22]);
  const red=m.material("royal crimson",[.45,.18,.14]);
  for(let i=0;i<3;i++)m.box(i===1?pale:stone,[0,.22+i*.32,0],[10.6-i*.55,.43,10.6-i*.55]);
  for(const x of [-3.65,3.65])for(const z of [-3.65,3.65]){
    m.box(dark,[x,.95,z],[1.3,.3,1.3]);m.cylinder(stone,[x,1.1,z],[x,5.8,z],.53,.43,12);
    m.box(pale,[x,2,z],[1.2,.12,1.2]);m.box(bronze,[x,3.6,z],[1.09,.095,1.09]);
    m.box(pale,[x,5.75,z],[1.45,.47,1.45]);m.box(bronze,[x,6.05,z],[1.57,.12,1.57]);
  }
  m.box(stone,[0,3.6,4.3],[8.8,5.9,.6]);
  for(const x of [-2.7,0,2.7]){
    m.box(pale,[x,3.5,3.96],[.46,4.1,.2]);
    for(let y=2;y<5.3;y+=.75)m.box(bronze,[x,y,3.84],[.59,.1,.24]);
  }
  for(let i=0;i<7;i++)m.box(bronze,[-3.3+i*1.1,6.65,4.33],[.35,.37,.32]);
  for(let i=0;i<4;i++){
    const w=9.8-i*.83;
    m.box(i%2?dark:stone,[0,6.45+i*.4,0],[w,.38,w]);
    m.box(bronze,[0,6.5+i*.4,-w/2],[w,.08,.12]);
  }
  for(let i=0;i<3;i++)m.box(i===1?bronze:stone,[0,8+i*.34,0],[6.8-i*1.8,.33,6.8-i*1.8]);
  for(const x of [-2.4,2.4]){
    m.box(dark,[x,1.02,-5],[1,1,1]);
    m.cylinder(bronze,[x,1.5,-5],[x,2.3,-5],.30,.1,9);
    m.cylinder(red,[x,2.25,-5],[x,2.95,-5],.17,0,9);
  }
  for(let i=0;i<9;i++){
    const x=-3.7+i*.92;
    m.box(pale,[x,6.40,-5.10],[.42,.42,.2]);
    m.box(bronze,[x,6.40,-5.24],[.18,.18,.12]);
  }
  for(const z of [-3.8,3.7])for(const x of [-3.5,3.5])m.box(moss,[x,1.08,z],[.78,.14,.71]);
  return m;
}

export async function generateArt(){
  await mkdir(output,{recursive:true});
  for(const [name,model] of [
    ["heritage-tree.glb",createHeritageTree()],
    ["stone-pavilion.glb",createStonePavilion()]
  ]){
    const bytes=model.toGlb();
    await writeFile(resolve(output,name),bytes);
    console.log("Generated "+name+" ("+(bytes.length/1024).toFixed(1)+" KB)");
  }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await generateArt();
}
