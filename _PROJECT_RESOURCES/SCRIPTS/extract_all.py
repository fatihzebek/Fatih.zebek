import re
import os
import json

log_dirs = [
    r"C:\Users\FatihZebek\.gemini\antigravity\brain\8f4b90d3-f567-47c5-9b71-be294a8ec108",
    r"C:\Users\FatihZebek\.gemini\antigravity\brain\e8411c36-feca-4897-aba4-9a8bd2eb6695"
]

def extract_from_log(log_dir):
    log_path = os.path.join(log_dir, ".system_generated", "logs", "overview.txt")
    if not os.path.exists(log_path):
        return
        
    print(f"Checking {log_path}...")
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        
    for i in range(len(lines)):
        if "Showing lines 1 to" in lines[i] or "Total Lines:" in lines[i]:
            # Possible code block
            best_start = -1
            for j in range(i+1, min(i+20, len(lines))):
                if re.match(r"^\d+: ", lines[j]):
                    best_start = j
                    break
            
            if best_start != -1:
                extracted = []
                for line in lines[best_start:]:
                    match = re.match(r"^(\d+): (.*)", line)
                    if match:
                        extracted.append(match.group(2))
                    else:
                        break
                
                if len(extracted) > 400:
                    basename = os.path.basename(log_dir)
                    out_path = f"FaultForm_extracted_{basename}_{i}.ts"
                    with open(out_path, 'w', encoding='utf-8') as out:
                        out.write("\n".join(extracted))
                    print(f"  Saved {out_path} ({len(extracted)} lines)")

for log_dir in log_dirs:
    extract_from_log(log_dir)
