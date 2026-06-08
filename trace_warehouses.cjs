const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        let obj = JSON.parse(lines[i]);
        if (obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                let name = tc.name;
                let args = tc.args;
                if (typeof args === 'string') args = JSON.parse(args);
                
                let target = args.TargetFile || args.CommandLine || args.AbsolutePath;
                if (target && target.toLowerCase().includes('warehouses')) {
                    fs.appendFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\history_of_warehouses.txt', 'Step ' + obj.step_index + ' [' + name + ']: ' + (args.TargetFile ? 'TargetFile=' + args.TargetFile : (args.CommandLine ? 'CommandLine=' + args.CommandLine : 'AbsolutePath=' + args.AbsolutePath)) + '\n');
                }
            }
        }
    } catch(e) {}
}
