import pandas as pd
import json
import re

systems = {
    "e92_rot_blade_heating": [162468, 162470, 162471, 162473, 161270, 161274, 641545, 641546, 550742, 146531, 144208, 699212, 626335, 162265, 162264, 698955],
    "e92_rot_pitch_box": [57708, 57707, 7184, 800, 802, 778, 3442, 42731, 720, 52130, 22035, 61932, 98068, 524796, 4181, 55260, 7076, 8184, 553098, 674129, 57566, 63310, 69390, 71576, 511910, 58841, 529523, 791021, 29591, 21845, 586224, 58262, 21172, 58067, 506427, 593057, 57729, 976, 68002],
    "e92_rot_relay_box": [55788, 57706, 794, 793, 46671, 55945, 4181, 201973, 18034, 53596, 547481, 53595, 549170, 53601, 53602, 53600, 53569, 55224, 53571, 57177, 53586, 539928, 542740, 53589, 7592, 1712, 68943, 23972, 23974, 57661, 57662],
    "e92_rot_pitch_gear": [138594, 544930, 183448, 544926, 54501, 546205, 790524, 790522, 160295, 211175, 95628, 66642, 117006, 138595, 95630, 103255, 54503],
    "e92_rot_pitch_motor": [141094, 64597, 140466, 138649, 136217, 192919, 65633, 141461, 137235],
    "e92_rot_limit_switch": [12097, 792, 6570, 45019, 13164, 608, 8228, 57413, 57479, 8227, 8230, 79116, 57439, 79002],
    "e92_rot_capacitor_box": [84963, 8971, 8788, 81522, 7183, 27427, 3442, 53636, 4181, 58209, 566128, 514484, 549123, 58416, 976, 514482, 549124, 656827],
    "e92_rot_blade": [118148, 184386, 122585, 142688, 133204, 132887, 142678, 138672, 138673, 138674, 138675, 138676, 138677, 46433, 126943, 161, 613827, 613829, 613839, 118147, 578481, 528203, 179442, 121689, 185060, 584717, 57506],
    "e92_rot_slip_ring": [519799, 555278, 532589, 518349, 530284, 570307, 517612, 544011, 554846, 554042, 544148, 544010, 631753, 556666, 519312, 555273, 518480],
    "e92_rot_lubrication": [109994, 88752, 119122, 108537, 108538, 108540, 108541, 108945, 692873, 156216, 105004, 109135, 18294, 99638, 90945, 90946, 90947, 99066, 99586, 164730, 109134, 114289, 93151, 93153, 93152, 106902, 92244]
}

# Load the excel
df = pd.read_excel('sapno.xlsx')

# Clean sap numbers to string and remove spaces
df['SAP-Nr.'] = df['SAP-Nr.'].astype(str).str.strip()

# Set index for fast lookup
df_indexed = df.set_index('SAP-Nr.')

result = {}

def clean_str(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    # Clean up weird trailing character  or bad encodings
    val_str = val_str.replace('\ufffd', '')
    return val_str

for sys_id, sap_list in systems.items():
    result[sys_id] = []
    for sap in sap_list:
        sap_str = str(sap).strip()
        name = ""
        desc = ""
        alternativeSap = None
        
        if sap_str in df_indexed.index:
            row = df_indexed.loc[sap_str]
            # Handle multiple matching rows (if any)
            if isinstance(row, pd.DataFrame):
                row = row.iloc[0]
            
            raw_desc = clean_str(row['SAP - Bezeichnung/Description'])
            service_desc = clean_str(row['Service -bezeichnung/description'])
            
            # Simple clean up: if description has commas or parentheses, try to split nicely into name and desc
            if "alternative" in raw_desc.lower() or "replaced by" in raw_desc.lower():
                # Extract alternative SAP if present
                m = re.search(r'(?:alternative|replaced by|change to)(?:\s+SAP)?\s*(\d+)', raw_desc, re.IGNORECASE)
                if m:
                    alternativeSap = m.group(1)
            
            name = raw_desc
            desc = service_desc if service_desc else "SAP Part details from drawing"
            
        else:
            # Fallback if not in excel (e.g. from general dictionary)
            name = f"SAP Part {sap_str}"
            desc = "Part details from drawing"
            
        part_dict = {
            "sapNo": sap_str,
            "name": name,
            "desc": desc
        }
        if alternativeSap:
            part_dict["alternativeSap"] = alternativeSap
            
        result[sys_id].append(part_dict)

with open('scratch/rotor_parts.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print("Done! Extracted details.")
