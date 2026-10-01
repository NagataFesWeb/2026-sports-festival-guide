// Git追跡対象だけを検査し、個人別データや秘密情報の混入を止める。
import { execFileSync } from "node:child_process";
const paths=execFileSync("git",["ls-files","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);
const forbidden=paths.filter(p=>/^(?:data|\.data|\.private|\.audit|\.next)\//.test(p)||/^src\/lib\/festival\/(entries|snapshot)\.data\.ts$/.test(p)||/\.(zip|docx|xlsx|csv|pdf)$/i.test(p)||(/(^|\/)\.env/.test(p)&&p!==".env.example"));
const secrets=[];
for(const path of paths){
  if(/\.(png|ico|gltf)$/.test(path))continue;
  const text=execFileSync("git",["show",`:${path}`],{encoding:"utf8"});
  if(/gh[pousr]_[a-zA-Z0-9]{30,}|sb_secret_[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))secrets.push(path);
}
if(forbidden.length||secrets.length){console.error("追跡禁止ファイルまたは秘密情報の疑い:",...forbidden,...secrets);process.exit(1);}
console.log(`${paths.length} tracked files checked: private data and credential patterns excluded. 画像・氏名は別途レビューが必要です。`);
