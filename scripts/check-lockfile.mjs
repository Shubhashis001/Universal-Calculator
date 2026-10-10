import{readFileSync}from'node:fs';
const p=JSON.parse(readFileSync('package.json')),l=JSON.parse(readFileSync('package-lock.json'));
if(l.lockfileVersion<3)throw Error('Require npm lockfile v3');
if(l.name!==p.name)throw Error('Root package name mismatch');
for(const section of ['dependencies','devDependencies'])for(const [name,version]of Object.entries(p[section]??{})){
 if(!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version))throw Error(`${name} must use exact pinned version`);
 if(l.packages?.['']?.[section]?.[name]!==version)throw Error(`Lockfile differs: ${name}`);
}
console.log('Pinned dependencies match npm lockfile root. Run npm ci on a machine with registry access to verify complete lockfile install.');
