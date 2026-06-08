const fs = require('fs');
const lines = fs.readFileSync('C:/Users/FatihZebek/.gemini/antigravity/brain/f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
const results = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('premium-card modal-content')) {
        try {
            const obj = JSON.parse(line);
            results.push({step: obj.step_index, type: obj.type, name: obj.tool_calls?.[0]?.name});
        } catch(e) {}
    }
}
fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/matched_lines.json', JSON.stringify(results, null, 2));
console.log('Done.');
