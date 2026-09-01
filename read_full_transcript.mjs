import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\033fa6fd-8bd3-4128-8e8a-f4914fc6cdcc\\.system_generated\\logs\\transcript_full.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

for await (const line of rl) {
  const data = JSON.parse(line);
  if (data.step_index === 6781 || data.step_index === 6780 || data.step_index === 6782) {
    if (data.tool_calls) {
      for (const call of data.tool_calls) {
        if (call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
          const args = typeof call.Arguments === 'string' ? JSON.parse(call.Arguments) : call.Arguments || call.args;
          const targetFile = args?.TargetFile || args?.targetFile;
          if (targetFile && targetFile.includes('UserManagement.ts')) {
            let content = args.ReplacementContent || args.replacementContent;
            if (content.startsWith('"') && content.endsWith('"')) {
              content = content.slice(1, -1);
            }
            content = content.replace(/\\n/g, '\n')
                             .replace(/\\t/g, '\t')
                             .replace(/\\"/g, '"')
                             .replace(/\\\\/g, '\\');
            fs.writeFileSync('apply_default_fn_clean.ts', content, 'utf8');
            console.log('Successfully wrote FULL apply_default_fn_clean.ts');
            process.exit(0);
          }
        }
      }
    }
  }
}

console.log('Step 6781 not found in transcript_full.jsonl');
