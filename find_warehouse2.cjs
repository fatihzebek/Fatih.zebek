const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    if (line.includes('export function WarehousePage') && line.includes('"type":"TOOL_RESPONSE"')) {
        try {
            let obj = JSON.parse(line);
            if (obj.content && obj.content.length > 10000) {
                fs.writeFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\found_warehouse.ts', obj.content);
                console.log('Found WarehousePage code at step', obj.step_index);
                return;
            }
        } catch(e) {}
    }
}
