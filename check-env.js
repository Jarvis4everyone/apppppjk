import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔍 Checking for .env file...\n');
console.log('Current directory:', __dirname);
console.log('');

const envPaths = [
  { path: join(__dirname, '.env'), name: 'backend/.env' },
  { path: join(__dirname, '..', '.env'), name: 'root/.env' },
  { path: '.env', name: 'current working directory/.env' },
];

let found = false;
for (const { path, name } of envPaths) {
  if (existsSync(path)) {
    console.log(`✅ Found: ${name}`);
    console.log(`   Full path: ${path}`);
    found = true;
  } else {
    console.log(`❌ Not found: ${name}`);
  }
}

if (!found) {
  console.log('\n⚠️  No .env file found!');
  console.log('\nTo fix this:');
  console.log('1. Copy env.example to .env:');
  console.log('   cp env.example .env');
  console.log('   (or on Windows: copy env.example .env)');
  console.log('\n2. Edit .env and add your database credentials');
  console.log('\n3. Run the test again: npm run test:connections');
} else {
  console.log('\n✅ .env file found! You can proceed with testing connections.');
}

console.log('');

