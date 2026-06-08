const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"step_index":14727,')) {
        let obj = JSON.parse(lines[i]);
        console.log(JSON.stringify(obj.tool_calls, null, 2));
        break;
    }
}
