const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        let obj = JSON.parse(lines[i]);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file') {
                    let args = tc.args;
                    if (typeof args === 'string') args = JSON.parse(args);
                    if (args.TargetFile && args.TargetFile.includes('Warehouses.ts')) {
                        fs.appendFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\all_edits.txt', 'Step ' + obj.step_index + ' tool ' + tc.name + ':\n' + JSON.stringify(args, null, 2) + '\n\n');
                    }
                }
            }
        }
    } catch(e) {}
}
