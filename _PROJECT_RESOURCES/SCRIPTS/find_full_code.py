import json
import os

log_path = r'C:\Users\FatihZebek\.gemini\antigravity\brain\e8411c36-feca-4897-aba4-9a8bd2eb6695\.system_generated\logs\overview.txt'
last_view_file_step = None

with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Check for view_file tool call for FaultForm.ts
            if data.get('type') == 'TOOL_CALL':
                for call in data.get('tool_calls', []):
                    if call.get('name') == 'view_file':
                        args = call.get('args', {})
                        if 'FaultForm.ts' in str(args.get('AbsolutePath')):
                            last_view_file_step = data.get('step_index')
            
            # If we see the response for that step, save it
            if last_view_file_step is not None and data.get('type') == 'TOOL_RESPONSE' and data.get('step_index') == last_view_file_step + 1:
                print(f'Found view_file response in step {data.get("step_index")}')
                with open(f'full_code_step_{data.get("step_index")}.json', 'w', encoding='utf-8') as out:
                    json.dump(data, out, indent=2)
                # Keep looking for even more recent ones
        except json.JSONDecodeError:
            continue
