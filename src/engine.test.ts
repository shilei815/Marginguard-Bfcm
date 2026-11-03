import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {portfolio,line,minimums,optimize,crossing,scenario,type SKU,defaults} from './engine';
import {parseSKUs,records,parsePriorities,template,exportCSV} from './csv';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const skus=parseSKUs(read('sku_master.csv')).skus;
const steps=records(read('optimization_steps.csv')),frontier=records(read('cumulative_frontier.csv')),scenarios=records(read('expected_scenarios.csv'));
const optimized=minimums(skus);for(const step of steps)optimized[step.SKU]=+step.new_discount;
function matches(result:ReturnType<typeof portfolio>,oracle:Record<string,string>){expect(Math.abs(result.revenue-+oracle.revenue_usd)).toBeLessThanOrEqual(.00500001);expect(result.contribution).toBeCloseTo(+oracle.contribution_profit_usd,2);expect(result.contributionMargin).toBeCloseTo(+oracle.contribution_margin,5);expect(result.negative).toBe(+oracle.negative_sku_count);expect(result.lines.every(l=>l.discount>=l.sku.min-1e-9)).toBe(oracle.priority_constraint_pass==='True');expect(result.contribution>=+oracle.profit_floor_usd).toBe(oracle.floor_pass==='True');}
describe('preserved synthetic oracles',()=>{
 const cases=[()=>portfolio(skus),()=>portfolio(skus,minimums(skus)),()=>portfolio(skus,optimized),()=>portfolio(skus,optimized,{...defaults,stack:.1}),()=>portfolio(skus,optimized,{...defaults,shipping:5}),()=>portfolio(skus,optimized,{...defaults,returns:.1})];
 scenarios.slice(0,6).forEach((s,i)=>it(s.scenario,()=>matches(cases[i](),s)));
 it('infeasible fixture financial target is reproducible with explicit reconstruction',()=>{const ds=minimums(skus);ds['ELE-001']+=.4;matches(portfolio(skus,ds),scenarios[6]);expect(optimize(skus,44525.86).feasible).toBe(false);});
 it('replays every discrete optimization step',()=>{const ds=minimums(skus);for(const step of steps){ds[step.SKU]=+step.new_discount;const p=portfolio(skus,ds);expect(p.contribution).toBeCloseTo(+step.profit_usd,2);expect(p.contributionMargin).toBeCloseTo(+step.margin,5);}});
 it('reproduces every cumulative inclusion and first breach',()=>{const ds=minimums(skus);let first='';for(const row of frontier){const s=skus.find(s=>s.id===row.SKU)!;ds[s.id]=s.max;const p=portfolio(skus,ds);expect(p.contribution).toBeCloseTo(+row.cumulative_profit_usd,2);expect(p.contributionMargin).toBeCloseTo(+row.portfolio_margin,5);expect(p.contribution<27590.74).toBe(row.below_profit_floor==='True');if(!first&&p.contribution<27590.74)first=row.step;}expect(first).toBe('8');});
});
describe('financial definitions',()=>{
 const s:SKU={...skus[0],price:100,cost:30,units:10,inventory:8,feeRate:.03,fixedFee:.5,fulfillment:2,shipping:4,returnRate:.1,returnCost:10,extraCost:3};
 it('separates gross and contribution with all variable costs',()=>{const l=line(s,.2);expect(l.revenue).toBe(640);expect(l.gross).toBe(400);expect(l.contribution).toBeCloseTo(296.8);expect(l.units).toBe(8);expect(l.margin).toBe(.625);});
 it('stacks sequential discounts and return/shipping shocks',()=>{expect(line(s,.2,{stack:.1,shipping:5,returns:.1}).contribution).toBeCloseTo(186.72);});
 it('handles zero revenue and zero inventory',()=>{expect(line(s,1).margin).toBeNull();expect(line({...s,inventory:0},.2).contribution).toBe(0);});
 it('rejects invalid direct engine inputs',()=>{expect(()=>line({...s,feeRate:2})).toThrow();expect(()=>line(s,NaN)).toThrow();expect(()=>line(s,0,{...defaults,returns:1})).toThrow();expect(()=>line({...s,units:Infinity})).toThrow();});
 it('uses SKU then category then uniform scenario precedence',()=>{const ds=scenario(skus,.1,{Electronics:.2},{'ELE-001':.3});expect(ds['ELE-001']).toBe(.3);expect(ds['ELE-002']).toBe(.2);expect(ds['ACC-001']).toBe(.1);});
});
describe('exact continuous optimization',()=>{
 it('saturates the floor, respects bounds and locks',()=>{const result=optimize(skus,27590.74);expect(result.feasible).toBe(true);expect(portfolio(skus,result.discounts).contribution).toBeCloseTo(27590.74,6);for(const s of skus){expect(result.discounts[s.id]).toBeGreaterThanOrEqual(s.min);expect(result.discounts[s.id]).toBeLessThanOrEqual(s.max);if(s.priority==='P1')expect(result.discounts[s.id]).toBe(s.min);}expect(crossing(result.points,27590.74)).not.toBeNull();});
 it('profit objective returns required minimums',()=>{expect(optimize(skus,0,[],defaults,'profit').discounts).toEqual(minimums(skus));});
 it('reports infeasible minimums, floors, unknown IDs, and soft preferences',()=>{expect(optimize(skus,1e9).feasible).toBe(false);expect(optimize(skus,0,[{id:'ELE-001',min:.9}]).feasible).toBe(false);expect(optimize(skus,0,[{id:'missing',min:0}]).feasible).toBe(false);expect(optimize(skus,0,[{id:'ELE-001',min:.2,preferred:.3}]).preferredWarnings).toHaveLength(1);});
 it('honors feasible uploaded minima',()=>{const r=optimize(skus,0,[{id:'ACC-004',min:.08}]);expect(r.feasible).toBe(true);expect(r.discounts['ACC-004']).toBeGreaterThanOrEqual(.08);});
 it('is deterministic and row-order invariant with ID ties',()=>{expect(optimize([...skus].reverse(),27590.74).discounts).toEqual(optimize(skus,27590.74).discounts);});
 it('matches exhaustive grid on a small fractional knapsack',()=>{const a={...skus[0],id:'A',priority:'P3',min:0,max:1,price:10,units:1,inventory:1,cost:0,feeRate:0,fixedFee:0,fulfillment:0,shipping:0,returnRate:0,extraCost:0,weight:2};const b={...a,id:'B',price:20,weight:1};const r=optimize([a,b],15);let best=0;for(let i=0;i<=100;i++)for(let j=0;j<=100;j++)if(30-10*i/100-20*j/100>=15-1e-9)best=Math.max(best,2*i/100+j/100);expect(2*r.discounts.A+r.discounts.B).toBeCloseTo(best,8);});
 it('finds interpolated floor and zero crossing',()=>{const points=[100,50,-50].map((contribution,step)=>({step,contribution,id:'X',discount:0,belowFloor:false,negative:false}));expect(crossing(points,75)).toBe(.5);expect(crossing(points,0)).toBe(1.5);expect(crossing(points,-100)).toBeNull();});
});
describe('CSV boundary',()=>{
 it('reads BOM/CRLF fixture and complete template',()=>{expect(skus).toHaveLength(30);expect(parseSKUs(template).warnings).toHaveLength(0);});
 it('supports quoted commas and escaped quotes',()=>{expect(records('SKU,Product_Name\nA,"A, ""thing"""')[0].Product_Name).toBe('A, "thing"');});
 it('rejects duplicate SKUs, malformed quotes, headers, row counts, missing/invalid financials',()=>{const invalid=['SKU,SKU\nA,A','SKU,X\nA','SKU,Product_Name\nA,"bad','SKU,Expected_Units\nA,1',template.replace(',50,20,',',-50,20,'),template.replace(',50,20,',',Infinity,20,'),template.replace(',50,20,',',,20,'),template+template.split('\n')[1]+'\n'];for(const csv of invalid)expect(()=>parseSKUs(csv)).toThrow();});
 it('surfaces missing optional inputs and inventory caps',()=>{const data=parseSKUs('SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\nA,10,3,1,5');expect(data.warnings.length).toBeGreaterThan(5);expect(portfolio(data.skus).revenue).toBe(10);});
 it('validates priority CSV and decimal percentages',()=>{expect(parsePriorities('SKU,Minimum_Discount,Preferred_Discount\nELE-001,0.1,0.2',skus)[0].min).toBe(.1);for(const text of ['SKU,Minimum_Discount\nNOPE,.2','SKU,Minimum_Discount\nELE-001,20','SKU,Minimum_Discount,Preferred_Discount\nELE-001,.3,.2'])expect(()=>parsePriorities(text,skus)).toThrow();});
 it('escapes spreadsheet formulas on export',()=>{expect(exportCSV([{SKU:'=HYPERLINK("bad")'}])).toContain("'=HYPERLINK");});
});

it('preserves all eight original reference files byte for byte',()=>{const hashes=JSON.parse(read('docs/original-fixture-sha256.json')) as Record<string,string>;expect(Object.keys(hashes)).toHaveLength(8);for(const [file,hash] of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')).toBe(hash);});

it('handles SKUs and categories that match object prototype keys',()=>{const s={...skus[0],id:'toString',category:'constructor'};expect(portfolio([s]).revenue).toBe(s.price*s.units);expect(scenario([s],.1).toString).toBe(.1);});
