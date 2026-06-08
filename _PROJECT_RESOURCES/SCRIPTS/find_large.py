import json
import os

log_path = r'C:\Users\FatihZebek\.gemini\antigravity\brain\e8411c36-feca-4897-aba4-9a8bd2eb6695\.system_generated\logs\overview.txt'
with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'TOOL_RESPONSE':
                content = data.get('content', '')
                if isinstance(content, str) and len(content) > 10000:
                    step = data.get('step_index')
                    print(f'Large TOOL_RESPONSE in step {step}, size: {len(content)}')
                    with open(f'large_step_{step}.json', 'w', encoding='utf-8') as out:
                        json.dump(data, out, indent=2)
        except:
            continue
