// Offline balance regression: runs the actual HTML combat engine, without a browser.
const fs=require('fs'),vm=require('vm');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const node=()=>({children:[],style:{},classList:{add(){},remove(){}},append(){},replaceChildren(){},querySelectorAll(){return []},addEventListener(){},getContext(){return {}}});
const elements={};const document={getElementById(id){return elements[id]??=node()}};
source=source.replace(/defaultNames\.sort\(\(a,b\)=>a\.localeCompare\(b,'ru'\)\)\.forEach\(addName\);draw\(\);/,`end=()=>{running=false};updateStats=()=>{};
globalThis.engine={weapons,balance,roleTest(){
const check=(ok,message)=>{if(!ok)throw Error(message)};
const make=(wi,id,x)=>({wi,id,name:String(wi),weapon:weapons[wi],x,y:320,vx:0,vy:0,hp:100,alive:true,cd:100,dodge:100,phase:0,angle:0,flash:0,attack:0,kills:0});
const scene=(wi,enemy=2)=>{zones=[];shots=[];effects=[];elapsed=0;finishOrder=[];running=true;fighters=[make(wi,0,450),make(enemy,1,510)];return fighters};
let [a,b]=scene(2);attack(a,b);check(shots.length===3,'Pea volley must contain three projectiles');
[a,b]=scene(0);a.combo=2;shots=[{owner:b,x:470,y:320,t:1,kind:'bomb'}];attack(a,b);check(shots[0].erased&&a.guard>0,'Eraser must erase projectile and guard');let hp=a.hp;update(1/60);check(a.hp===hp,'Erased bomb must not explode');
[a,b]=scene(6);a.combo=2;attack(a,b);check(a.cd===1.15&&Math.abs(a.vy)>100,'Ninja combo must retreat sideways');
[a,b]=scene(9);projectile(a,b,'magic');shots[0].x=b.x;shots[0].y=b.y;update(1/60);check(b.slow>0,'Bubble must apply slow');
[a,b]=scene(4);projectile(a,b,'bow');const c=make(5,2,570);fighters.push(c);b.alive=false;update(1/60);check(shots[0].target===c,'Bee must retarget after elimination');
[a,b]=scene(13);projectile(a,b,'dynamite');shots[0].t=.3;let velocity=Math.hypot(shots[0].vx,shots[0].vy);update(1/60);check(Math.hypot(shots[0].vx,shots[0].vy)<velocity,'Black hole must stop before collapse');
[a,b]=scene(14);const c2=make(5,2,545);fighters.push(c2);attack(a,b);check(c2.hp<100,'Lightning must chain');
[a,b]=scene(3);a.combo=3;attack(a,b);check(zones.length===1&&b.hp===100,'Mine must arm before dealing damage');updateZones(.2);check(b.hp===100,'Mine must respect warning time');updateZones(.15);check(b.hp<100&&zones.length===0,'Armed mine must trigger once');
[a,b]=scene(14);a.combo=3;attack(a,b);updateZones(.2);check(b.hp===100,'Storm must warn before strike');updateZones(.31);check(b.hp<100,'Storm must strike after warning');
[a,b]=scene(12);a.combo=3;attack(a,b);updateZones(.1);const afterSpin=b.hp;updateZones(.1);check(afterSpin<100&&b.hp===afterSpin,'Spin must hit each target only once');
[a,b]=scene(5);a.combo=3;attack(a,b);check(!!a.leap,'Spring special must start a leap');updateZones(.43);check(!a.leap&&b.hp<100,'Leap must land and deal damage');
[a,b]=scene(4);a.combo=3;attack(a,b);check(shots.length===3&&shots.every(s=>s.small),'Bee special must launch a small swarm');
[a,b]=scene(9);a.combo=3;attack(a,b);a.alive=false;updateZones(.5);check(zones.length===0&&b.hp===100,'Dead owners cannot leave active traps');
},cutoffTest(){for(let n=2;n<=15;n++){fighters=Array.from({length:n},(_,i)=>({alive:true,hp:i+1,weapon:weapons[i],x:0,y:0}));finishOrder=[];effects=[];running=true;nextRound(fighters.slice());if(fighters.filter(f=>f.alive).length!==Math.ceil(n/2))throw Error('Incorrect cutoff');if(finishOrder.some(f=>f.hp>Math.floor(n/2)))throw Error('Incorrect HP order')}},run(ids){
zones=[];shots=[];effects=[];finishOrder=[];elapsed=0;running=true;
fighters=ids.map((wi,i)=>{let a=i*Math.PI*2/ids.length+Math.random()*0.1;return {name:String(wi),id:i,wi,weapon:weapons[wi],x:500+Math.cos(a)*230,y:322+Math.sin(a)*230,vx:0,vy:0,hp:100,alive:true,cd:rand(.1,1),dodge:rand(1,3),angle:a,flash:0,attack:0,phase:rand(0,6),kills:0}});
for(let step=0;running&&step<12000;step++)update(1/30);
if(running)throw Error('Battle did not finish');
if(fighters.some(f=>!Number.isFinite(f.hp)||!Number.isFinite(f.x)))throw Error('Invalid fighter');
return (fighters.find(f=>f.alive)||finishOrder.at(-1)).wi;
}};`);
let seed=Number(process.env.SEED||87129);const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const sandbox={document,Math:math};vm.runInNewContext(source,sandbox);const e=sandbox.engine;
e.cutoffTest();console.log('Cutoff verified for 2–15 players.');
e.roleTest();console.log('Role mechanics verified: attacks, traps, telegraphs, leap, swarm, one-hit spin, dead-owner cleanup.');
for(let size=2;size<=15;size++)e.run(Array.from({length:size},(_,i)=>i));
console.log('Full matches verified for every player count, 2–15.');
const ids=Array.from({length:15},(_,i)=>i), rounds=Number(process.env.ROUNDS||100);
function evaluate(){const duels=Array(15).fill(0),wins=Array(15).fill(0),games=Array(15).fill(0),expected=Array(15).fill(0);
for(let n=0;n<rounds;n++){const order=ids.slice();for(let j=14;j>0;j--){const k=Math.floor(math.random()*(j+1));[order[j],order[k]]=[order[k],order[j]]}for(let i=0;i<15;i++){let a=order[i],b=order[(i+1)%15];duels[e.run([a,b])]++;games[a]++;games[b]++}const size=[4,8,15][n%3],group=order.slice(0,size);for(const i of group)expected[i]+=1/size;wins[e.run(group)]++}
return ids.map(i=>({i,name:e.weapons[i].name,duel:duels[i]/games[i],ffa:wins[i],ffaRatio:+(wins[i]/expected[i]).toFixed(2),power:e.balance[i]}))}
const iterations=Number(process.env.ITERATIONS||1);for(let k=0;k<iterations;k++){let result=evaluate();console.log(JSON.stringify(result));if(k<iterations-1)for(const r of result)e.balance[r.i]*=Math.exp((.5-r.duel)*.7)}
