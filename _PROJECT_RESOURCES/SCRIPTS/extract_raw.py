import re
import os

log_dirs = [
    r"C:\Users\FatihZebek\.gemini\antigravity\brain\8f4b90d3-f567-47c5-9b71-be294a8ec108",
    r"C:\Users\FatihZebek\.gemini\antigravity\brain\e8411c36-feca-4897-aba4-9a8bd2eb6695",
    r"C:\Users\FatihZebek\.gemini\antigravity\brain\53a48fb3-5ded-4587-9817-9096cf58957c"
]

def extract_from_log(log_dir):
    log_path = os.path.join(log_dir, ".system_generated", "logs", "overview.txt")
    if not os.path.exists(log_path):
        return
        
    print(f"Checking {log_path}...")
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    
    # Use regex to find all sequences of line numbers starting from 1
    # We look for '1: ' but we need to handle potential escaping in JSON
    # Try finding escaped newlines too
    
    # Replace escaped newlines with actual newlines to simplify
    processed_text = text.replace('\\n', '\n')
    
    matches = re.finditer(r'^1: .*?$', processed_text, re.MULTILINE)
    for m in matches:
        start_pos = m.start()
        extracted = []
        # Look forward from here
        current_lines = processed_text[start_pos:].split('\n')
        for i, line in enumerate(current_lines):
            match = re.match(r'^(\d+): (.*)', line)
            if match:
                extracted.append(match.group(2))
            else:
                break
        
        if len(extracted) > 400:
            basename = os.path.basename(log_dir)
            out_path = f"FaultForm_raw_{basename}_{start_pos}.ts"
            with open(out_path, 'w', encoding='utf-8') as out:
                out.write('\n'.join(extracted))
            print(f"  Saved {out_path} ({len(extracted)} lines)")

for log_dir in log_dirs:
    extract_from_log(log_dir)
