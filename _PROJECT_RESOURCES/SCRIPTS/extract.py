import re
import os

def extract_code():
    log_path = r"C:\Users\FatihZebek\.gemini\antigravity\brain\8f4b90d3-f567-47c5-9b71-be294a8ec108\.system_generated\logs\overview.txt"
    if not os.path.exists(log_path):
        print("Log file not found.")
        return
        
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print("Error reading log:", e)
        return
        
    # Search for "Showing lines 1 to 541"
    best_start = -1
    for i in range(len(lines)):
        if "Showing lines 1 to" in lines[i]:
            # This is the start of a view_file output.
            # Skip the next few lines until we see "1: "
            for j in range(i+1, min(i+10, len(lines))):
                if re.match(r"^1: ", lines[j]):
                    best_start = j
                    break
            if best_start != -1:
                break
                
    if best_start != -1:
        extracted = []
        for line in lines[best_start:]:
            match = re.match(r"^(\d+): (.*)", line)
            if match:
                extracted.append(match.group(2))
            else:
                if "The above content does NOT show the entire file contents" in line or "Exit code" in line or "The above content shows the entire" in line or line.strip() == "":
                    break
                
        if len(extracted) > 100:
            with open(r"C:\Users\FatihZebek\Desktop\Dh_Servis\src\pages\FaultForm.ts", 'w', encoding='utf-8') as out:
                out.write("\n".join(extracted))
            print(f"Success! Extracted {len(extracted)} lines.")
        else:
            print(f"Found marker, but only matched {len(extracted)} lines.")
    else:
        print("Could not find the start marker.")

extract_code()
