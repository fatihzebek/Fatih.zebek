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
                if (tc.function && tc.function.name === 'run_command') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.CommandLine && args.CommandLine.includes('Warehouses.ts')) {
                        console.log('Found run_command touching Warehouses.ts at step', obj.step_index, 'Command:', args.CommandLine);
                    }
                }
            }
        }
    } catch(e) {}
}
