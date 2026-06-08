const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        let obj = JSON.parse(lines[i]);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.function && tc.function.name === 'run_command') {
                    let args = JSON.parse(tc.function.arguments);
                    if (args.CommandLine && args.CommandLine.toLowerCase().includes('warehouses.ts')) {
                        fs.appendFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\run_calls_ci.txt', 'Step ' + obj.step_index + ':\n' + args.CommandLine + '\n\n');
                    }
                }
            }
        }
    } catch(e) {}
}
