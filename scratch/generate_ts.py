import json

with open('scratch/rotor_parts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

system_metadata = {
    "e92_rot_blade_heating": {"name": "Blade Heating (Kanat Isıtma)", "imageName": "3 blade heating.PNG"},
    "e92_rot_pitch_box": {"name": "Pitch Box (Pitch Kontrol Kutusu)", "imageName": "8 pitch box.PNG"},
    "e92_rot_relay_box": {"name": "Relay Box (Röle Kutusu)", "imageName": "9 relay box.PNG"},
    "e92_rot_pitch_gear": {"name": "Pitch Gear (Hatve Dişlisi)", "imageName": "10 pitch gear.PNG"},
    "e92_rot_pitch_motor": {"name": "Pitch Motor (Hatve Motoru)", "imageName": "11 pitch motor.PNG"},
    "e92_rot_limit_switch": {"name": "Limit Switch (Emniyet Sınır Anahtarı)", "imageName": "13 compact limit switch.PNG"},
    "e92_rot_capacitor_box": {"name": "Capacitor Box (Kapasitör Grubu)", "imageName": "14 capacitor box.PNG"},
    "e92_rot_blade": {"name": "Rotor Blade (Rüzgar Kanadı)", "imageName": "17 rotor blade.PNG"},
    "e92_rot_slip_ring": {"name": "Slip Ring (Kolektör / Kontak Bileziği)", "imageName": "22 slip ring.PNG"},
    "e92_rot_lubrication": {"name": "Central Lubrication (Merkezi Yağlama)", "imageName": "23 central lubrication.PNG"}
}

ts_lines = []
ts_lines.append("    rotor: [")

for sys_id, parts in data.items():
    meta = system_metadata[sys_id]
    ts_lines.append("      {")
    ts_lines.append(f'        id: "{sys_id}",')
    ts_lines.append(f'        name: "{meta["name"]}",')
    ts_lines.append(f'        imageName: "{meta["imageName"]}",')
    ts_lines.append("        parts: [")
    for part in parts:
        sap = part["sapNo"]
        # Escape double quotes in name and description
        name = part["name"].replace('"', '\\"')
        desc = part["desc"].replace('"', '\\"')
        alt_str = ""
        if "alternativeSap" in part:
            alt_str = f', alternativeSap: "{part["alternativeSap"]}"'
        ts_lines.append(f'          {{ sapNo: "{sap}", name: "{name}", desc: "{desc}"{alt_str} }},')
    ts_lines.append("        ]")
    ts_lines.append("      },")

ts_lines.append("    ],")

with open('scratch/rotor_parts_ts.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(ts_lines))

print("TS code generated!")
