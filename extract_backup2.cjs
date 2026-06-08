const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    try {
        let obj = JSON.parse(line);
        if (obj.type === 'TOOL_RESPONSE' && obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.function && tc.function.name === 'view_file') {
                    // Check if it's the response for Warehouses.ts
                    // But wait, the response content is in obj.content or tc.response?
                }
            }
        }
        
        // Actually, TOOL_RESPONSE has the output directly in obj.content
        if (obj.type === 'TOOL_RESPONSE' && obj.content && obj.content.includes('export function WarehousePage') && obj.content.includes('padding: 10px 15px;')) {
            // Check if it has // MISSING LINE
            if (!obj.content.includes('MISSING LINE')) {
                fs.writeFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\Warehouses_backup.ts', obj.content);
                console.log('Found complete Warehouses.ts in TOOL_RESPONSE at step', obj.step_index);
                return;
            }
        }
    } catch(e) {
        // ignore JSON parse errors
    }
}
console.log('Could not find complete Warehouses.ts in transcript TOOL_RESPONSE.');
