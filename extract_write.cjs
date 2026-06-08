const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let foundCodes = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    try {
        let obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.function && tc.function.name === 'write_to_file') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.TargetFile && args.TargetFile.endsWith('Warehouses.ts')) {
                        if (args.CodeContent) {
                            foundCodes.push({ step: obj.step_index, len: args.CodeContent.length, text: args.CodeContent });
                        }
                    }
                }
            }
        }
    } catch(e) {}
}

console.log('Found', foundCodes.length, 'write_to_file on Warehouses.ts.');
if (foundCodes.length > 0) {
    foundCodes.sort((a, b) => b.len - a.len);
    fs.writeFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\recovered_code.ts', foundCodes[0].text);
    console.log('Largest CodeContent length:', foundCodes[0].len, 'at step', foundCodes[0].step);
}
