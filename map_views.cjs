const fs = require('fs');
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let views = [];

for (let i = 0; i < 2000; i++) {
    if (!lines[i] || !lines[i].trim()) continue;
    try {
        let obj = JSON.parse(lines[i]);
        if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('Warehouses.ts')) {
            let match = obj.content.match(/Showing lines (\d+) to (\d+)/);
            if (match) {
                let start = parseInt(match[1]);
                let end = parseInt(match[2]);
                views.push({ step: obj.step_index, start: start, end: end, content: obj.content });
            }
        }
    } catch(e) {}
}

views.sort((a, b) => a.start - b.start);
fs.writeFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\view_map.json', JSON.stringify(views.map(v => ({step: v.step, start: v.start, end: v.end})), null, 2));
