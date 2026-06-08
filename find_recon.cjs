const fs = require('fs');

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;
    
    if (line.includes('reconstructed_Warehouses.ts')) {
        try {
            let obj = JSON.parse(line);
            fs.appendFileSync('C:\\Users\\FatihZebek\\Desktop\\Dh_Servis\\found_recon.txt', JSON.stringify(obj, null, 2) + '\n\n---\n\n');
        } catch(e) {}
    }
}
