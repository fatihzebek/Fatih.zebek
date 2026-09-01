import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\033fa6fd-8bd3-4128-8e8a-f4914fc6cdcc\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let idx = 0;
for await (const line of rl) {
  if (line.includes('UserManagement.ts') && (line.includes('replace_file_content') || line.includes('CODE_ACTION'))) {
    console.log(`Step ${idx}:`, line.substring(0, 300));
  }
  idx++;
}
