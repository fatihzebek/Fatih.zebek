const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < 500; i++) {
    if (!lines[i] || !lines[i].trim()) continue;
    try {
        let obj = JSON.parse(lines[i]);
        if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('Warehouses.ts')) {
            fs.writeFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\initial_view.txt', obj.content);
            console.log('Found initial view at step', obj.step_index);
            return;
        }
    } catch(e) {}
}
console.log('Not found in first 500 steps.');
