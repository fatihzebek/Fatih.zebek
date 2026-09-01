import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\033fa6fd-8bd3-4128-8e8a-f4914fc6cdcc\\.system_generated\\logs\\transcript_full.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

for await (const line of rl) {
  if (line.includes('Teams.ts') && line.includes('write_to_file')) {
    console.log(line.substring(0, 1000));
    console.log('===');
  }
}
console.log('Done searching Teams.ts write history');
