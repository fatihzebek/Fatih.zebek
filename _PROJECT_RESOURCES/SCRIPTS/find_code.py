import json
import os
import re

log_path = r'C:\Users\FatihZebek\.gemini\antigravity\brain\e8411c36-feca-4897-aba4-9a8bd2eb6695\.system_generated\logs\overview.txt'
with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'export const FaultFormPage' in str(data):
                step = data.get('step_index')
                print(f'Found match in step {step}')
                with open(f'step_{step}.json', 'w', encoding='utf-8') as out:
                    json.dump(data, out, indent=2)
        except json.JSONDecodeError:
            continue
