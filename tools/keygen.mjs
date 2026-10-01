// Vendor-only license key generator. Usage: node tools/keygen.mjs <MACHINE_ID>
function hash(s){let h1=0xdeadbeef^s.length,h2=0x41c6ce57^s.length;for(let i=0;i<s.length;i++){const ch=s.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0).toString(16)+(h1>>>0).toString(16);}
const mid=(process.argv[2]||"").trim().toUpperCase();
if(!mid){console.error("Usage: node tools/keygen.mjs <MACHINE_ID>");process.exit(1);}
console.log(hash("CWP-OFFLINE-2026"+mid).toUpperCase().padEnd(16,"0").slice(0,16).match(/.{4}/g).join("-"));
