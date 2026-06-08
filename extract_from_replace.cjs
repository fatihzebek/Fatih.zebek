const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    try {
        let obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.function && tc.function.name === 'multi_replace_file_content') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.TargetFile && args.TargetFile.endsWith('Warehouses.ts')) {
                        console.log('Found multi_replace on Warehouses.ts at step', obj.step_index);
                        for (let chunk of args.ReplacementChunks) {
                            if (chunk.TargetContent) {
                                fs.appendFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\recovered_from_replace.txt', chunk.TargetContent + '\n\n---\n\n');
                            }
                        }
                    }
                }
                if (tc.function && tc.function.name === 'replace_file_content') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.TargetFile && args.TargetFile.endsWith('Warehouses.ts')) {
                        console.log('Found replace on Warehouses.ts at step', obj.step_index);
                        if (args.TargetContent) {
                            fs.appendFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\recovered_from_replace.txt', args.TargetContent + '\n\n---\n\n');
                        }
                    }
                }
            }
        }
    } catch(e) {
        // ignore
    }
}
