"use strict";
// Preserve offsets. Only recognize declarations at the start of a source line
// outside comments, quoted strings and template literals.
function declarations(text) {
  const refs=[];
  let i=0, atLine=true;
  const newline=()=>{atLine=true;};
  const re=/^(?:import\s+(?:(?:type\s+)?[\w$*{},\s]+?\s+from\s+)?|export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[\w$,\s]*\})\s+from\s+)(["'])(\.\.?\/[^"'\\\r\n]+)\1/;
  while(i<text.length){
    const c=text[i];
    if(c==="\n"){newline();i++;continue;}
    if(c===" "||c==="\t"||c==="\r"){i++;continue;}
    if(text.startsWith("//",i)){const end=text.indexOf("\n",i);i=end<0?text.length:end;continue;}
    if(text.startsWith("/*",i)){const end=text.indexOf("*/",i+2);if(end<0)break;if(text.slice(i,end).includes("\n"))newline();i=end+2;continue;}
    if(atLine&&(text.startsWith("import",i)||text.startsWith("export",i))){
      const m=re.exec(text.slice(i,i+8192));
      if(m){refs.push({value:m[2],start:i+m[0].lastIndexOf(m[2])});i+=m[0].length;atLine=false;continue;}
    }
    atLine=false;
    if(c==="'"||c==='"'||c.charCodeAt(0)===96){
      const quote=c;
      for(i++;i<text.length;i++){
        if(text[i]==="\\"){i++;continue;}
        if(text[i]===quote){i++;break;}
        // An interpolated template is opaque; stop rather than misread nested JS.
        if(quote.charCodeAt(0)===96&&text.startsWith("${",i))return refs;
      }
      continue;
    }
    i++;
  }
  return refs;
}
module.exports={declarations};
