import glob, re, os
logs = glob.glob(r'C:\Users\FatihZebek\.gemini\antigravity\brain\*\.system_generated\logs\overview.txt')

for log in logs:
    with open(log, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    
    # regex for getting the file out of the log:
    # Look for "File Path: ile:///C:/Users/FatihZebek/Desktop/Dh_Servis/src/pages/FaultForm.ts"
    # followed by lines 1 to N
    matches = re.finditer(r'File Path: .*?FaultForm\.ts.*?(1: import .*?)(?=\n\n|\Z|Exit code|The above content)', text, re.DOTALL)
    for m in matches:
        code = m.group(1)
        # clean line numbers
        lines = []
        for line in code.split('\n'):
            mx = re.match(r'^\d+: (.*)', line)
            if mx:
                lines.append(mx.group(1))
        
        if len(lines) > 500:
            print(f'Found {len(lines)} lines in {log}')
            with open(f'FaultForm_extracted_{os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(log))))}.ts', 'w', encoding='utf-8') as out:
                out.write('\n'.join(lines))
