export function skipSqlTrivia(sql,start=0){
 let i=start;
 while(i<sql.length){
  if(/\s/.test(sql[i])){i++;continue;}
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end+1;continue;}
  if(sql.startsWith('/*',i)){let depth=1;i+=2;while(i<sql.length&&depth){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}continue;}
  break;
 }
 return i;
}
export function firstSqlKeyword(sql){
 const i=skipSqlTrivia(sql),match=sql.slice(i).match(/^([a-z_]+)/i);
 return match?match[1].toUpperCase():'';
}
function sqlAfterKeyword(sql,keyword){
 const i=skipSqlTrivia(sql),match=sql.slice(i).match(new RegExp('^'+keyword+'\\b','i'));
 return match?sql.slice(i+match[0].length):'';
}
export function explainStatementKeyword(sql){
 let rest=sqlAfterKeyword(sql,'EXPLAIN'),i=skipSqlTrivia(rest);
 if(rest[i]==='('){
  let depth=0,inSingle=false;
  for(;i<rest.length;i++){
   const ch=rest[i];
   if(ch==="'" ){if(inSingle&&rest[i+1]==="'"){i++;continue;}inSingle=!inSingle;}
   if(!inSingle&&ch==='(')depth++;
   if(!inSingle&&ch===')'&&--depth===0){i++;break;}
  }
  rest=rest.slice(i);
 }else{
  while(true){
   const key=firstSqlKeyword(rest);
   if(['ANALYZE','VERBOSE','COSTS','SETTINGS','BUFFERS','WAL','TIMING','SUMMARY'].includes(key)){rest=sqlAfterKeyword(rest,key);continue;}
   if(key==='FORMAT'){rest=sqlAfterKeyword(rest,'FORMAT');rest=sqlAfterKeyword(rest,firstSqlKeyword(rest));continue;}
   break;
  }
 }
 return firstSqlKeyword(rest);
}
export function splitStatements(sql) {
 const out=[];let cur='',single=false,dbl=false,line=false,blockDepth=0,dollarTag=null,escapeString=false;
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];
  if(line){cur+=c;if(c==='\n')line=false;continue;}
  if(blockDepth){cur+=c;if(c==='/'&&n==='*'){cur+=n;i++;blockDepth++;}else if(c==='*'&&n==='/'){cur+=n;i++;blockDepth--;}continue;}
  if(dollarTag){if(sql.startsWith(dollarTag,i)){cur+=dollarTag;i+=dollarTag.length-1;dollarTag=null;}else cur+=c;continue;}
  if(!single&&!dbl&&c==='-'&&n==='-'){cur+=c+n;i++;line=true;continue;}
  if(!single&&!dbl&&c==='/'&&n==='*'){cur+=c+n;i++;blockDepth=1;continue;}
  if(!single&&!dbl&&c==='$'){
   const match=sql.slice(i).match(/^\$[a-z_][a-z0-9_]*\$|^\$\$/i);
   if(match){dollarTag=match[0];cur+=dollarTag;i+=dollarTag.length-1;continue;}
  }
  if(single&&escapeString&&c==='\\'){cur+=c;if(i+1<sql.length)cur+=sql[++i];continue;}
  if(c==="'"&&!dbl){
   if(single&&n==="'"){cur+=c+n;i++;continue;}
   if(!single){const prev=sql[i-1]||'',before=sql[i-2]||'';escapeString=(prev==='e'||prev==='E')&&(!before||!/[a-z0-9_$]/i.test(before));}
   else escapeString=false;
   single=!single;
  }
  else if(c==='"'&&!single){if(dbl&&n==='"'){cur+=c+n;i++;continue;}dbl=!dbl;}
  if(c===';'&&!single&&!dbl){if(cur.trim())out.push(cur.trim());cur='';}
  else cur+=c;
 }
 if(cur.trim())out.push(cur.trim());
 return out;
}
