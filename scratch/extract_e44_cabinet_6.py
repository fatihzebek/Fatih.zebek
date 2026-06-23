import pandas as pd
import json
import re

sap_list = [
    "37247", "32484", "32932", "33338", "19653", "11000025", "60584", "11000035",
    "7080", "56701", "3489", "64064", "77188", "46872", "44786", "44787",
    "34658", "34659", "34660", "34661", "59827", "44789", "44790", "59826",
    "33973", "60198", "60197", "34776", "50081", "60186", "33632", "43365",
    "62227", "68893", "77186", "91419", "49216", "49218", "49217", "49215", "32145"
]

df = pd.read_excel('sapno.xlsx')
df['SAP-Nr.'] = df['SAP-Nr.'].astype(str).str.strip()
df_indexed = df.set_index('SAP-Nr.')

parts = []

def clean_str(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    val_str = val_str.replace('\ufffd', '')
    return val_str

for sap in sap_list:
    sap_str = str(sap).strip()
    name = ""
    desc = ""
    alternativeSap = None
    
    if sap_str in df_indexed.index:
        row = df_indexed.loc[sap_str]
        if isinstance(row, pd.DataFrame):
            row = row.iloc[0]
        
        raw_desc = clean_str(row['SAP - Bezeichnung/Description'])
        service_desc = clean_str(row['Service -bezeichnung/description'])
        
        if "alternative" in raw_desc.lower() or "replaced by" in raw_desc.lower():
            m = re.search(r'(?:alternative|replaced by|change to)(?:\s+SAP)?\s*(\d+)', raw_desc, re.IGNORECASE)
            if m:
                alternativeSap = m.group(1)
                
        name = raw_desc
        desc = service_desc if service_desc else "SAP Part details from drawing"
    else:
        name = f"SAP Part {sap_str}"
        desc = "Part details from drawing"
        
    part_dict = {
        "sapNo": sap_str,
        "name": name,
        "desc": desc
    }
    if alternativeSap:
        part_dict["alternativeSap"] = alternativeSap
    parts.append(part_dict)

ts_lines = []
ts_lines.append("        parts: [")
for p in parts:
    sap = p["sapNo"]
    name = p["name"].replace('"', '\\"')
    desc = p["desc"].replace('"', '\\"')
    alt_str = ""
    if "alternativeSap" in p:
        alt_str = f', alternativeSap: "{p["alternativeSap"]}"'
    ts_lines.append(f'          {{ sapNo: "{sap}", name: "{name}", desc: "{desc}"{alt_str} }},')
ts_lines.append("        ]")

with open('scratch/e44_cabinet_6_ts.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(ts_lines))

print("TS code generated! Total parts:", len(parts))
