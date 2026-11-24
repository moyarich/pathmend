"use strict";
const path=require("node:path");
const {parseYaml,yscalar}=require("../../parsers/yaml");
const {yamlRef}=require("../../references/create-reference");
const {literal}=require("../config-path");
function extractYamlPaths(c,settings){
 const names=new Set(Array.isArray(settings.yamlPathAttributes)?settings.yamlPathAttributes:[]);
 if(!names.size)return [];
 const out=[];
 function add(n,key){
   const s=yscalar(n);
   if(s&&literal(s.value))out.push(yamlRef(c,s,{base:path.dirname(c.file),code:"PM023",label:"YAML "+key,kind:"any"}));
 }
 function walk(node){
   if(node?.type==="map")for(const e of node.entries){
     if(names.has(e.key)){
       if(e.value?.type==="seq")for(const item of e.value.items)add(item,e.key);
       else add(e.value,e.key);
     }
     walk(e.value);
   }
   if(node?.type==="seq")for(const item of node.items)walk(item);
 }
 for(const doc of parseYaml(c.text))walk(doc);
 return out;
}
const format={
 id:"yaml-paths",patterns:["**/*.{yaml,yml}"],order:2,
 rules:{PM023:{name:"yaml-attribute-path-not-found",description:"Configured YAML local path attribute not found",category:"yaml",tags:["yaml","attributes"],severity:"warning",fixable:true}},
 match({base}){return /\.ya?ml$/i.test(base)?"yaml-paths":null;},
 extract(c,ctx,settings){return extractYamlPaths(c,settings);}
};
module.exports={format,extractYamlPaths};
