import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\033fa6fd-8bd3-4128-8e8a-f4914fc6cdcc\\.system_generated\\logs\\transcript_full.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

for await (const line of rl) {
  if (line.includes('updatePersonnelDetails') && (line.includes('replace_file_content') || line.includes('multi_replace_file_content') || line.includes('write_to_file') || line.includes('CODE_ACTION'))) {
    console.log(line.substring(0, 1500));
    console.log('===');
  }
}
console.log('Done');
