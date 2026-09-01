import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\033fa6fd-8bd3-4128-8e8a-f4914fc6cdcc\\.system_generated\\logs\\transcript_full.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

for await (const line of rl) {
  if (line.includes('save-permissions-btn') && line.includes('replace_file_content')) {
    const data = JSON.parse(line);
    console.log(`Step ${data.step_index}:`);
    for (const call of data.tool_calls) {
      if (call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
        const args = typeof call.Arguments === 'string' ? JSON.parse(call.Arguments) : call.Arguments || call.args;
        console.log("Target:", args.TargetContent || args.targetContent);
        console.log("Replacement:", args.ReplacementContent || args.replacementContent);
      }
    }
    console.log('===');
  }
}
