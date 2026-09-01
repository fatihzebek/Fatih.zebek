import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\b47fbc9b-4d48-4448-94d1-deaab79c7c12\\.system_generated\\logs\\transcript.jsonl';

async function search() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    if (line.toLowerCase().includes("alarm") || line.toLowerCase().includes("ikaz") || line.toLowerCase().includes("renk") || line.toLowerCase().includes("turuncu")) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'USER_INPUT') {
          console.log(`Step ${obj.step_index || index} USER:`, obj.content);
        } else if (obj.type === 'PLANNER_RESPONSE' && obj.content) {
          console.log(`Step ${obj.step_index || index} AGENT:`, obj.content.substring(0, 150) + "...");
        }
      } catch (e) {
        // Ignored
      }
    }
  }
}

search().catch(console.error);
