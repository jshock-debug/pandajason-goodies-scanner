import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sources=JSON.parse(await readFile('sources.json','utf8'));
const config=JSON.parse(await readFile('config.json','utf8'));
const state=JSON.parse(await readFile('data/state.json','utf8'));
const history=await readFile('data/history.json','utf8').then(JSON.parse).catch(()=>[]);
const trigger=process.env.SCAN_TRIGGER||'manual_test';
const isScheduled=trigger==='schedule';
const now=new Date();
const iso=now.toISOString();
const malaysiaDate=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const generic=/^(promotions?|offers?|deals?|rewards?|member benefits|membership|membership faq|membership t&c|hot deals|current promotions|promotion enquiry|promotional spaces|e-?voucher|promos)$/i;
const keyword=/(free|complimentary|birthday|reward|redeem|giveaway|opening|launch|promotion|promo|deal|gift|sample|voucher|member|exclusive|免费|生日|优惠|好康|开幕|赠品)/i;
const clean=value=>value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const absolute=(href,base)=>{try{return new URL(href,base).toString()}catch{return base}};
const digest=value=>createHash('sha256').update(value).digest('hex');

if(config.aiServicesAllowed||config.openaiAllowed||config.autoPublishAllowed)throw new Error('Safety stop: AI/OpenAI/publishing must remain disabled.');
if(isScheduled&&state.scheduledRunsCompleted>=config.trialRuns){console.log('Trial already complete; no scan performed.');process.exit(0)}

async function scan(source){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(source.url,{signal:controller.signal,redirect:'follow',headers:{'user-agent':'PandaJasonGoodiesScanner/1.0 (+https://github.com/jshock-debug/pandajason-goodies-scanner)','accept':'text/html,application/xhtml+xml'}});const html=await response.text();if(!response.ok)throw new Error(`HTTP ${response.status}`);const anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:absolute(m[1],source.url),title:clean(m[2])})).filter(x=>x.title.length>=6&&x.title.length<=180&&keyword.test(x.title)&&!generic.test(x.title)).filter((x,i,a)=>a.findIndex(y=>y.url===x.url&&y.title===x.title)===i).slice(0,8);return {...source,status:'success',httpStatus:response.status,contentHash:digest(clean(html).slice(0,250000)),checkedAt:iso,error:null,leads:anchors.map(x=>({...x,sourceId:source.id,sourceName:source.name,region:source.region,verificationLevel:'awaiting_deep_verification'}))};}catch(error){return {...source,status:'failed',httpStatus:null,contentHash:null,checkedAt:iso,error:error?.name==='AbortError'?'timeout':String(error?.message||error),leads:[]};}finally{clearTimeout(timer)}}

const results=[];for(let i=0;i<sources.length;i+=5)results.push(...await Promise.all(sources.slice(i,i+5).map(scan)));
const previous=await readFile('data/latest.json','utf8').then(JSON.parse).catch(()=>({sourceResults:[]}));
const oldHashes=new Map((previous.sourceResults||[]).map(x=>[x.id,x.contentHash]));
const changed=results.filter(x=>x.contentHash&&oldHashes.has(x.id)&&oldHashes.get(x.id)!==x.contentHash).length;
const leads=results.flatMap(x=>x.leads).filter((x,i,a)=>a.findIndex(y=>y.url===x.url&&y.title===x.title)===i);
const succeeded=results.filter(x=>x.status==='success').length;
const failed=results.length-succeeded;
if(isScheduled){state.scheduledRunsCompleted+=1;state.firstScheduledRunAt??=iso;state.lastScheduledRunAt=iso;if(state.scheduledRunsCompleted>=config.trialRuns){state.trialStatus='complete';state.completedAt=iso}else state.trialStatus='running'}
const latest={runId:`scan-${Date.now()}`,trigger,startedAt:iso,completedAt:new Date().toISOString(),malaysiaDate,status:failed===results.length?'failed':failed?'partial':'success',sourcesTotal:results.length,sourcesSucceeded:succeeded,sourcesFailed:failed,newLeads:leads.length,changedSources:changed,aiCalls:0,openaiCalls:0,autoPublished:0,verificationLevel:'awaiting_deep_verification',trial:{scheduledRunsCompleted:state.scheduledRunsCompleted,scheduledRunsTarget:config.trialRuns,status:state.trialStatus},leads,sourceResults:results.map(({leads:_,...x})=>x)};
const summary=Object.fromEntries(Object.entries(latest).filter(([key])=>!['leads','sourceResults'].includes(key)));
const nextHistory=[summary,...history.filter(x=>x.runId!==latest.runId)].slice(0,14);
await mkdir('data/runs',{recursive:true});await writeFile('data/latest.json',JSON.stringify(latest,null,2)+'\n');await writeFile('data/history.json',JSON.stringify(nextHistory,null,2)+'\n');await writeFile(`data/runs/${malaysiaDate}-${trigger}-${Date.now()}.json`,JSON.stringify(latest,null,2)+'\n');await writeFile('data/state.json',JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({status:latest.status,succeeded,failed,leads:leads.length,aiCalls:0,openaiCalls:0,scheduledRunsCompleted:state.scheduledRunsCompleted,trialStatus:state.trialStatus}));
