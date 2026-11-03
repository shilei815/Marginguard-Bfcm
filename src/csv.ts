import Papa from 'papaparse';
import {type SKU,type Priority,validateSKU,validRate} from './engine';
const fields={id:'SKU',name:'Product_Name',category:'Category',priority:'Priority',price:'Regular_Price_USD',cost:'Unit_COGS_USD',fulfillment:'Fulfillment_Cost_USD',shipping:'Merchant_Shipping_USD',units:'Expected_Units',min:'Locked_Min_Discount',max:'Max_Discount',step:'Step_Discount',feeRate:'Payment_Fee_Rate',fixedFee:'Order_Fixed_Fee_Allocated_USD',returnRate:'Expected_Return_Rate',returnCost:'Return_Cost_Per_Return_USD',weight:'Allocation_Weight',inventory:'Inventory_Units',extraCost:'Other_Variable_Cost_USD'} as const;
export function records(csv:string):Record<string,string>[] {
 if(csv.length>5_000_000)throw Error('CSV exceeds 5 MB limit');
 const parsed=Papa.parse<string[]>(csv.replace(/^\uFEFF/,''),{skipEmptyLines:'greedy'});
 if(parsed.errors.length)throw Error(parsed.errors.map(e=>`Row ${(e.row??0)+1}: ${e.message}`).join('; '));
 const [headers,...rows]=parsed.data;if(!headers?.length||!rows.length)throw Error('CSV must contain a header and at least one data row');
 const names=headers.map(h=>h.trim());if(new Set(names).size!==names.length)throw Error('Duplicate CSV headers');
 if(rows.length>10000)throw Error('Maximum 10,000 SKUs per CSV');
 return rows.map((row,i)=>{if(row.length!==names.length)throw Error(`Row ${i+2}: column count differs from header`);return Object.fromEntries(names.map((h,j)=>[h,row[j].trim()]));});
}
export function parseSKUs(csv:string){
 const rows=records(csv),warnings=new Set<string>(),errors:string[]=[],seen=new Set<string>();
 const required=['SKU','Regular_Price_USD','Unit_COGS_USD','Inventory_Units','Expected_Units'];
 for(const column of Object.keys(rows[0]))if(!Object.values(fields).includes(column as typeof fields[keyof typeof fields]))warnings.add(`Unrecognized column ${column}: excluded from calculations. Map it to a template field before planning.`);
 for(const f of required)if(!(f in rows[0]))throw Error(`Missing required column: ${f}`);
 const skus=rows.map((r,i)=>{
 const s={} as SKU;
 for(const [key,col] of Object.entries(fields)){
 const k=key as keyof SKU,v=r[col];
 if(['id','name','category','priority'].includes(k))Object.assign(s,{[k]:v||(k==='category'?'Uncategorized':k==='priority'?'P3':k==='name'?r.SKU:'')});
 else {const fallback=k==='max'?1:k==='step'?.05:k==='weight'?1:0;
 if(v===undefined||v===''){if(required.includes(col))errors.push(`Row ${i+2}: ${col} is required`);else warnings.add(`${col} missing: using ${fallback}. Confirm this assumption.`);}
 // Reject coercions such as hex and currency symbols; percentages are decimals.
 const n=v===undefined||v===''?fallback:/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)?Number(v):NaN;
 Object.assign(s,{[k]:n});}
 }
 if(seen.has(s.id))errors.push(`Row ${i+2}: duplicate SKU ${s.id}`);seen.add(s.id);
 if(!['P1','P2','P3'].includes(s.priority))errors.push(`${s.id}: Priority must be P1, P2, or P3`);
 errors.push(...validateSKU(s));
 if(s.units>s.inventory)warnings.add(`${s.id}: expected sales capped at inventory (${s.inventory})`);
 return s;});
 if(errors.length)throw Error(errors.slice(0,30).join('\n'));
 return {skus,warnings:[...warnings]};
}
export function parsePriorities(csv:string,skus:SKU[]):Priority[]{
 const rows=records(csv),seen=new Set<string>();return rows.map(r=>{
 if(!r.SKU||!skus.some(s=>s.id===r.SKU))throw Error(`Unknown priority SKU: ${r.SKU||'(empty)'}`);
 if(seen.has(r.SKU))throw Error(`Duplicate priority SKU: ${r.SKU}`);seen.add(r.SKU);
 const num=(v:string|undefined)=>v!==undefined&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)?Number(v):NaN;
 const min=num(r.Minimum_Discount),preferred=r.Preferred_Discount?num(r.Preferred_Discount):undefined;
 if(!validRate(min)||(preferred!==undefined&&(!validRate(preferred)||preferred<min)))throw Error(`${r.SKU}: invalid minimum/preferred discount; use decimals 0–1`);
 return {id:r.SKU,min,preferred};});
}
export const template=Object.values(fields).join(',')+'\nEXAMPLE-001,Example product,Example,P3,50,20,3,4,100,0,0.5,0.05,0.029,0.3,0.05,10,1,150,0\n';
export const priorityTemplate='SKU,Minimum_Discount,Preferred_Discount\nEXAMPLE-001,0.1,0.2\n';
export function download(name:string,data:string){const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function exportCSV(rows:Record<string,unknown>[]){return Papa.unparse(rows,{escapeFormulae:true});}
