const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let foundTargets = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    try {
        let obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.function && tc.function.name === 'multi_replace_file_content') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.TargetFile && args.TargetFile.endsWith('Warehouses.ts')) {
                        for (let chunk of args.ReplacementChunks) {
                            if (chunk.TargetContent) {
                                foundTargets.push({ step: obj.step_index, len: chunk.TargetContent.length, text: chunk.TargetContent });
                            }
                        }
                    }
                }
            }
        }
    } catch(e) {}
}

console.log('Found', foundTargets.length, 'targets.');
if (foundTargets.length > 0) {
    foundTargets.sort((a, b) => b.len - a.len);
    fs.writeFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\largest_target.ts', foundTargets[0].text);
    console.log('Largest target length:', foundTargets[0].len, 'at step', foundTargets[0].step);
}
