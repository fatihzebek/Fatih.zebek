const fs = require('fs');
const views = JSON.parse(fs.readFileSync('view_map.json', 'utf8'));
const logPath = 'C:\\\\Users\\\\FatihZebek\\\\.gemini\\\\antigravity\\\\brain\\\\f0d8f1ef-a8e1-4af6-af2f-9b59b17d1628\\\\.system_generated\\\\logs\\\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let fileLines = {};

for (let v of views) {
    let stepLine = lines.find(l => l.includes(`"step_index":${v.step},`));
    if (stepLine) {
        try {
            let obj = JSON.parse(stepLine);
            if (obj.content) {
                let outLines = obj.content.split('\n');
                for (let outLine of outLines) {
                    let match = outLine.match(/^(\d+):\s(.*)$/);
                    if (match) {
                        let num = parseInt(match[1]);
                        fileLines[num] = match[2].replace(/\r$/, '');
                    }
                }
            }
        } catch(e) {}
    }
}

let maxLine = Math.max(...Object.keys(fileLines).map(Number));
let reconstructed = '';
for (let i = 1; i <= maxLine; i++) {
    if (fileLines[i] !== undefined) reconstructed += fileLines[i] + '\n';
    else reconstructed += '// MISSING LINE ' + i + '\n';
}

fs.writeFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\partial_logic.ts', reconstructed);
console.log('Recovered up to line', maxLine);
