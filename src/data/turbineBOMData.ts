export interface BOMPart {
  sapNo: string;
  name: string;
  desc: string;
  alternativeSap?: string;
}

export interface TurbineSystem {
  id: string;
  name: string;
  imageName: string;
  parts?: BOMPart[];
}

export interface TurbineModelData {
  nacelle: TurbineSystem[];
  rotor: TurbineSystem[];
  tower: TurbineSystem[];
}

export const turbineBOMData: Record<string, TurbineModelData> = {
  "E92": {
    nacelle: [
      {
        id: "e92_nac_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e92_nac_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e92_nac_anemometer",
        name: "Anemometer & Wind Sensors",
        imageName: "3 anemometer.PNG",
        parts: [
          { sapNo: "12610", name: "Bush for Anemometer 4008003-4", desc: "adaptor tube insideØ 42mm outsideØ 50mm" },
          { sapNo: "92750", name: "Bracket Anemometer Support 8207174-1", desc: "bracket anemometer support" },
          { sapNo: "71177", name: "Clamp Compl. 0007008-1", desc: "part of new support used since Nov. 2006" },
          { sapNo: "4134", name: "Joint Hinge-Hose Clamp 70x25, A2", desc: "joint hinge-hose clamp" },
          { sapNo: "92838", name: "Stud Left Windmessuring Arch 8207181-0", desc: "stud left windmessuring arch" },
          { sapNo: "92836", name: "Stud Right Windmessuring Arch 8207177-0", desc: "stud right windmessuring arch" },
          { sapNo: "4795", name: "Bush f. Anemometer 4008004-3", desc: "bush f. anemometer" },
          { sapNo: "59781", name: "Adapter Cable for Ultrasonic 2D THIES", desc: "for change: anemometer wind speed (SAP 1760 wind sensor combined)" },
          { sapNo: "62597", name: "Anemometer Ultrasonic 2D 4.3820.30.340", desc: "other number Nr.: 4.3820.30.340 are the same SAP number" },
          { sapNo: "59492", name: "Coupler Plug Jack 08p. with Cable Clamp", desc: "coupler plug jack" },
          { sapNo: "55576", name: "Coupler Plug Jack f. Wind Sensor 12pole", desc: "coupler plug jack" },
          { sapNo: "54554", name: "Cable LIYCY 12x0,34mm² Shielded", desc: "cable LIYCY 12x0,34mm² shielded" },
        ]
      },
      {
        id: "e92_nac_yaw_gear",
        name: "Yaw Gear (Azimuth Dişli Kutusu)",
        imageName: "4 yaw gear.PNG",
        parts: [
          { sapNo: "111996", name: "Yaw Drive ABM® E82/E2 MK82004-0", desc: "yaw drive ABM" },
          { sapNo: "158264", name: "Rotary Shaft Seal 45x60x7 AS NBR", desc: "rotary shaft seal" },
          { sapNo: "211174", name: "Yaw Gear Brevini® CC E82 E2 MK82004-0", desc: "yaw gear Brevini" },
          { sapNo: "116986", name: "Yaw Gear Liebherr E82/E2 CC MK82004-0", desc: "Liebherr type: DAT 400 / 1496 or 1439 or 1442 ; Spez.Nr.: MK82004-0" },
          { sapNo: "88510", name: "Shaft Seal Ring DIN3760 045x065x10 si.A", desc: "for yaw gear DAT 300/493 with article code 96 91 94 501" },
          { sapNo: "101400", name: "Yaw Drive Liebherr® E82/E2 MK82004-0", desc: "Liebherr type: DAT 400 / 1439 or 1442 ; Spez.Nr.: MK82004-0" },
          { sapNo: "16505", name: "O-Ring 250,00x3,00", desc: "o-ring" },
          { sapNo: "87342", name: "Oil-Level Gauge M26x1,5 SW32", desc: "oil-level gauge" },
          { sapNo: "207480", name: "Yaw Drive Nabtesco® E82 E2 MK82004-0", desc: "yaw drive Nabtesco" },
          { sapNo: "101401", name: "Yaw Drive Zollern® E82/E2 MK82004-0", desc: "Zollern Typ: ZHP 3.25 ; i = 1235 ; Spez.Nr.: MK82004-0" },
          { sapNo: "123612", name: "Vent Screw Yaw Gearbox Zollern E66", desc: "vent screw for yaw gear Zollern ZHP 3.25" },
          { sapNo: "45122", name: "Rotary Shaft Seal 65x90x10 BA/FPM", desc: "for input shaft" },
          { sapNo: "97603", name: "Oil-Level Gauge f.ZOLLERN Gear ZHP3.25", desc: "oil-level gauge M35 x 1,5 for the Zollern® yaw gear ZHP 3.25 E-66" },
        ]
      },
      {
        id: "e92_nac_yaw_motor",
        name: "Yaw Motor (Azimuth Motor)",
        imageName: "5 yaw motor.PNG",
        parts: [
          { sapNo: "136212", name: "Yaw Motor Emod (m.WE)", desc: "Emod type: 112M/6 BRE40 RG WUX rating = 2.2KW, speed = 890 U/min" },
          { sapNo: "136213", name: "Yaw Motor Emod (o.WE)", desc: "Emod type: 112M/6 BRE40 RG WUX rating = 2.2KW, speed = 890 U/min" },
          { sapNo: "543644", name: "Brake 45Nm Emod", desc: "Brake 45Nm FDB 15.469-001 2.2KW Emod" },
          { sapNo: "148730", name: "Attachment Connector", desc: "Connector material for yaw motor E-48 to E-82" },
          { sapNo: "103120", name: "Speed Pulsor Sensor", desc: "Pulsor 10-35VDC/2S KJ4-D70KN-DPS2-X0115", alternativeSap: "86842" },
          { sapNo: "86842", name: "Sensor Holder", desc: "Sensor holder 0008068-0", alternativeSap: "47170" },
          { sapNo: "47170", name: "Pulsor Fastener Azimuth", desc: "Pulsor fastener azimuth 4fold 0008034-4", alternativeSap: "86842" },
          { sapNo: "92290", name: "Stopper Square 30x30", desc: "Stopper square GPN260 30x30 1.5-2 black" },
          { sapNo: "136215", name: "Yaw Motor Ruckh (w.WE)", desc: "Ruckh type: TRB 112 M-6 rating = 2.2KW, speed = 890 1/min with PT100" },
          { sapNo: "136216", name: "Yaw Motor Ruckh (wo.WE)", desc: "Ruckh type: TRB 112 M-6 rating = 2.2KW, speed = 890 1/min with PT100" },
          { sapNo: "542632", name: "Brake 45Nm Intorq", desc: "Brake 45Nm Intorq BFK45812-001/205V" },
        ]
      },
      {
        id: "e92_nac_6_beacon",
        name: "Beacon (İkaz Lambası 6)",
        imageName: "6 beacon.PNG",
        parts: []
      },
      {
        id: "e92_nac_7_beaconn",
        name: "Beaconn (İkaz Lambası 7)",
        imageName: "7 beaconn.PNG",
        parts: []
      },
      {
        id: "e92_nac_8_beacon_v7_0",
        name: "Beacon V7.0 (İkaz Lambası 8)",
        imageName: "8 beacon v7.0.PNG",
        parts: []
      },
      {
        id: "e92_nac_9_chain_demag",
        name: "Chain Demag (Şema 9)",
        imageName: "9 chain demag.PNG",
        parts: []
      },
      {
        id: "e92_nac_10_chain_demagg",
        name: "Chain Demagg (Şema 10)",
        imageName: "10 chain demagg.PNG",
        parts: []
      },
      {
        id: "e92_nac_12_chain_planeta_and_star_lift",
        name: "Chain Planeta And Star Lift (Şema 12)",
        imageName: "12 chain planeta and star lift.PNG",
        parts: []
      },
      {
        id: "e92_nac_electric_brake",
        name: "Electric Brake Unit (Elektrikli Fren)",
        imageName: "13 electric brake.PNG",
        parts: [
          { sapNo: "144333", name: "Electr.mech. Brake EMB300RT MK101016-3", desc: "manufacturer: KTR Brake Systems. Not service replacement material!" },
          { sapNo: "158475", name: "Spring Pusher Brakepad Fix.Side EMB300RT", desc: "spring pusher brakepad" },
          { sapNo: "158476", name: "Spring Pusher Brakepad No Fix.s.EMB300RT", desc: "spring pusher brakepad" },
          { sapNo: "194374", name: "PCB Elec.mechanical Brake EMB 300RTD S+G", desc: "information: new relais with gold contacts for the main safety circuit!" },
          { sapNo: "212812", name: "PCB Elec.mechanical Brake EMB 300RTD V2", desc: "pcb elec.mechanical brake" },
          { sapNo: "190356", name: "Cover Cap Electr.mechan.brake EMB®300RTD", desc: "cover cap" },
          { sapNo: "118923", name: "Brake Pad Concave for EMB® 300RT E101", desc: "brake pad concave" },
          { sapNo: "118925", name: "Brake Pad Convex for EMB® 300RT E101", desc: "brake pad convex" },
          { sapNo: "139862", name: "Motor Electromech.brake EMB® 300 RTD", desc: "replacement motor for the electromechanical brake EMB 300 RTD" },
          { sapNo: "139143", name: "PCB Electro Mechanical Brake EMB 300RTD", desc: "alternative: SAP 194374 pcb elec.mechanical brake", alternativeSap: "194374" },
          { sapNo: "118524", name: "Drive Elect.mechan.brake HEAW300TE82E2", desc: "drive elect.mechan.brake" },
          { sapNo: "133141", name: "Brake Pad Convex HEAW300T E101", desc: "brake pad convex" },
          { sapNo: "133140", name: "Brake Pad Concave HEAW300T E101", desc: "brake pad concave" },
          { sapNo: "108676", name: "Brake Force Cutoff for HEAW 300T", desc: "Brake force sensor complete for the electromechanical brake HEAW 300T" },
          { sapNo: "144332", name: "Electr.mech. Brake HEAW300T MK101016-3", desc: "manufacturer: Hanning & Kahl. Not service replacement material!" },
          { sapNo: "52130", name: "Limit Switch LS-11S Plunger", desc: "standard end switch. LS-11S IP 66" },
          { sapNo: "137459", name: "Motor 2850 Electromech.brake HEAW 300T", desc: "replacement motor for the electromechanical brake E-82 E2/E3 (SAP 94145)" },
          { sapNo: "104949", name: "PCB Electro Mechanical Brake V2 HEAW300T", desc: "Printed circuit board for the electromechanical brake E-70/E-82" },
          { sapNo: "148608", name: "PCB Electro Mechanical Brake V3 HEAW300T", desc: "PCB (H&K no.26004411) for the electromechanical brake" },
          { sapNo: "106469", name: "Roller Tappet Central Mounting LS-XZRS", desc: "roller tappet central mounting" },
        ]
      },
      {
        id: "e92_nac_excitation",
        name: "Excitation System (Uyarım Sistemi)",
        imageName: "14 excitation.PNG",
        parts: [
          { sapNo: "36925", name: "Diode Module 162A/1200V SKKD162/12", desc: "diode module" },
          { sapNo: "50831", name: "Diode Module 600A/1600V SKKE600/16", desc: "alternative: SAP 16960 diode module EUPEC® DZ600N12K", alternativeSap: "16960" },
          { sapNo: "16960", name: "Diode Module EUPEC® DZ600N12K", desc: "diode module" },
          { sapNo: "551876", name: "Choke Three-ph. 0,23mH,3x400V,125A", desc: "replaced by: SAP 624784 choke three-ph. 0,23mH 3x400V DDR3400", alternativeSap: "624784" },
          { sapNo: "54919", name: "Choke Three-ph.wall Grid- 0,23mH NKD125", desc: "alternative: SAP 551876 choke three-ph. 0,23mH,3x400V,125A", alternativeSap: "551876" },
          { sapNo: "507531", name: "Choke Single-phase 1mH BLOCK B0912060", desc: "choke single-phase" },
          { sapNo: "107856", name: "Excitation CS101 V1.0 E101", desc: "excitation board" },
          { sapNo: "17851", name: "Fan Centrif-230V 50Hz 330W 950m³/h", desc: "replaced depending on grid (50Hz or 60Hz)" },
          { sapNo: "18723", name: "Insulator, Cast Resin 25/25/M06", desc: "insulator" },
          { sapNo: "29762", name: "Insulator, Cast Resin 35/30/M08 Screwpin", desc: "insulator" },
          { sapNo: "2840", name: "Insulator, Cast Resin 50/40/M08", desc: "insulator" },
          { sapNo: "77188", name: "Heater Fan 230V/250W ENERCON V2", desc: "heater fan" },
          { sapNo: "107519", name: "Top-hat Rail Clip Hutclip AL S040", desc: "rail clip" },
          { sapNo: "58688", name: "IGBT-module 1200V 1000A CM1000E3UA-24", desc: "disabled: only replace complete heat sink units after repair instruction!" },
          { sapNo: "25812", name: "Capacitor 14000µF 400V ELKO d=90 M2", desc: "manufacturer: Epcos" },
          { sapNo: "3009", name: "Capacitor 1,5µF 1200V PMB ±10% RM25,0", desc: "snubber capacitor" },
          { sapNo: "21222", name: "Capacitor 1,5µF 1250V SCM ±10%(I)RM45", desc: "snubber capacitor" },
          { sapNo: "7380", name: "Capacitor 22µF 900V", desc: "alternative / replaced by: SAP 609385 capacitor 22µF 1300V B32373A EPCOS®", alternativeSap: "609385" },
          { sapNo: "238", name: "Capacitor 8,0µF 450V MK", desc: "motor start capacitor for fan heatsink1 und heatsink2" },
          { sapNo: "507927", name: "Heat Sink Unit E101 CM1000 D0654231-0", desc: "heat sink unit" },
          { sapNo: "776279", name: "Fan 230V 50/60Hz EBM D2E146AZ00XK", desc: "fan" },
          { sapNo: "50081", name: "PCB 300kW Inverter Supply V1.5", desc: "replaced by: SAP 711526 (V1.6). alternative: SAP 34776 (V1.2)", alternativeSap: "711526" },
          { sapNo: "671062", name: "PCB EMC-Filter C-PE V1.1 0u068", desc: "EMC filter board" },
          { sapNo: "53588", name: "PCB C-adapter V1.0 E112", desc: "C-adapter board" },
          { sapNo: "509375", name: "PCB Controlboard Excitation V2.0 E112", desc: "replaced by SAP 510469", alternativeSap: "510469" },
          { sapNo: "510469", name: "PCB Controlboard Excitation V2.1 E112", desc: "excitation control board" },
          { sapNo: "48030", name: "PCB DC Link Interface Excitation E112", desc: "DC link board" },
          { sapNo: "77915", name: "PCB Excitation IGBT-driv. CM1000 V2.1", desc: "replaced by / alternative: SAP 91663 (V2.2)", alternativeSap: "91663" },
          { sapNo: "91663", name: "PCB Excitation IGBT-driv. CM1000 V2.2", desc: "alternative: SAP 77915 (V2.1)", alternativeSap: "77915" },
          { sapNo: "588947", name: "Fan Radial- 50Hz D2E146-AZ03-E7", desc: "delivery inclusive capacitor 7,0µF 500V 50HZ MKP" },
          { sapNo: "58723", name: "Switch Auxiliary 1NO/1NC DILM150-XHI11", desc: "auxiliary switch" },
          { sapNo: "71782", name: "Contactor Power- 150A DILM150(RAC240)", desc: "power contactor" },
        ]
      },
      {
        id: "e92_nac_14_excitationn",
        name: "Excitationn (Uyarım Sistemi 14)",
        imageName: "14 excitationn.PNG",
        parts: []
      },
      {
        id: "e92_nac_filter_cabinet",
        name: "Filter Cabinet (Filtre Kabini)",
        imageName: "15 filter cabinet.PNG",
        parts: [
          { sapNo: "81429", name: "Protection Against Contact D0115715-0", desc: "MAKROLON-cover" },
          { sapNo: "81430", name: "Protection Against Contact ch.D0115718-3", desc: "MAKROLON-cover choke" },
          { sapNo: "45759", name: "Choke Three-ph.wall Grid-DDR11500 BV4939", desc: "three-phase choke" },
          { sapNo: "550736", name: "Choke Filter- 3UI180/78S009 0,075mH", desc: "choke filter" },
          { sapNo: "544773", name: "Choke Filter- KDD6,3 350A/0,076mH", desc: "alternative: SAP 550736 choke filter", alternativeSap: "550736" },
          { sapNo: "25658", name: "Fan Cross Flow 230V Type QLN65/2400-3030", desc: "replacement for SAP 3337", alternativeSap: "3337" },
          { sapNo: "53606", name: "Switch Temperature Bimetal 150±4°C ma.r.", desc: "manually operated reset" },
          { sapNo: "81484", name: "Switch Temperature Bimetal 75±5°C 1C", desc: "switch temperature bimetal" },
          { sapNo: "79398", name: "Cabinet Filter- Generator V1 CS82a Part1", desc: "for 3MW plant part 1" },
          { sapNo: "5448", name: "Fuse Link NH 500V NH2 /400A", desc: "fuse link NH" },
          { sapNo: "45758", name: "Fuse Disconnector NH-2 JUNG® DTL400", desc: "fuse disconnector" },
          { sapNo: "535124", name: "Resistor Chopper- VSGR 3 R76 10% 250 LX", desc: "resistor chopper" },
          { sapNo: "23336", name: "Resistor Unit 3x0,78 Ohm Type E-309", desc: "resistor unit" },
          { sapNo: "72008", name: "Capacitor 3x96,2µF ACMKP550.3.27,50-B116", desc: "replaced by: SAP 98508 capacitor", alternativeSap: "98508" },
          { sapNo: "73976", name: "Capacitor 3x96,3µF/565V MKK-AC", desc: "replaced by: SAP 98508 capacitor", alternativeSap: "98508" },
          { sapNo: "98508", name: "Capacitor 3x96,3µF/565V MKK565-D-25", desc: "capacitor" },
          { sapNo: "53605", name: "Switch Temperature Bimetal 70±4°C ma.re.", desc: "manually operated reset" },
        ]
      },
      {
        id: "e92_nac_fan_inverter",
        name: "Fan Inverter (Fan Sürücü)",
        imageName: "16 fan inverter.PNG",
        parts: [
          { sapNo: "57560", name: "Lightning Current Arrester FLT35-260", desc: "lightning current arrester" },
          { sapNo: "517381", name: "Choke Line- 3x0,47mH LR3/X B 1102166", desc: "choke line" },
          { sapNo: "58052", name: "Choke Line- 3x0,47mH SKCI1-460/70C", desc: "choke line" },
          { sapNo: "525283", name: "Filter Unit SFB B0706040 3x1,2mH 3x45A", desc: "filter unit" },
          { sapNo: "9052", name: "Filter Ferrite Core R56/32/18 K6000", desc: "filter ferrite core" },
          { sapNo: "55147", name: "Terminal 3-Phase 3RV1925-5AB SIEMENS®", desc: "terminal 3-phase" },
          { sapNo: "76685", name: "Filter Grid-3x045A 3x1,2mH", desc: "linefilter 3x1,2mH" },
          { sapNo: "54649", name: "Parameter-box SK TU1-PAR", desc: "parameter-box" },
          { sapNo: "43796", name: "PCB Filter Yaw Inverter V1.0 E66", desc: "PCB filter yaw inverter" },
          { sapNo: "76382", name: "PCB PB-Gateway V1.6", desc: "alternative: SAP 55623 (V1.3) , SAP 69547 (V1.5)", alternativeSap: "55623" },
          { sapNo: "86060", name: "PCB PT100/PTC Interface V1.1", desc: "alternative: SAP 526365 (V1.2, PT100/PTC)", alternativeSap: "526365" },
          { sapNo: "526365", name: "PCB PT100/PTC Interface V1.2", desc: "alternative SAP 86060 (V1.1, PT100/PTC)", alternativeSap: "86060" },
          { sapNo: "53597", name: "Switch Auxiliary 1NO/1NC 3RV1901-1E SIE®", desc: "auxiliary switch" },
          { sapNo: "68602", name: "Switch Motor Protect. 5,5-8,0A 3RV1021", desc: "Attached auxiliary contact: SAP 53597" },
          { sapNo: "55145", name: "Bar Bus- 3-Phase 3RV1915-1BB SIEMENS®", desc: "bar bus" },
          { sapNo: "54650", name: "Interface Standard I/O SK CU1-STD", desc: "interface standard I/O" },
          { sapNo: "510664", name: "Frequency Conv.nacel.fan V3 Ass.CS82 STD", desc: "frequency converter" },
          { sapNo: "58638", name: "Protective Dev.240-500VAC DILM32-XSPR500", desc: "protective device" },
          { sapNo: "58693", name: "Contactor Power-32A 1NC 230VAC DILM32-01", desc: "power contactor" },
          { sapNo: "58051", name: "Frequency Con. SK700E-222-340-A 22kW", desc: "frequency converter" },
          { sapNo: "69364", name: "Frequency Con. SK700E TU1-PAR CU1-STD", desc: "frequency converter" },
          { sapNo: "19921", name: "Overvoltage Arrester VAL-MS500ST", desc: "alternative: SAP 19920 or SAP 1380", alternativeSap: "19920" },
          { sapNo: "33375", name: "Overvoltage Arrester VAL-MSBE", desc: "base socket" },
        ]
      },
      {
        id: "e92_nac_17_beacon",
        name: "Beacon (İkaz Lambası 17)",
        imageName: "17 beacon.PNG",
        parts: []
      },
      {
        id: "e92_nac_18_beaconn",
        name: "Beaconn (İkaz Lambası 18)",
        imageName: "18 beaconn.PNG",
        parts: []
      },
      {
        id: "e92_nac_ventilation",
        name: "Generator Ventilation (Ventilasyon)",
        imageName: "19 generator ventilation.PNG",
        parts: [
          { sapNo: "126664", name: "Generator Fan E70/E82/E92/E101", desc: "replaced depending on manufacturer: Ziehl-Abegg" },
          { sapNo: "536921", name: "Fan Radial P9M-K0A40-SAB", desc: "manufacturer: Nicotra-Gebhardt" },
          { sapNo: "191588", name: "Protective Grating for Fan P9M-K0A40-SAB", desc: "protective grating" },
          { sapNo: "106747", name: "Fan(F) GR56E-4DK6N1R 1320/min E101", desc: "replaced by SAP 516332", alternativeSap: "516332" },
          { sapNo: "516332", name: "Fan(F) GR56E-4DK6N1R 1400/min E101", desc: "manufacturer: Ziehl-Abegg" },
          { sapNo: "102899", name: "Motor f. Fan Ziehl-Abegg® RH56E-4DK E82/2", desc: "Motor with impeller" },
          { sapNo: "194559", name: "Motor f. Fan Ziehl-Abegg® RH56N-4DK.6N.AR", desc: "motor" },
          { sapNo: "577352", name: "Radial Fan GR56N-4DK.6N.AR", desc: "manufacturer: Ziehl-Abegg" },
          { sapNo: "144709", name: "Fan Prot.grat.Ziehl-Abegg® GR56E-4DK6N1R", desc: "fan protection" },
          { sapNo: "165203", name: "Fan Prot.grat.Ziehl-Abegg® GR56N-4DK6NAR", desc: "fan protection" },
          { sapNo: "532578", name: "Fan Fastener 1,5,7,9,11o´clock 8202180-5", desc: "fan fastener" },
          { sapNo: "532573", name: "Fan Fastener 3 o´clock Fixed 8202177-1", desc: "fan fastener" },
          { sapNo: "532575", name: "Fan Fastener 3 o´clock Fixed 8202178-2", desc: "fan fastener" },
          { sapNo: "532577", name: "Fan Fastener 3 o´clock Rotat. 8202179-2", desc: "fan fastener" },
          { sapNo: "593433", name: "Interlock GN 115-SK-20 Ganter®", desc: "for fan fastener" },
        ]
      },
      {
        id: "e92_nac_rectifier",
        name: "Rectifier (Doğrultucu)",
        imageName: "20 rectifier.PNG",
        parts: [
          { sapNo: "81729", name: "Cover Rectifier 3,5MW D0117800-3", desc: "MAKROLONcover rectifier 3,5MW" },
          { sapNo: "120486", name: "Connecting Line Thyristor 3,5 MW Eupec®", desc: "length = 56cm, 70cm and 90cm." },
          { sapNo: "586492", name: "Axial Flow Fan FN040-4DQ.2F.A7P4", desc: "axial flow fan" },
          { sapNo: "81528", name: "Axial Flow Fan FE040-4DQ.2F.A7 TBO", desc: "for cabinet rectifier" },
          { sapNo: "548552", name: "Axial Flow Fan FE040-4DQ.2F.A7 TBI", desc: "replaced by: SAP 586492", alternativeSap: "586492" },
          { sapNo: "513498", name: "Rectifier ABB Thy. D0167908-5", desc: "alternative: SAP 585711 or SAP 506809", alternativeSap: "585711" },
          { sapNo: "585711", name: "Rectifier Block Proton T272-3200-18N", desc: "alternative: SAP 513498", alternativeSap: "513498" },
          { sapNo: "506809", name: "Rectifier Block 2T3160N18TOF-KE02/...KTY", desc: "alternative: SAP 585711", alternativeSap: "585711" },
          { sapNo: "77188", name: "Heater Fan 230V/250W ENERCON V2", desc: "heater fan" },
          { sapNo: "59642", name: "Hygrostat ALRE® RFHSS-113.110/01", desc: "alternative: SAP 567919", alternativeSap: "567919" },
          { sapNo: "567919", name: "Hygrostat ALRE® RFHSS-115.110/01", desc: "hygrostat" },
          { sapNo: "514592", name: "Capacitor 8,0µF 1000V GMKP 1000-8 I", desc: "alternative of SAP 514601", alternativeSap: "514601" },
          { sapNo: "514601", name: "Capacitor 8,0µF 1200V E62.F81-802D10", desc: "capacitor" },
          { sapNo: "68888", name: "PCB Controlboard Rectifier V1.3 E112", desc: "alternative: SAP 82317 (V1.4)", alternativeSap: "82317" },
          { sapNo: "82317", name: "PCB Controlboard Rectifier V1.4 E112", desc: "alternative: SAP 68888 (V1.3)", alternativeSap: "68888" },
          { sapNo: "29592", name: "Switch Auxiliary NHI-E-11-PKZ0", desc: "auxiliary switch" },
          { sapNo: "60033", name: "PCB Shuntinterface V2.1", desc: "PCB shuntinterface" },
          { sapNo: "29608", name: "Switch Motor Protect. 1,0-1,6A PKZM0-1,6", desc: "motor protection switch" },
          { sapNo: "58234", name: "Switch Temperature 112±3°C 1NC M05x06", desc: "switch temperature" },
        ]
      },
      {
        id: "e92_nac_21_rectifierrr",
        name: "Rectifierrr (Doğrultucu 21)",
        imageName: "21 rectifierrr.PNG",
        parts: []
      },
      {
        id: "e92_nac_control_cabinet",
        name: "Nacelle Control Cabinet (Kontrol Kabini)",
        imageName: "22 control cabinet.PNG",
        parts: [
          { sapNo: "41191", name: "Connection Block", desc: "Connection block BK25/3-PKZ0" },
          { sapNo: "39206", name: "Mounting Adapter M22-A", desc: "Mounting adapter M22-A" },
          { sapNo: "8787", name: "Rubber Gasket Neoprene", desc: "Rubber gasket neoprene 140x43mm" },
          { sapNo: "25343", name: "Rotary Socket Box CEE 16A", desc: "Rotary curr.socket box mount.CEE 16A QCr" },
          { sapNo: "39834", name: "Push Button Round IP67", desc: "Push button, round IP 67 M22-D-X" },
          { sapNo: "26718", name: "Gas Pressure Damper 150N", desc: "Gas pressure damper hoisting 150N", alternativeSap: "105027" },
          { sapNo: "77188", name: "Heater Fan 230V/250W", desc: "Heater fan 230V/250W ENERCON V2" },
          { sapNo: "574233", name: "Hand Lamp STALED LED V2.0", desc: "Spinner lamp (LED) or hand lamp", alternativeSap: "513359" },
          { sapNo: "583194", name: "Hand Lamp STALED LED V3.0", desc: "Spinner lamp (LED) or hand lamp", alternativeSap: "513359" },
          { sapNo: "46668", name: "PCB Anemometer Interface V2.0", desc: "PCB anemometer interface", alternativeSap: "84056" },
          { sapNo: "84056", name: "PCB Anemometer Interface V3.0", desc: "PCB anemometer interface", alternativeSap: "46668" },
          { sapNo: "66802", name: "PCB I/O Board V1.5", desc: "PCB I/O board E112", alternativeSap: "61812" },
          { sapNo: "53786", name: "PCB Opt. Distrib. Controller", desc: "PCB opt.distrib.contr.type CAN V2.2aE112" },
        ]
      },
      {
        id: "e92_nac_23_control_cabinett",
        name: "Control Cabinett (Kontrol Kabini 23)",
        imageName: "23 control cabinett.PNG",
        parts: []
      },
      {
        id: "e92_nac_24_control_cabinettttt",
        name: "Control Cabinettttt (Kontrol Kabini 24)",
        imageName: "24 control cabinettttt.PNG",
        parts: []
      },
      {
        id: "e92_nac_25_cable_twist",
        name: "Cable Twist (Şema 25)",
        imageName: "25 cable twist.PNG",
        parts: []
      },
      {
        id: "e92_nac_26_main_carrier",
        name: "Main Carrier (Şema 26)",
        imageName: "26 main carrier.PNG",
        parts: []
      },
      {
        id: "e92_nac_rotor_lock",
        name: "Rotor Lock (Rotor Kilidi)",
        imageName: "27 rotor lock.PNG",
        parts: [
          { sapNo: "94315", name: "Stop Ring SW14 f. 4/2 Distributing Valve", desc: "stop ring" },
          { sapNo: "88343", name: "Locking Bolt Carrier Disk 6601433-1", desc: "locking bolt carrier disk" },
          { sapNo: "8628", name: "Arrestor Aggregat MK66013-0", desc: "canister with hand pump" },
          { sapNo: "40776", name: "Ventilation Screw G1/2 (Kroning®)", desc: "applicable for fluid tank and arrestor aggregate" },
          { sapNo: "19854", name: "Spring Plunger GN615 M24 KSN", desc: "for rotor locking" },
          { sapNo: "89753", name: "Slide Bush Rotor Locking 8201016-0", desc: "slide bush" },
          { sapNo: "78131", name: "Hand Wheel f.hand Pump Arrestor Aggregat", desc: "hand wheel" },
          { sapNo: "8629", name: "Hydraulik Stamp D40/d22/H60", desc: "comp. Kroning or Hoerbiger" },
          { sapNo: "1751", name: "Lever for Brake Aggregate", desc: "lever" },
          { sapNo: "59122", name: "Key Ball Valve SW 14", desc: "Handle for the way valve (SAP 11881)" },
          { sapNo: "19853", name: "Hexagon Nut DIN439 M24 A2 Form B", desc: "for pressure unit SAP 19854" },
          { sapNo: "78132", name: "Valve f.hand Pump Arrestor Aggregat", desc: "valve" },
          { sapNo: "88626", name: "Anti-twist Plate f.rotor Lock 8201014-0", desc: "anti-twist plate" },
          { sapNo: "11881", name: "Directional Valve 4/2 Direction", desc: "locking device" },
        ]
      },
      {
        id: "e92_nac_28_visibility__stator_sub_dis",
        name: "Visibility- Stator Sub Dis. (Alt Dağıtım 28)",
        imageName: "28 visibility- stator sub dis..PNG",
        parts: []
      },
      {
        id: "e92_nac_yaw_cabinet",
        name: "Yaw Cabinet (Azimuth Paneli)",
        imageName: "28 yaw cabinet.PNG",
        parts: [
          { sapNo: "43130", name: "Diode Module 81A/1400V SKKD81/14", desc: "alternative: SAP 60758 diode module 100A/1400V SKKD100/14", alternativeSap: "60758" },
          { sapNo: "43129", name: "Choke 3x0,1mH 3x17A DDR27 Bv.4911", desc: "choke" },
          { sapNo: "36824", name: "Choke 3x0,1mH 50A BLOCK B0201069", desc: "application for instance: SAP 55049" },
          { sapNo: "56701", name: "Heater Fan 220-240VAC 250W HG Vario 250", desc: "replaced by SAP 77188", alternativeSap: "77188" },
          { sapNo: "77188", name: "Heater Fan 230V/250W ENERCON V2", desc: "heater fan" },
          { sapNo: "98069", name: "IGBT-module 1200V 150A SKM150GAR12T", desc: "alternative: SAP 548974", alternativeSap: "548974" },
          { sapNo: "21171", name: "IGBT-module 1200V 100A SKM100GAL123", desc: "alternative: SAP 98068", alternativeSap: "98068" },
          { sapNo: "21170", name: "IGBT-module 1200V 100A SKM100GAR123", desc: "change to SAP 75162", alternativeSap: "75162" },
          { sapNo: "75161", name: "IGBT-module 1200V 145A SKM145GAL128", desc: "alternative: SAP 98068", alternativeSap: "98068" },
          { sapNo: "75162", name: "IGBT-module 1200V 145A SKM145GAR128", desc: "replaced by SAP 98069", alternativeSap: "98069" },
          { sapNo: "107064", name: "Tubular Fluoresc.lamp 14W/840 TL-D", desc: "replacement for SAP 38351" },
          { sapNo: "50081", name: "PCB 300kW Inverter Supply V1.5", desc: "replaced by: SAP 711526 (V1.6). alternative: SAP 34776 (V1.2)", alternativeSap: "711526" },
          { sapNo: "36854", name: "PCB Driver Inverter 100A Modul V1.2", desc: "alternative: SAP 530060 (V1.3)", alternativeSap: "530060" },
          { sapNo: "530060", name: "PCB Driver Inverter 100A Modul V1.3", desc: "alternative: SAP 36854 (V1.2)", alternativeSap: "36854" },
          { sapNo: "43016", name: "PCB Motor Controller V1.1", desc: "alternative: SAP 68039", alternativeSap: "68039" },
          { sapNo: "51277", name: "PCB Motor Controller V1.2", desc: "alternative: SAP 68039", alternativeSap: "68039" },
          { sapNo: "55469", name: "PCB Motor Controller V1.2a", desc: "alternative: SAP 68039", alternativeSap: "68039" },
          { sapNo: "68039", name: "PCB Motor Controller V1.3", desc: "alternative: SAP 55469", alternativeSap: "55469" },
        ]
      },
      {
        id: "e92_nac_29_yaw_cabinettt",
        name: "Yaw Cabinettt (Şema 29)",
        imageName: "29 yaw cabinettt.PNG",
        parts: []
      }
    ],
    rotor: [
      {
        id: "e92_rot_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e92_rot_2_blade_adapter",
        name: "Blade Adapter (Rüzgar Kanadı 2)",
        imageName: "2 blade adapter.PNG",
        parts: []
      },
      {
        id: "e92_rot_blade_heating",
        name: "Blade Heating (Kanat Isıtma)",
        imageName: "3 blade heating.PNG",
        parts: [
          { sapNo: "162468", name: "bridge brass- 40,3x12x2mm T&H®", desc: "SAP Part details from drawing" },
          { sapNo: "162470", name: "bridge brass- 56x12x2mm T&H®", desc: "SAP Part details from drawing" },
          { sapNo: "162471", name: "bridge brass- 60x12x2mm T&H®", desc: "SAP Part details from drawing" },
          { sapNo: "162473", name: "bridge brass- 93,3x12x2mm T&H®", desc: "SAP Part details from drawing" },
          { sapNo: "161270", name: "heating insert 25kW w.contr.50kW bhs T&H", desc: "replaced by SAP 641545" },
          { sapNo: "161274", name: "heat. insert 25kW w.o.contr.50kW bhs T&H", desc: "replaced by SAP 641546" },
          { sapNo: "641545", name: "heating insert elec. 25kW w. sens.T+H®", desc: "SAP Part details from drawing" },
          { sapNo: "641546", name: "heating insert elec. 25kW w.o.sensor T+H", desc: "SAP Part details from drawing" },
          { sapNo: "550742", name: "heating register 3x690V 50kW HRR50-36-50", desc: "manufacturer: Türk+Hillinger" },
          { sapNo: "146531", name: "temperature limiter Thermik® L01 135°", desc: "SAP Part details from drawing" },
          { sapNo: "144208", name: "thermostat set 100°C bhs T&H", desc: "notiz: this thermostat has a fixed setting of 100°C. It is interchangeable with the old version with adjustment." },
          { sapNo: "699212", name: "thermostat set 120°C bhs T&H®", desc: "SAP Part details from drawing" },
          { sapNo: "626335", name: "bridge 14x2x128mm Egger® 12727-011", desc: "SAP Part details from drawing" },
          { sapNo: "162265", name: "temperature limit. Egger® 150/800mm 135°", desc: "SAP Part details from drawing" },
          { sapNo: "162264", name: "thermostat set 100°C bhs Egger", desc: "SAP Part details from drawing" },
          { sapNo: "698955", name: "thermostat set 120°C bhs Egger®", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_4_blade_heatingg",
        name: "Blade Heatingg (Kanat Isıtma 4)",
        imageName: "4 blade heatingg.PNG",
        parts: []
      },
      {
        id: "e92_rot_5_blade_heatingggg",
        name: "Blade Heatingggg (Kanat Isıtma 5)",
        imageName: "5 blade heatingggg.PNG",
        parts: []
      },
      {
        id: "e92_rot_6_blade_heatinggggg",
        name: "Blade Heatinggggg (Kanat Isıtma 6)",
        imageName: "6 blade heatinggggg.PNG",
        parts: []
      },
      {
        id: "e92_rot_6_blade_heatingggggggg",
        name: "Blade Heatingggggggg (Kanat Isıtma 6)",
        imageName: "6 blade heatingggggggg.PNG",
        parts: []
      },
      {
        id: "e92_rot_7_blade_control",
        name: "Blade Control (Rüzgar Kanadı 7)",
        imageName: "7 blade control.PNG",
        parts: []
      },
      {
        id: "e92_rot_pitch_box",
        name: "Pitch Box (Pitch Kontrol Kutusu)",
        imageName: "8 pitch box.PNG",
        parts: [
          { sapNo: "57708", name: "choke 3x0,6mH 3x20A DDR230", desc: "SAP Part details from drawing" },
          { sapNo: "57707", name: "choke smoothing- 2x0,07mH EDR27", desc: "SAP Part details from drawing" },
          { sapNo: "7184", name: "socket insert 5p+PE 16A crimp term.", desc: "Han 5/Q" },
          { sapNo: "800", name: "socket insert 6p 380VAC 35A screw term.", desc: "Han 6 B  size: 84,5mm x 34mm height 33mm" },
          { sapNo: "802", name: "socket insert 8p 42VAC 10A crimp term.", desc: "Han 8 U" },
          { sapNo: "778", name: "housing,ext.mount.40p 113x43 SWR 2levers", desc: "SAP Part details from drawing" },
          { sapNo: "3442", name: "housing ext.mount. 4p 28x40 SWR str.", desc: "SAP Part details from drawing" },
          { sapNo: "42731", name: "hood M20 vertical side 3A SWR f. 1 lever", desc: "SAP Part details from drawing" },
          { sapNo: "720", name: "limit switch AT0-11-S-I w.roll actulator", desc: "standard end switch. infomation: for use an overspeed switch the spring must be removed in the switch.  alternative depending on the appllication ! standard end switch = SAP 52130 limit switch LS-11S w.roll actulator (manufacturer Moeller) + applicable assessory: SAP 24750 screwed cable gland with cord grip M20x1 and SAP 86250 roller lever short LS-XLS or for overspeed switch = SAP 81973 limit switch LS-11S-ENC1 plunger (without spring and protective cap)" },
          { sapNo: "52130", name: "limit switch LS-11S w.roll actulator", desc: "standard end switch. LS-11S  IP 66" },
          { sapNo: "22035", name: "IGBT-module 1200V 145A SKM145GAL123D", desc: "alternative / replaced by: SAP 98068 IGBT-module 1200V 150A      SKM150GAL12T4" },
          { sapNo: "61932", name: "IGBT-module 1200V 145A SKM145GB128D", desc: "1 VE = 8 ST.  replaced by: SAP 524796 IGBT-module 1200V 150A       SKM150GB12T4" },
          { sapNo: "98068", name: "IGBT-module 1200V 150A     SKM150GAL12T4", desc: "SAP Part details from drawing" },
          { sapNo: "524796", name: "IGBT modul 1200V 150A SKM150GB12T4", desc: "SAP Part details from drawing" },
          { sapNo: "4181", name: "cable PE-connect.cov.plate M5 D0128536 -", desc: "SAP Part details from drawing" },
          { sapNo: "55260", name: "cable flat cable BLRG4812 E40 26pin E48", desc: "SAP Part details from drawing" },
          { sapNo: "7076", name: "PCB battery charger V1.1 E66", desc: "alternative SAP 553098" },
          { sapNo: "8184", name: "capacitor 4700µF 450V B43456-S5478-M3", desc: "SAP Part details from drawing" },
          { sapNo: "553098", name: "pcb battery charger V2.0 E66", desc: "alternative: SAP 7076  first use up !" },
          { sapNo: "674129", name: "PCB Controlboard Pitch CS48/82/101 V3.1", desc: "SAP Part details from drawing" },
          { sapNo: "57566", name: "PCB controlboard pitch V1.3 CS48/82", desc: "alternative: SAP 63310 (V1.4) ; SAP 69390 (V1.5) ; SAP 71576 (V1.6)" },
          { sapNo: "63310", name: "PCB controlboard pitch V1.4 CS48/82", desc: "alternative (not used for E-101 and E-15): SAP 71576 (V1.6) , SAP 69390 (V1.5)  or alternative: SAP 511910 (V2.1)" },
          { sapNo: "69390", name: "PCB controlboard pitch V1.5 CS48/82", desc: "alternative (not used for E-101 und E-115): SAP 71576 (V1.6) , SAP 63310 (V1.4)  or alternative: SAP 511910 (V2.1)" },
          { sapNo: "71576", name: "PCB controlboard pitch V1.6      CS48/82", desc: "alternative (not used for E-101 und E-115): SAP 69390 (V1.5) , SAP 63310 (V1.4)  or  alternative: SAP 511910 (V2.1)" },
          { sapNo: "511910", name: "PCB controlboard pitch V2.1", desc: "for control CS48/82/101. Priority only for the E-101 and E-115 ! Ordering only in accordance with AUR-order-management! Information: If the PCB SAP 511910 (V2.1) is installed in E-44 (CS48), E-48 (CS48), E-53 (CS48)  or  E-70 E4 (CS82),   E-70 E4-2/-3 (CS82),   E-82 (CS82), E-82 E2/E3 ( CS82),   E-82 E4 (CS82), E-92 (CS82)  then you can also use alternative  SAP 71576 (V1.6), SAP 69390 (V1.5), SAP 63310 (V1.4)  The alternative can not be used for the E-101 and E-115 (CS101) !" },
          { sapNo: "58841", name: "PCB power board pitch V1.1 CS82", desc: "replace SAP 57495 (V1.0) ; alternative: SAP 529523 (V1.2)" },
          { sapNo: "529523", name: "PCB power board pitch V1.2 CS82", desc: "alternative SAP 58841 (V1.1) first up !" },
          { sapNo: "791021", name: "PCB Powerboard Pitch CS82 V1.4", desc: "SAP Part details from drawing" },
          { sapNo: "29591", name: "switch motor protect. 20,0-25A PKZM0-25", desc: "alternative SAP 21845" },
          { sapNo: "21845", name: "switch motor protect. 20 - 25A 140-MN", desc: "alternative SAP 29591" },
          { sapNo: "586224", name: "pitch box V1.0 BGr.CS82 E92", desc: "SAP Part details from drawing" },
          { sapNo: "58262", name: "sensor BLRG8212 KTY81-110 CS82", desc: "SAP Part details from drawing" },
          { sapNo: "21172", name: "current transformer LA205-S/SP1 200A", desc: "SAP Part details from drawing" },
          { sapNo: "58067", name: "thyristor module 106A/1200V SKKH106/12E", desc: "SAP Part details from drawing" },
          { sapNo: "506427", name: "thyristor module 122A/1200V SKKH106/12E", desc: "alternative for SAP 58067" },
          { sapNo: "593057", name: "overspeed switch w.sleeve bear. CS82/E92", desc: "SAP Part details from drawing" },
          { sapNo: "57729", name: "resistor chopper- 12R 295W", desc: "SAP Part details from drawing" },
          { sapNo: "976", name: "resistor power 820R 140W 10% pipe", desc: "alternative SAP 68002" },
          { sapNo: "68002", name: "resistor power 820R 150W 10% pipe", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_relay_box",
        name: "Relay Box (Röle Kutusu)",
        imageName: "9 relay box.PNG",
        parts: [
          { sapNo: "55788", name: "diode T40HFL100S05 40A", desc: "SAP Part details from drawing" },
          { sapNo: "57706", name: "choke charging- 12,5mH 15A EDR7640", desc: "SAP Part details from drawing" },
          { sapNo: "794", name: "pin insert 6p 380VAC 35A screw term.", desc: "Han 6 HsB  e.g. for relay box" },
          { sapNo: "793", name: "pin insert 40p 250VAC 10A crimp term.", desc: "Han 40 D  e.g. control cable E-15" },
          { sapNo: "46671", name: "sleeve h.M32 vertical side 16M SWR 2 lev", desc: "SAP Part details from drawing" },
          { sapNo: "55945", name: "sleeve h.M40 vertical side 16B SWR 2lev", desc: "SAP Part details from drawing" },
          { sapNo: "4181", name: "cable PE-connect.cov.plate M5 D0128536 -", desc: "SAP Part details from drawing" },
          { sapNo: "201973", name: "SAP Part 201973", desc: "Part details from drawing" },
          { sapNo: "18034", name: "fuse conductor relay box E66", desc: "SAP Part details from drawing" },
          { sapNo: "53596", name: "switch auxiliary 2NO/2NC 3RH1911-1HA22", desc: "SAP Part details from drawing" },
          { sapNo: "547481", name: "switch aux. S0+S00 ÖÖSS 3RH2911-1HA22", desc: "SAP Part details from drawing" },
          { sapNo: "53595", name: "switch auxiliary 2NO/2NC 3RH1921-1HA22", desc: "SAP Part details from drawing" },
          { sapNo: "549170", name: "relay box V2.0 ass CS82 std", desc: "information: In the relay box V2.0 cable -W03 4x6mm² (connection for cabacitor box V3) is fitted with plug =076-J02." },
          { sapNo: "53601", name: "rev.volt.divid.240-400VAC 3RT1916-1CE00", desc: "SAP Part details from drawing" },
          { sapNo: "53602", name: "rev.volt.divid.240-400VAC 3RT1926-1CE00", desc: "SAP Part details from drawing" },
          { sapNo: "53600", name: "RC-element 240-400VAC 3RT1936-1CE00", desc: "SAP Part details from drawing" },
          { sapNo: "53569", name: "contactor sm. 07A 1NC 230V 3RT1015-1AP02", desc: "SAP Part details from drawing" },
          { sapNo: "55224", name: "contactor sm.07A 1NC 48VDC 3RT1015-1BW42", desc: "SAP Part details from drawing" },
          { sapNo: "53571", name: "power contactor 230VAC 3RT1025-1AP00", desc: "SAP Part details from drawing" },
          { sapNo: "57177", name: "contactor power- 230VAC 3RT1026-1AP00", desc: "SAP Part details from drawing" },
          { sapNo: "53586", name: "contactor power- 230VAC 3RT1034-1AP00", desc: "SAP Part details from drawing" },
          { sapNo: "539928", name: "contactor power- 230VAC 3RT2015-1AP02", desc: "SAP Part details from drawing" },
          { sapNo: "542740", name: "contactor power- 230VAC 3RT2026-1AP00", desc: "SAP Part details from drawing" },
          { sapNo: "53589", name: "contactor power- 48VDC 3RT1034-1BW40", desc: "SAP Part details from drawing" },
          { sapNo: "7592", name: "fuse 500VAC 3,15A FF FA6x32 X085442", desc: "1 VE = 10 ST, replaced by SAP 68943" },
          { sapNo: "1712", name: "fuse temperature- 121°C SF-119-E1-10A", desc: "relay box" },
          { sapNo: "68943", name: "fuse micro- 500VAC 3,15A FF type 7012540", desc: "1 PAK = 10 ST.  alternative: SAP 7592" },
          { sapNo: "23972", name: "fitting SKINTOP®MS M25 brass", desc: "SAP Part details from drawing" },
          { sapNo: "23974", name: "fitting SKINTOP®MS M40 brass", desc: "SAP Part details from drawing" },
          { sapNo: "57661", name: "resistor power 0R47 100W 10% pipe", desc: "1 VE = 5 ST" },
          { sapNo: "57662", name: "resistor power 6R 430W 10% pipe", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_pitch_gear",
        name: "Pitch Gear (Hatve Dişlisi)",
        imageName: "10 pitch gear.PNG",
        parts: [
          { sapNo: "138594", name: "pitch drive ABM® 8201010-1", desc: "ABM type: KPGS5003 ; ratio 131,339 ; Spez.No.: MK82002 or MK82019 or MK92002" },
          { sapNo: "544930", name: "bushing curved tooth clutch Bowex® M32", desc: "SAP Part details from drawing" },
          { sapNo: "183448", name: "mounting socket 415000117 ABM®", desc: "Mounting bush for exchange of the shaft seal on ABM gearboxes. Please order only in agreement with Mechanical Engineering." },
          { sapNo: "544926", name: "hub Ø28 curved tooth clutch Bowex® 32", desc: "SAP Part details from drawing" },
          { sapNo: "54501", name: "o-ring seal 087x4,00 NBR", desc: "SAP Part details from drawing" },
          { sapNo: "546205", name: "parallel key DIN6885 A06x6x28", desc: "SAP Part details from drawing" },
          { sapNo: "790524", name: "SAP Part 790524", desc: "Part details from drawing" },
          { sapNo: "790522", name: "SAP Part 790522", desc: "Part details from drawing" },
          { sapNo: "160295", name: "shaft seal ring DIN3760 025x035x07 A", desc: "SAP Part details from drawing" },
          { sapNo: "211175", name: "SAP Part 211175", desc: "Part details from drawing" },
          { sapNo: "95628", name: "blade pitch gearing LIEBHERR MK82002-0", desc: "Liebherr type: DAT 250/494 ; ratio: 131,3 ; Spez.No.: MK 82 002-0" },
          { sapNo: "66642", name: "coupler M32/28 pitchgear E70 Liebherr", desc: "SAP Part details from drawing" },
          { sapNo: "117006", name: "blade flange gear.LIEBHERR CC 8201010-0", desc: "blade flange gear CC = Cold Climate. only for turbine in cold temperature zones ! Liebherr type: DAT 250 / 1494 ; ratio: 132,7 ; Öltyp: Syntogear plus 75W-90. CC = Cold Climate. -for turbine in cold temperature zones. -Impact test at -40 °C. -Fuchs gear oil grade No. 68 (SAP 99420)." },
          { sapNo: "138595", name: "pitch drive REXROTH® 8201010-1", desc: "Rexroth type: GFB9 W3 6041 ; ratio: 132 ; Spez.No.: MK82002 or MK82019 or MK92002" },
          { sapNo: "95630", name: "blade pitch gearing ZOLLERN® MK82002-0", desc: "Zollern type: ZHP 03.20 ; ratio: 130 ; Spez.No.: MK 82 002-0" },
          { sapNo: "103255", name: "oil-level gauge f.ZOLLERN gear ZHP3.20", desc: "oil-level gauge G3/4 for the pitch gear E-82/E2 type ZHP 3.20 Zollern®." },
          { sapNo: "54503", name: "radial shaft seal 040x62x07 DIN3760 si.A", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_pitch_motor",
        name: "Pitch Motor (Hatve Motoru)",
        imageName: "11 pitch motor.PNG",
        parts: [
          { sapNo: "141094", name: "pitch motor Emod® E82E4 MK82021-0", desc: "Emod  type: GKNB 112 L/ 4-240   power = 4,1 kW , speed = 1950 U/min , brake = 100 Nm" },
          { sapNo: "64597", name: "brake 100Nm f. motor AS112/4L2 Faurndau®", desc: "brake 100Nm for motor type: AS112/4L2 (Faurndau) and for motor type: GKNB 112/4-200 (Emod)" },
          { sapNo: "140466", name: "separate fan pitch drive E82-E4 E92 Emod", desc: "replaced by SAP 165039" },
          { sapNo: "138649", name: "cable pitchmotor-relay box E82/E4 E92", desc: "SAP Part details from drawing" },
          { sapNo: "136217", name: "pitch motor Ruckh®E82E4 MK82021-0", desc: "Ruckh  type: Pitch CS82 E4   power = 4,6 kW , speed = 2100 U/min , brake = 100 Nm. replaced by: SAP 192919 pitch motor Ruckh®E82E4 MK82021-2 (reinforced version). alternative: exchange all the pitch motor in turbine with 3 pc SAP 141094 pitch motor Emod® E82E4  MK82021-0." },
          { sapNo: "192919", name: "pitch motor Ruckh®E82E4 MK82021-2", desc: "Ruckh type: GN 112/4 E4 Pitch power = 4,6 kW, speed = 2100 U/min, brake = 100 Nm. information: the reinforced version can by serial number nummer 09 (107-09-xxxxxxxxxx) identified !" },
          { sapNo: "65633", name: "brake 100Nm for pitch motor E70 Ruckh®", desc: "replaced by SAP 141461" },
          { sapNo: "141461", name: "brake 100Nm KEB® 06.28.G10-0427", desc: "SAP Part details from drawing" },
          { sapNo: "137235", name: "separate fan pitch drive E82-E4 Ruckh®", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_12_generator",
        name: "Generator (Jeneratör 12)",
        imageName: "12 generator.PNG",
        parts: []
      },
      {
        id: "e92_rot_limit_switch",
        name: "Limit Switch (Emniyet Sınır Anahtarı)",
        imageName: "13 compact limit switch.PNG",
        parts: [
          { sapNo: "12097", name: "Distance bushing M04 6,0x0,75x7,0mm", desc: "for ENERCON compact limit switch" },
          { sapNo: "792", name: "pin insert 25p 250VAC 10A crimp term.", desc: "Han 25 D  e.g. control cable E-17" },
          { sapNo: "6570", name: "limit switch SCHMERSAL M687 6A 250V ass.", desc: "SAP Part details from drawing" },
          { sapNo: "45019", name: "hood M25 vertical side 25M SWR f.1 lever", desc: "SAP Part details from drawing" },
          { sapNo: "13164", name: "coupling bellows- ød=10mm ødl=10mm", desc: "SAP Part details from drawing" },
          { sapNo: "608", name: "cable control- Y-JZ 14x1,0mm² grey", desc: "SAP Part details from drawing" },
          { sapNo: "8228", name: "O-ring sealing OR2014300 VITON", desc: "SAP Part details from drawing" },
          { sapNo: "57413", name: "switch compact limit- ENERCON V1ass.CS82", desc: "application: E-82, E-82 E2/E3, E-70 E4-2 and E-70 (CS82) with /4-blades; -switch setting: -3°/90°/95°/97°" },
          { sapNo: "57479", name: "cable KES8228 compact limit switchV1CS82", desc: "SAP Part details from drawing" },
          { sapNo: "8227", name: "v-ring 25mm sealing ring TWVA002500", desc: "sealing compact limit switch E30 - 82" },
          { sapNo: "8230", name: "resistor heating- 5k6 HS25", desc: "SAP Part details from drawing" },
          { sapNo: "79116", name: "angle encoder CAN P+F CVS58M-SET CS82", desc: "alternative: SAP 79002 angle encoder CAN TWK com.V2 ass.CS82" },
          { sapNo: "57439", name: "absolute encoder CAN P+F compl. ass.CS82", desc: "replaced by: SAP 79116 angle encoder CAN P+F CVS58M-SET CS82  or altenative SAP 79002 angle encoder CAN TWK com.V2 ass.CS82" },
          { sapNo: "79002", name: "angle encoder CAN TWK com.V2 ass.CS82", desc: "alternative: SAP 79116 angle encoder CAN P+F CVS58M-SET CS82" },
        ]
      },
      {
        id: "e92_rot_capacitor_box",
        name: "Capacitor Box (Kapasitör Grubu)",
        imageName: "14 capacitor box.PNG",
        parts: [
          { sapNo: "84963", name: "protection against contact D0125739-1", desc: "SAP Part details from drawing" },
          { sapNo: "8971", name: "cover f.stainl.steel cabinet DA-00841-X", desc: "SAP Part details from drawing" },
          { sapNo: "8788", name: "rubber gasket neoprene 28x40mm", desc: "1 VE = 10 ST" },
          { sapNo: "81522", name: "socket insert 4p 830V 40A crimp term.", desc: "SAP Part details from drawing" },
          { sapNo: "7183", name: "pin insert 5p+PE 16A crimp term.", desc: "Han Q 5/0" },
          { sapNo: "3442", name: "housing ext.mount. 4p 28x40 SWR str.", desc: "SAP Part details from drawing" },
          { sapNo: "53636", name: "housing,ext.mount. 4p metal 1 level", desc: "SAP Part details from drawing" },
          { sapNo: "4181", name: "cable PE-connect.cov.plate M5 D0128536 -", desc: "SAP Part details from drawing" },
          { sapNo: "58209", name: "cable set KSR V1.0 complete CS82", desc: "SAP Part details from drawing" },
          { sapNo: "566128", name: "load resistor 820R 155W GVAD320x20 IP54", desc: "SAP Part details from drawing" },
          { sapNo: "514484", name: "PCB capacitor-board V4.3 Maxwell", desc: "SAP Part details from drawing" },
          { sapNo: "549123", name: "box capacitor rotor V3 CS82 Maxwell", desc: "replaced by: SAP 549124 box capacitor rotor V3 ass. CS82 NESS. or  SAP 552696 box capacitor rotor V3 ass. CS82 Samwha" },
          { sapNo: "58416", name: "sensor KSR 82 KTY81-110 CS82", desc: "SAP Part details from drawing" },
          { sapNo: "976", name: "resistor power 820R 140W 10% pipe", desc: "alternative SAP 68002" },
          { sapNo: "514482", name: "PCB capacitor-board V3.2 NessCap", desc: "SAP Part details from drawing" },
          { sapNo: "549124", name: "box capacitor rotor V3 ass. CS82 NESS.", desc: "alternative: SAP 552696 box capacitor rotor V3 ass. CS82 Samwha" },
          { sapNo: "656827", name: "box capacitor Rotor V4 CS82 NESS.", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_15_capacitor_boxx",
        name: "Capacitor Boxx (Kapasitör Grubu 15)",
        imageName: "15 capacitor boxx.PNG",
        parts: []
      },
      {
        id: "e92_rot_16_hub_dist",
        name: "Hub Dist. (Şema 16)",
        imageName: "16 hub dist..PNG",
        parts: []
      },
      {
        id: "e92_rot_blade",
        name: "Rotor Blade (Rüzgar Kanadı)",
        imageName: "17 rotor blade.PNG",
        parts: [
          { sapNo: "118148", name: "welding plate clamp pipe SP 1A M W5", desc: "SAP Part details from drawing" },
          { sapNo: "184386", name: "lightning protection tip TIP E92/1", desc: "SAP Part details from drawing" },
          { sapNo: "122585", name: "bracket f.LER coverpl. E101 R101220012-0", desc: "SAP Part details from drawing" },
          { sapNo: "142688", name: "spring elastomer 6330 U90 DIN9835 pref.", desc: "SAP Part details from drawing" },
          { sapNo: "133204", name: "spring elastomer 6363 U90 DIN9835 pref.", desc: "SAP Part details from drawing" },
          { sapNo: "132887", name: "Spring washer DIN9835 A4 R101160012-X", desc: "SAP Part details from drawing" },
          { sapNo: "142678", name: "threaded bolt DIN976 B M16x0260 A4-70", desc: "SAP Part details from drawing" },
          { sapNo: "138672", name: "t.e.serations unpainted E92-1 seg.1", desc: "SAP Part details from drawing" },
          { sapNo: "138673", name: "t.e.serations unpainted E92-1 seg.2", desc: "SAP Part details from drawing" },
          { sapNo: "138674", name: "t.e.serations unpainted E92-1 seg.3", desc: "SAP Part details from drawing" },
          { sapNo: "138675", name: "t.e.serations unpainted E92-1 seg.4", desc: "SAP Part details from drawing" },
          { sapNo: "138676", name: "t.e.serations unpainted E92-1 seg.5", desc: "SAP Part details from drawing" },
          { sapNo: "138677", name: "t.e.serations unpainted E92-1 seg.6", desc: "SAP Part details from drawing" },
          { sapNo: "46433", name: "domed cap nut DIN1587 M16 A2", desc: "SAP Part details from drawing" },
          { sapNo: "126943", name: "nut/ptt./nylon/flange ISO7043 M08 A2-70", desc: "SAP Part details from drawing" },
          { sapNo: "161", name: "nut/ptt./nylon DIN982 M16 A2", desc: "SAP Part details from drawing" },
          { sapNo: "613827", name: "lifting eye cover- R0122010000-0", desc: "lifting eye cover" },
          { sapNo: "613829", name: "rb lifting eye ratchet support R0122010.", desc: "SAP Part details from drawing" },
          { sapNo: "613839", name: "rb lifting eye ratchet bar R0122010003-1", desc: "SAP Part details from drawing" },
          { sapNo: "118147", name: "clamp pipe- DIN3015-T1 size 1 Ø10 AL", desc: "SAP Part details from drawing" },
          { sapNo: "578481", name: "protective cover R01230128-0", desc: "for E-92/1 blade" },
          { sapNo: "528203", name: "hexagon nut ISO4032 M16 A2", desc: "SAP Part details from drawing" },
          { sapNo: "179442", name: "TIP-S E92-1 KTL MW1 D0430981-0", desc: "SAP Part details from drawing" },
          { sapNo: "121689", name: "cover plate LER E101", desc: "SAP Part details from drawing" },
          { sapNo: "185060", name: "leading edge E92/1 for retrofit", desc: "SAP Part details from drawing" },
          { sapNo: "584717", name: "SAP Part 584717", desc: "Part details from drawing" },
          { sapNo: "57506", name: "balanc.chamber cover Ø54,5mm R01230127-x", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_18_rotor_bladeee",
        name: "Rotor Bladeee (Rüzgar Kanadı 18)",
        imageName: "18 rotor bladeee.PNG",
        parts: []
      },
      {
        id: "e92_rot_19_rotor_bearing",
        name: "Rotor Bearing (Rulman / Yatak 19)",
        imageName: "19 rotor bearing.PNG",
        parts: []
      },
      {
        id: "e92_rot_20_trafo_box",
        name: "Trafo Box (Şema 20)",
        imageName: "20 trafo box.PNG",
        parts: []
      },
      {
        id: "e92_rot_21_rotor_sub_dist",
        name: "Rotor Sub Dist. (Alt Dağıtım 21)",
        imageName: "21 rotor sub dist..PNG",
        parts: []
      },
      {
        id: "e92_rot_slip_ring",
        name: "Slip Ring (Kolektör / Kontak Bileziği)",
        imageName: "22 slip ring.PNG",
        parts: [
          { sapNo: "519799", name: "Lead through bolts 200A black DRU05628", desc: "SAP Part details from drawing" },
          { sapNo: "555278", name: "retainer 50S12-1-1AA Alcoa®", desc: "SAP Part details from drawing" },
          { sapNo: "532589", name: "incremental speed sensor 10-30VDC RVI58N", desc: "SAP Part details from drawing" },
          { sapNo: "518349", name: "graphite brush 32x16x64mm C40Z3 Schunk®", desc: "SAP Part details from drawing" },
          { sapNo: "530284", name: "graphite brush 32x16x64mm CU35M Carbex®", desc: "SAP Part details from drawing" },
          { sapNo: "570307", name: "coupling bellows- MK1/5/26 6E5 6H7", desc: "replaced the spring bar coupling!" },
          { sapNo: "517612", name: "load resistor HS25 820R F", desc: "SAP Part details from drawing" },
          { sapNo: "544011", name: "power part SRU ENERCON V1.0 E92", desc: "SAP Part details from drawing" },
          { sapNo: "554846", name: "cable ready-made XG07 adapter E92", desc: "SAP Part details from drawing" },
          { sapNo: "554042", name: "drive mechnsm. arm slip ring u.9208073-2", desc: "length = 1025mm" },
          { sapNo: "544148", name: "module carbon brush holder 9208097-1", desc: "SAP Part details from drawing" },
          { sapNo: "544010", name: "slip ring unit ENERCON V1 E92 n.a/w.bhz", desc: "SAP Part details from drawing" },
          { sapNo: "631753", name: "slip ring unit ENERCON V1 E92 n.a/n.bhs", desc: "SAP Part details from drawing" },
          { sapNo: "556666", name: "signal part SRU ENERCON V2.0 multibrush", desc: "SAP Part details from drawing" },
          { sapNo: "519312", name: "thermal switch M5x6 15°C off / 5°C on", desc: "SAP Part details from drawing" },
          { sapNo: "555273", name: "sealing plug type 50E3321-12AGV Alcoa®", desc: "SAP Part details from drawing" },
          { sapNo: "518480", name: "resistor power 150R 100W HS100 alu-box", desc: "SAP Part details from drawing" },
        ]
      },
      {
        id: "e92_rot_lubrication",
        name: "Central Lubrication (Merkezi Yağlama)",
        imageName: "23 central lubrication.PNG",
        parts: [
          { sapNo: "109994", name: "plug-in 06 M10x1 central lubrica Beka®", desc: "SAP Part details from drawing" },
          { sapNo: "88752", name: "support grease distributors 8209002-1", desc: "SAP Part details from drawing" },
          { sapNo: "119122", name: "pressure switch 210bar cls BEKA®", desc: "pressure switch type 8000 --8152-PL1-B-GE42-- adjusted to 210 bar" },
          { sapNo: "108537", name: "grease plunger 6. 4124-0049 BEKA®", desc: "Six-figure grease distributor (Art.No. 4124 0049) for BEKA® central lubrication system E-70/E-82. Inclusive fittings and manometer, without grease filling. Dosing unit: 3 x 0,1cm³ / 3 x 0,4cm³.For greasing the front main bearing (three-figure) and gear rim pitch control (three-figure)." },
          { sapNo: "108538", name: "grease plunger 6. 4124-0051 BEKA®", desc: "Six-figure grease distributor (Art.No. 4124 0051) for BEKA® central lubrication system E-70/E-82. Inclusive fittings, without grease filling. Dosing unit: 6 x 0,1cm³.For greasing pitch bearing B." },
          { sapNo: "108540", name: "grease plunger 6. 4124-0052 BEKA®", desc: "Six-figure grease distributor (Art.No. 4124 0052) for BEKA® central lubrication system E-70/E-82. Inclusive fittings, without grease filling. Dosing unit: 6 x 0,1cm³.For greasing pitch bearing C." },
          { sapNo: "108541", name: "grease plunger 9. 4124-0050 BEKA®", desc: "Nine-figure grease distributor (Art.No. 4124 0050) for BEKA® central lubrication system E-70/E-82. Inclusive fittings , without grease filling. Dosing unit: 9 x 0,1cm³.For greasing pitch bearing A (six-figure) and gear rim pitch control (three-figure)." },
          { sapNo: "108945", name: "swivelling screw-fitting lubrica BEKA®", desc: "SAP Part details from drawing" },
          { sapNo: "692873", name: "upgrade kit empty s. CLS FKGGM-EPR Beka®", desc: "SAP Part details from drawing" },
          { sapNo: "156216", name: "connecting cable cmpl. ZS-Pumpe BEKA®", desc: "SAP Part details from drawing" },
          { sapNo: "105004", name: "central lubrica pumping E82 E2 BEKA®", desc: "Lubrication pump BEKA® for central lubrication turbine E-82 E2 and for central lubrication yaw bearing turbine E-101/E-115. Electrical lubrication pump type FKGGM-EPR filled with grease Klüberplex BEM 41-141 NLGI 1 (yellow grease). contents of the container:         4l max. operating pressure:     300 bar pressure limitation valve: 280 bar operating voltage:       100-250V/AC" },
          { sapNo: "109135", name: "sealing edge ring Z-pump V2 Vogel®", desc: "sealing ring for the swivelling screw (connection screw for the grease pipe) on the central lubrication pump V2 Vogel®" },
          { sapNo: "18294", name: "pressure gauge 0-250 bar", desc: "SAP Part details from drawing" },
          { sapNo: "90945", name: "grease plunger V2 100mm³ 3adjus. Vogel", desc: "ATTENTION! Without fittings and grease! replaced by 104167" },
          { sapNo: "90946", name: "grease plunger V2 100mm³ 6adjus. Vogel", desc: "replaced by SAP 104169 , 104170 , 104171 or 104172 according installation location (attend comments from these SAP numbers!)  ; ATTE  NTION! SAP 90946 is without fittings and grease!" },
          { sapNo: "90947", name: "grease plunger V2 100mm³ 9adjus. Vogel", desc: "ATTENTION! Without fittings and grease! Only for turbines with central lubrication pump in the rotor hub! replaced by SAP 104177" },
          { sapNo: "99066", name: "high-pressure hose 2SN-DN8 2XDKOL 1500mm", desc: "SAP Part details from drawing" },
          { sapNo: "99586", name: "lubricating point pipe RO6x1.25 BEM41-14", desc: "1 VE = 12,5 M. application: lubricating point pipe WVN715-RO6x1,25  filled with Klüberplex BEM 41 - 141 (yellow grease) for the central lubrica E-82/E2 manufacturer Vogel®. alternative / replaced by: SAP 164730 lubricating point pipe PA12H 6x1.5 natur (without grease)." },
          { sapNo: "164730", name: "lubricating point pipe PA12H 6x1.5 natur", desc: "application: lubricating point pipe PA12H 6x1.5 natur (without grease) suitable for all central lubrication !" },
          { sapNo: "109134", name: "swivelling screw- Z-pump V2 SKF®", desc: "screw connection (swivelling version) for the grease pipe on the central lubrication pump V2 Vogel®" },
          { sapNo: "114289", name: "SAP Part 114289", desc: "Part details from drawing" },
          { sapNo: "93151", name: "plug valve SVS BF A18 MURR® 29161", desc: "Art.No.7000-29161 -J01 for feed-in pump" },
          { sapNo: "93153", name: "plug valve SVS BF A18 MURR® 29401", desc: "Art.no.7000-29401 -J03 for level indicator and -J04 for press switch at front bearing" },
          { sapNo: "93152", name: "plug valve SVS BF A18 MURR® 29521", desc: "Art.No.7000-29521 -J02 for the 3/2 way valve" },
          { sapNo: "92244", name: "central lubrica pumping V2 E82 E2 Vogel®", desc: "new version central lubrication pump from Vogel® (manufacturer SKF) for central lubrication turbine E-82 E2 and for central lubrication yaw bearing turbine E-101/E-115. central lubrication pump Vogel® (manufacturer SKF). lubrication pump type: KFG004EMXAOAC4049 - 230AC. art.no.: 772-000-9007. ffilled with greas Klüberplex BEM 41-141 (yellow grease). contents of the container: 4l." },
        ]
      }
    ],
    tower: [
      {
        id: "e92_tow_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e92_tow_emodule",
        name: "E-Module (Güç Modülü)",
        imageName: "2 e-module.PNG",
        parts: []
      },
      {
        id: "e92_tow_mv_remote",
        name: "Medium Voltage Remote Control",
        imageName: "3 MV remote control.PNG",
        parts: []
      },
      {
        id: "e92_tow_control_cabinet",
        name: "Tower Base Control Cabinet",
        imageName: "4 control cabinet.PNG",
        parts: []
      },
      {
        id: "e92_tow_5_control_cabinettt",
        name: "Control Cabinettt (Kontrol Kabini 5)",
        imageName: "5 control cabinettt.PNG",
        parts: []
      },
      {
        id: "e92_tow_6_control_cabinet_door",
        name: "Control Cabinet Door (Kontrol Kabini 6)",
        imageName: "6 control cabinet door.PNG",
        parts: []
      },
      {
        id: "e92_tow_7_recirculation_air_system",
        name: "Recirculation Air System (Şema 7)",
        imageName: "7 recirculation air system.PNG",
        parts: []
      },
      {
        id: "e92_tow_ups_cabinet",
        name: "UPS Cabinet (Güç Kaynağı)",
        imageName: "8 ups cabinet.PNG",
        parts: []
      },
      {
        id: "e92_tow_9_ups_cabinetttt",
        name: "Ups Cabinetttt (UPS Güç Kaynağı 9)",
        imageName: "9 ups cabinetttt.PNG",
        parts: []
      }
    ]
  },
  "E70": {
    nacelle: [
      {
        id: "e70_nac_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e70_nac_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e70_nac_anemometer",
        name: "Anemometer & Wind Sensors",
        imageName: "3 anemometer.PNG",
        parts: []
      },
      {
        id: "e70_nac_yaw_gear",
        name: "Yaw Gear (Azimuth Dişli Kutusu)",
        imageName: "4 yaw gear.PNG",
        parts: []
      },
      {
        id: "e70_nac_yaw_motor",
        name: "Yaw Motor (Azimuth Motor)",
        imageName: "5 yaw motor.PNG",
        parts: [
          { sapNo: "136212", name: "Yaw Motor Emod (m.WE)", desc: "Emod type: 112M/6 BRE40 RG WUX rating = 2.2KW" },
          { sapNo: "543644", name: "Brake 45Nm Emod", desc: "Brake 45Nm FDB 15.469-001 2.2KW Emod" },
          { sapNo: "103120", name: "Speed Pulsor Sensor", desc: "Pulsor 10-35VDC/2S KJ4-D70KN-DPS2-X0115", alternativeSap: "86842" },
        ]
      },
      {
        id: "e70_nac_6_beacon_system",
        name: "Beacon System (İkaz Lambası 6)",
        imageName: "6 beacon system.PNG",
        parts: []
      },
      {
        id: "e70_nac_7_chain_demag",
        name: "Chain Demag (Şema 7)",
        imageName: "7 chain demag.PNG",
        parts: []
      },
      {
        id: "e70_nac_8_chainn_demag",
        name: "Chainn Demag (Şema 8)",
        imageName: "8 chainn demag.PNG",
        parts: []
      },
      {
        id: "e70_nac_9_chain_planeta__star_lift",
        name: "Chain Planeta- Star Lift (Şema 9)",
        imageName: "9 chain planeta- star lift.PNG",
        parts: []
      },
      {
        id: "e70_nac_electric_brake",
        name: "Electric Brake (Elektrikli Fren)",
        imageName: "10 elektric brake.PNG",
        parts: []
      },
      {
        id: "e70_nac_excitation",
        name: "Excitation System (Uyarım)",
        imageName: "11 excitation v1.0.PNG",
        parts: []
      },
      {
        id: "e70_nac_12_ex__v2_0",
        name: "Ex. V2.0 (Şema 12)",
        imageName: "12 ex. v2.0.PNG",
        parts: []
      },
      {
        id: "e70_nac_13_ex__v2_0_1",
        name: "Ex. V2.0-1 (Şema 13)",
        imageName: "13 ex. v2.0-1.PNG",
        parts: []
      },
      {
        id: "e70_nac_13_ex__v3_0",
        name: "Ex. V3.0 (Şema 13)",
        imageName: "13 ex. v3.0.PNG",
        parts: []
      },
      {
        id: "e70_nac_14_generator_filter_cabinet",
        name: "Generator Filter Cabinet (Jeneratör 14)",
        imageName: "14 generator filter cabinet.PNG",
        parts: []
      },
      {
        id: "e70_nac_15_nacella_fan",
        name: "Nacella Fan (Şema 15)",
        imageName: "15 nacella fan.PNG",
        parts: []
      },
      {
        id: "e70_nac_16_fan_motor",
        name: "Fan Motor (Şema 16)",
        imageName: "16 fan motor.PNG",
        parts: []
      },
      {
        id: "e70_nac_rectifier",
        name: "Rectifier (Doğrultucu)",
        imageName: "17 rectifier.PNG",
        parts: []
      },
      {
        id: "e70_nac_control_cabinet",
        name: "Nacelle Control Cabinet",
        imageName: "18 control cabinet.PNG",
        parts: []
      },
      {
        id: "e70_nac_18_rec",
        name: "Rec (Şema 18)",
        imageName: "18 rec.PNG",
        parts: []
      },
      {
        id: "e70_nac_20_control_cab",
        name: "Control Cab (Şema 20)",
        imageName: "20 control cab.PNG",
        parts: []
      },
      {
        id: "e70_nac_21_control_cabbb",
        name: "Control Cabbb (Şema 21)",
        imageName: "21 control cabbb.PNG",
        parts: []
      },
      {
        id: "e70_nac_22_cable_twist",
        name: "Cable Twist (Şema 22)",
        imageName: "22 cable twist.PNG",
        parts: []
      },
      {
        id: "e70_nac_23_main_carrier",
        name: "Main Carrier (Şema 23)",
        imageName: "23 main carrier.PNG",
        parts: []
      },
      {
        id: "e70_nac_rotor_lock",
        name: "Rotor Lock (Rotor Kilidi)",
        imageName: "24 rotor lock.PNG",
        parts: []
      },
      {
        id: "e70_nac_25",
        name: "25. Şema (Drawing 25)",
        imageName: "25.PNG",
        parts: []
      },
      {
        id: "e70_nac_26_stator_subdisturbition",
        name: "Stator Subdisturbition (Alt Dağıtım 26)",
        imageName: "26 stator subdisturbition.PNG",
        parts: []
      },
      {
        id: "e70_nac_yaw_cabinet",
        name: "Yaw Cabinet (Azimuth Paneli)",
        imageName: "27 yaw cabinet.PNG",
        parts: []
      },
      {
        id: "e70_nac_28_yaw_cabinet_devam",
        name: "Yaw Cabinet Devam (Şema 28)",
        imageName: "28 yaw cabinet devam.PNG",
        parts: []
      }
    ],
    rotor: [
      {
        id: "e70_rot_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e70_rot_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e70_rot_3_blade",
        name: "Blade (Rüzgar Kanadı 3)",
        imageName: "3 blade.PNG",
        parts: []
      },
      {
        id: "e70_rot_4_blade_heatin",
        name: "Blade Heatin (Rüzgar Kanadı 4)",
        imageName: "4 blade heatin.PNG",
        parts: []
      },
      {
        id: "e70_rot_5_blade_heating",
        name: "Blade Heating (Kanat Isıtma 5)",
        imageName: "5 blade heating.PNG",
        parts: []
      },
      {
        id: "e70_rot_6_blade_heattt",
        name: "Blade Heattt (Rüzgar Kanadı 6)",
        imageName: "6 blade heattt.PNG",
        parts: []
      },
      {
        id: "e70_rot_7_blade_heatting",
        name: "Blade Heatting (Rüzgar Kanadı 7)",
        imageName: "7 blade heatting.PNG",
        parts: []
      },
      {
        id: "e70_rot_8_load_control",
        name: "Load Control (Şema 8)",
        imageName: "8 load control.PNG",
        parts: []
      },
      {
        id: "e70_rot_pitch_box",
        name: "Pitch Box (Hatve Kutusu)",
        imageName: "9 pitch box.PNG",
        parts: []
      },
      {
        id: "e70_rot_relay_box",
        name: "Relay Box (Röle Kutusu)",
        imageName: "10 relay box.PNG",
        parts: []
      },
      {
        id: "e70_rot_pitch_gear",
        name: "Pitch Gear (Hatve Dişlisi)",
        imageName: "11 pitch gear.PNG",
        parts: []
      },
      {
        id: "e70_rot_pitch_motor",
        name: "Pitch Motor (Hatve Motoru)",
        imageName: "12 pitch motor.PNG",
        parts: []
      },
      {
        id: "e70_rot_13_generator",
        name: "Generator (Jeneratör 13)",
        imageName: "13 generator.PNG",
        parts: []
      },
      {
        id: "e70_rot_capacitor_box",
        name: "Capacitor Box (Kapasitör)",
        imageName: "14 capacitor box.PNG",
        parts: []
      },
      {
        id: "e70_rot_15_capacitor_boxx",
        name: "Capacitor Boxx (Kapasitör Grubu 15)",
        imageName: "15 capacitor boxx.PNG",
        parts: []
      },
      {
        id: "e70_rot_16_capacitor_boxxx",
        name: "Capacitor Boxxx (Kapasitör Grubu 16)",
        imageName: "16 capacitor boxxx.PNG",
        parts: []
      },
      {
        id: "e70_rot_17_compact_limit_switch",
        name: "Compact Limit Switch (Şema 17)",
        imageName: "17 compact limit switch.PNG",
        parts: []
      },
      {
        id: "e70_rot_18_subdisturbition",
        name: "Subdisturbition (Alt Dağıtım 18)",
        imageName: "18 subdisturbition.PNG",
        parts: []
      },
      {
        id: "e70_rot_19_rotor_blade",
        name: "Rotor Blade (Rüzgar Kanadı 19)",
        imageName: "19 rotor blade.PNG",
        parts: []
      },
      {
        id: "e70_rot_20_trafo_box",
        name: "Trafo Box (Şema 20)",
        imageName: "20 trafo box.PNG",
        parts: []
      },
      {
        id: "e70_rot_21_rotor_sub_dis",
        name: "Rotor Sub Dis. (Alt Dağıtım 21)",
        imageName: "21 rotor sub dis..PNG",
        parts: []
      },
      {
        id: "e70_rot_slip_ring",
        name: "Slip Ring Unit (Kolektör)",
        imageName: "22 slip ring unit.PNG",
        parts: []
      },
      {
        id: "e70_rot_23_sru_cable",
        name: "Sru Cable (Şema 23)",
        imageName: "23 sru cable.PNG",
        parts: []
      },
      {
        id: "e70_rot_lubrication",
        name: "Central Lubrication (Merkezi Yağlama)",
        imageName: "24 central lubrication vogel.PNG",
        parts: []
      },
      {
        id: "e70_rot_25_lub__lincoln",
        name: "Lub. Lincoln (Şema 25)",
        imageName: "25 lub. lincoln.PNG",
        parts: []
      },
      {
        id: "e70_rot_25_lub__vogel",
        name: "Lub. Vogel (Şema 25)",
        imageName: "25 lub. vogel.PNG",
        parts: []
      },
      {
        id: "e70_rot_26_lub__lincoln_v2",
        name: "Lub. Lincoln V2 (Şema 26)",
        imageName: "26 lub. lincoln v2.PNG",
        parts: []
      },
      {
        id: "e70_rot_27_lub__beka",
        name: "Lub. Beka (Şema 27)",
        imageName: "27 lub. beka.PNG",
        parts: []
      }
    ],
    tower: [
      {
        id: "e70_tow_1_lighting_system",
        name: "Lighting System (Şema 1)",
        imageName: "1 lighting system.PNG",
        parts: []
      },
      {
        id: "e70_tow_chopper",
        name: "Chopper Cabinet",
        imageName: "2 chopper cabinet.PNG",
        parts: []
      },
      {
        id: "e70_tow_dc_dist",
        name: "DC Distribution Cabinet",
        imageName: "3 dc distribution.PNG",
        parts: []
      },
      {
        id: "e70_tow_4_transformer_level",
        name: "Transformer Level (Trafo 4)",
        imageName: "4 transformer level.PNG",
        parts: []
      },
      {
        id: "e70_tow_5_remote_control_cabinet",
        name: "Remote Control Cabinet (Kontrol Kabini 5)",
        imageName: "5 remote control cabinet.PNG",
        parts: []
      },
      {
        id: "e70_tow_6_lv_distribution",
        name: "Lv Distribution (Şema 6)",
        imageName: "6 LV distribution.PNG",
        parts: []
      },
      {
        id: "e70_tow_7_lv_distribution",
        name: "Lv Distribution (Şema 7)",
        imageName: "7 LV distribution.PNG",
        parts: []
      },
      {
        id: "e70_tow_control_cabinet",
        name: "Tower Control Cabinet",
        imageName: "8 control cabinet.PNG",
        parts: []
      },
      {
        id: "e70_tow_9_control_cabinett",
        name: "Control Cabinett (Kontrol Kabini 9)",
        imageName: "9 control cabinett.PNG",
        parts: []
      },
      {
        id: "e70_tow_10_control_cabinettt",
        name: "Control Cabinettt (Kontrol Kabini 10)",
        imageName: "10 control cabinettt.PNG",
        parts: []
      },
      {
        id: "e70_tow_11_door_control_cabinet",
        name: "Door Control Cabinet (Kontrol Kabini 11)",
        imageName: "11 door control cabinet.PNG",
        parts: []
      },
      {
        id: "e70_tow_12_transformer_protection",
        name: "Transformer Protection (Trafo 12)",
        imageName: "12 transformer protection.PNG",
        parts: []
      },
      {
        id: "e70_tow_12_transformer",
        name: "Transformer (Trafo 12)",
        imageName: "12 transformer.PNG",
        parts: []
      },
      {
        id: "e70_tow_ups",
        name: "UPS Cabinet (Güç Kaynağı)",
        imageName: "13 ups.PNG",
        parts: []
      },
      {
        id: "e70_tow_14_upsss",
        name: "Upsss (UPS Güç Kaynağı 14)",
        imageName: "14 upsss.PNG",
        parts: []
      },
      {
        id: "e70_tow_15_ups_v2_0",
        name: "Ups V2.0 (UPS Güç Kaynağı 15)",
        imageName: "15 ups v2.0.PNG",
        parts: []
      },
      {
        id: "e70_tow_16_ups_v2_00",
        name: "Ups V2.00 (UPS Güç Kaynağı 16)",
        imageName: "16 ups v2.00.PNG",
        parts: []
      },
      {
        id: "e70_tow_customer_interface",
        name: "Customer Interface",
        imageName: "customer interface.PNG",
        parts: []
      }
    ]
  },
  "E44": {
    nacelle: [
      {
        id: "e44_nac_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e44_nac_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e44_nac_3",
        name: "3. Şema (Drawing 3)",
        imageName: "3.PNG",
        parts: []
      },
      {
        id: "e44_nac_4",
        name: "4. Şema (Drawing 4)",
        imageName: "4.PNG",
        parts: []
      },
      {
        id: "e44_nac_5",
        name: "5. Şema (Drawing 5)",
        imageName: "5.PNG",
        parts: []
      },
      {
        id: "e44_nac_6",
        name: "6. Şema (Drawing 6)",
        imageName: "6.PNG",
        parts: []
      },
      {
        id: "e44_nac_7",
        name: "7. Şema (Drawing 7)",
        imageName: "7.PNG",
        parts: []
      },
      {
        id: "e44_nac_8",
        name: "8. Şema (Drawing 8)",
        imageName: "8.PNG",
        parts: []
      },
      {
        id: "e44_nac_9",
        name: "9. Şema (Drawing 9)",
        imageName: "9.PNG",
        parts: []
      },
      {
        id: "e44_nac_10",
        name: "10. Şema (Drawing 10)",
        imageName: "10.PNG",
        parts: []
      },
      {
        id: "e44_nac_11_beacon_v6_0",
        name: "Beacon V6.0 (İkaz Lambası 11)",
        imageName: "11 beacon v6.0.PNG",
        parts: []
      },
      {
        id: "e44_nac_12_beacon_v6_0",
        name: "Beacon V6.0 (İkaz Lambası 12)",
        imageName: "12 beacon v6.0.PNG",
        parts: []
      },
      {
        id: "e44_nac_13",
        name: "13. Şema (Drawing 13)",
        imageName: "13.PNG",
        parts: []
      },
      {
        id: "e44_nac_brake_unit",
        name: "Brake Unit SIME / Willmann",
        imageName: "14 brake unit.PNG",
        parts: [
          { sapNo: "40776", name: "Ventilation Screw G1/2", desc: "Kroning (old version) and Sime aggregates for fluid tank" },
          { sapNo: "80800", name: "Hydraulic Aggregate SIME", desc: "Replaced by: SAP 80797 KRONING E40", alternativeSap: "80797" },
          { sapNo: "71414", name: "Pressure Relief Valve", desc: "Brake aggregate type 0512-06 pressure relief valve" },
          { sapNo: "15752", name: "Pressure Switch 801-200-281", desc: "Pressure switch for Willmann" },
          { sapNo: "46927", name: "Connector with Rectifier 220V", desc: "Connector with rectifier for brake aggregates" },
          { sapNo: "80796", name: "Hydraulic Aggregate Willmann", desc: "Alternative: SAP 80797 KRONING E40", alternativeSap: "80797" },
          { sapNo: "94871", name: "Magnetic Coil 220VAC 18W", desc: "Replacement coil for Willmann hydraulic aggregate" },
          { sapNo: "71444", name: "Nonreturn Valve Willmann", desc: "Nonreturn valve for Willmann brake aggregate" },
          { sapNo: "71447", name: "Directional Valve 2/2 EA", desc: "Directional valve 2/2 EA for Willmann brake aggregate" },
        ]
      },
      {
        id: "e44_nac_15",
        name: "15. Şema (Drawing 15)",
        imageName: "15.PNG",
        parts: []
      },
      {
        id: "e44_nac_16",
        name: "16. Şema (Drawing 16)",
        imageName: "16.PNG",
        parts: []
      },
      {
        id: "e44_nac_17",
        name: "17. Şema (Drawing 17)",
        imageName: "17.PNG",
        parts: []
      },
      {
        id: "e44_nac_18",
        name: "18. Şema (Drawing 18)",
        imageName: "18.PNG",
        parts: []
      },
      {
        id: "e44_nac_19",
        name: "19. Şema (Drawing 19)",
        imageName: "19.PNG",
        parts: []
      },
      {
        id: "e44_nac_20",
        name: "20. Şema (Drawing 20)",
        imageName: "20.PNG",
        parts: []
      },
      {
        id: "e44_nac_21",
        name: "21. Şema (Drawing 21)",
        imageName: "21.PNG",
        parts: []
      },
      {
        id: "e44_nac_22",
        name: "22. Şema (Drawing 22)",
        imageName: "22.PNG",
        parts: []
      },
      {
        id: "e44_nac_control_cabinet",
        name: "Nacelle Control Cabinet",
        imageName: "23 control cabinet.PNG",
        parts: []
      },
      {
        id: "e44_nac_24",
        name: "24. Şema (Drawing 24)",
        imageName: "24.PNG",
        parts: []
      },
      {
        id: "e44_nac_25",
        name: "25. Şema (Drawing 25)",
        imageName: "25.PNG",
        parts: []
      },
      {
        id: "e44_nac_26",
        name: "26. Şema (Drawing 26)",
        imageName: "26.PNG",
        parts: []
      },
      {
        id: "e44_nac_27",
        name: "27. Şema (Drawing 27)",
        imageName: "27.PNG",
        parts: []
      },
      {
        id: "e44_nac_28",
        name: "28. Şema (Drawing 28)",
        imageName: "28.PNG",
        parts: []
      },
      {
        id: "e44_nac_29",
        name: "29. Şema (Drawing 29)",
        imageName: "29.PNG",
        parts: []
      },
      {
        id: "e44_nac_30",
        name: "30. Şema (Drawing 30)",
        imageName: "30.PNG",
        parts: []
      },
      {
        id: "e44_nac_31",
        name: "31. Şema (Drawing 31)",
        imageName: "31.PNG",
        parts: []
      },
      {
        id: "e44_nac_yaw_cabinet",
        name: "Yaw Cabinet (Azimuth Paneli)",
        imageName: "32 yaw cabinet.PNG",
        parts: []
      }
    ],
    rotor: [
      {
        id: "e44_rot_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e44_rot_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e44_rot_3",
        name: "3. Şema (Drawing 3)",
        imageName: "3.PNG",
        parts: []
      },
      {
        id: "e44_rot_4",
        name: "4. Şema (Drawing 4)",
        imageName: "4.PNG",
        parts: []
      },
      {
        id: "e44_rot_blade_heating",
        name: "Blade Heating (Isıtma Grubu)",
        imageName: "5 blade heating.PNG",
        parts: []
      },
      {
        id: "e44_rot_6",
        name: "6. Şema (Drawing 6)",
        imageName: "6.PNG",
        parts: []
      },
      {
        id: "e44_rot_pitch_box",
        name: "Pitch Box (Hatve Kutusu)",
        imageName: "9 pitch box.PNG",
        parts: []
      },
      {
        id: "e44_rot_relay_box_v1",
        name: "Relay Box V1.0 (Röle Kutusu)",
        imageName: "10 relay box v1.0.PNG",
        parts: []
      },
      {
        id: "e44_rot_relay_box_v2",
        name: "Relay Box V2.0 (Röle Kutusu)",
        imageName: "11 relay box v2.0.PNG",
        parts: []
      },
      {
        id: "e44_rot_pitch_gear",
        name: "Pitch Gear (Hatve Dişlisi)",
        imageName: "12 pitch gear.PNG",
        parts: []
      },
      {
        id: "e44_rot_pitch_motor",
        name: "Pitch Motor (Hatve Motoru)",
        imageName: "13 pitch motor.PNG",
        parts: [
          { sapNo: "70659", name: "Pitch Motor Emod E48 1.5KW", desc: "Emod type: GKNB 112 / 4-120x rating = 1.5 kW" },
          { sapNo: "119255", name: "Brake 50Nm Mayr Emod", desc: "Brake for pitchmotor E-48 Emod GKNB 112/4-120X" },
          { sapNo: "63201", name: "Pitch Motor Ramme E48 1.5KW", desc: "Ramme type: GN 112 S4 rating = 1.5 kW" },
          { sapNo: "63202", name: "Pitch Motor Ramme E48 INDIA", desc: "Ramme type: GM 112 S4 rating = 1.5 kW" },
          { sapNo: "97439", name: "Brake 50Nm KEB", desc: "Brake 50Nm KEB 05.28.G10-0277 / 105VDC/50Nm" },
          { sapNo: "60433", name: "Pitch Motor Ruckh E48 1.5KW", desc: "Ruckh type: Pitch E48 rating = 1.5 kW" },
          { sapNo: "60434", name: "Pitch Motor Ruckh E48 INDIA", desc: "Ruckh type: Pitch E48 rating = 1.5 kW" },
          { sapNo: "65217", name: "Brake 50Nm Ruckh", desc: "Brake 50Nm f.motor GN 112/4S Ruckh" },
          { sapNo: "61923", name: "Pitch Motor Weier E48 1.5KW", desc: "Weier type: GN 112 / 4 S rating = 1.5 kW" },
          { sapNo: "11242", name: "Pin Insert 16p Han 16 E", desc: "Pin insert 16p 380VAC 16A crimp term." },
          { sapNo: "10327", name: "Sleeve PG29 2 Levers", desc: "Sleeve h.40p PG29 vertical SWR 2 levers" },
        ]
      },
      {
        id: "e44_rot_14_lighting_conductor",
        name: "Lighting Conductor (Şema 14)",
        imageName: "14 lighting conductor.PNG",
        parts: []
      },
      {
        id: "e44_rot_15_generator",
        name: "Generator (Jeneratör 15)",
        imageName: "15 generator.PNG",
        parts: []
      },
      {
        id: "e44_rot_limit_switch",
        name: "Limit Switch (Sınır Anahtarı)",
        imageName: "16 compact limit switch.PNG",
        parts: []
      },
      {
        id: "e44_rot_capacitor_box",
        name: "Capacitor Box (Kapasitör)",
        imageName: "17 capacitor box.PNG",
        parts: []
      },
      {
        id: "e44_rot_18",
        name: "18. Şema (Drawing 18)",
        imageName: "18.PNG",
        parts: []
      },
      {
        id: "e44_rot_19_rotor_blade",
        name: "Rotor Blade (Rüzgar Kanadı 19)",
        imageName: "19 rotor blade.PNG",
        parts: []
      },
      {
        id: "e44_rot_20_rotor_bearing",
        name: "Rotor Bearing (Rulman / Yatak 20)",
        imageName: "20 rotor bearing.PNG",
        parts: []
      },
      {
        id: "e44_rot_21_rotor_subdisturbition",
        name: "Rotor Subdisturbition (Alt Dağıtım 21)",
        imageName: "21 rotor subdisturbition.PNG",
        parts: []
      },
      {
        id: "e44_rot_slip_ring",
        name: "Slip Ring Unit (Kolektör)",
        imageName: "22 slip ring.PNG",
        parts: []
      },
      {
        id: "e44_rot_23_slip_ring",
        name: "Slip Ring (Kolektör (Kayar Bilezik) 23)",
        imageName: "23 slip ring.PNG",
        parts: []
      }
    ],
    tower: [
      {
        id: "e44_tow_1",
        name: "1. Şema (Drawing 1)",
        imageName: "1.PNG",
        parts: []
      },
      {
        id: "e44_tow_2",
        name: "2. Şema (Drawing 2)",
        imageName: "2.PNG",
        parts: []
      },
      {
        id: "e44_tow_3",
        name: "3. Şema (Drawing 3)",
        imageName: "3.PNG",
        parts: []
      },
      {
        id: "e44_tow_4",
        name: "4. Şema (Drawing 4)",
        imageName: "4.PNG",
        parts: []
      },
      {
        id: "e44_tow_5_customer_interface",
        name: "Customer Interface (Müşteri Arayüzü 5)",
        imageName: "5 customer interface.PNG",
        parts: []
      },
      {
        id: "e44_tow_cabinet_6",
        name: "Power Cabinet (Güç Kabini 6)",
        imageName: "6 power cabinet.PNG",
        parts: [
          { sapNo: "37247", name: "cover plate for socket 800mm D0053901-1", desc: "300 KW power cabinets" },
          { sapNo: "32484", name: "cover sheet airlead D0051871-6", desc: "SAP Part details from drawing" },
          { sapNo: "32932", name: "cover top D0052991-3", desc: "plastic cover top power cabinet 300KW ; size: 670x610x4mm" },
          { sapNo: "33338", name: "cover below MAKROLON D0053651-3", desc: "plastic cover power cabinet 300KW V1.0    size: 535mm (from 450mm angled) x 430mm x 4mm" },
          { sapNo: "19653", name: "choke ENTK300 complete SIED00000", desc: "uncoupling choke for 300KW and 600KW power cabinet" },
          { sapNo: "11000025", name: "choke HSST300 compl. SIHD00000", desc: "boost converter choke 300KW/600KW ; replaced by SAP 60584 choke HSST300 V1.0 ass. for PWR V1.0" },
          { sapNo: "60584", name: "choke HSST300 V1.0 ass. for PWR V1.0", desc: "SAP Part details from drawing" },
          { sapNo: "11000035", name: "choke NETZ300 compl. right SIND00000", desc: "grid choke 300KW/600KW. replaced by: SAP 137363 choke NETZ300 ALU complete right" },
          { sapNo: "7080", name: "earth strip 16mm² 200mm hole :8,5/8,5", desc: "earth strip for cabinet door" },
          { sapNo: "56701", name: "heater fan 220-240VAC 250W HG Vario 250", desc: "replaced by SAP 77188", alternativeSap: "77188" },
          { sapNo: "3489", name: "heater fan 230V 250W FLH250", desc: "replaced by SAP 56701, SAP 64064 or SAP 77188", alternativeSap: "56701" },
          { sapNo: "64064", name: "heater fan 230V/250W ENERCON V1", desc: "replaced by SAP 77188", alternativeSap: "77188" },
          { sapNo: "77188", name: "heater fan 230V/250W ENERCON V2", desc: "SAP Part details from drawing" },
          { sapNo: "46872", name: "cable 25MM² H07V-K 1,7M M10/M08", desc: "SAP Part details from drawing" },
          { sapNo: "44786", name: "cable 185MM² H07V-K 1,2M M10/M10 45°", desc: "connection: diode module (-V30) heat sink unit 300KW HSST <----->  fuse (-F1) UGR+" },
          { sapNo: "44787", name: "cable 185mm² H07V-K 1,4m M10/M10 90°", desc: "connection: capacitor bank inverter minus plate <----->  fuse (-F2) UGR -" },
          { sapNo: "34658", name: "cable connection PWRXX06 300kW driver L1", desc: "assembly PCB driver heat sink unit 300KW L1 <---> PCB Inverter Control VX.X" },
          { sapNo: "34659", name: "cable connection PWRXX06 300kW driver L2", desc: "assembly PCB driver heat sink unit 300KW L2 <---> PCB Inverter Control VX.X" },
          { sapNo: "34660", name: "cable connection PWRXX06 300kW driver L3", desc: "assembly PCB driver heat sink unit 300KW L3 <---> PCB Inverter Control VX.X" },
          { sapNo: "34661", name: "cable connection PWRXX06 300kW driver HSST", desc: "assembly PCB driver heat sink unit 300KW HSST <---> PCB Inverter Control VX.X" },
          { sapNo: "59827", name: "cable connect. PWR 300kW V2 driver HSST", desc: "SAP Part details from drawing" },
          { sapNo: "44789", name: "cable PWRXX06 300kW 95mm² L2+/L2-", desc: "assembly heat sink 300kW L2 <----> grid choke L2" },
          { sapNo: "44790", name: "cable PWRXX06 300kW 95mm² L3+/L3-", desc: "assembly heat sink 300kW L3 <----> grid choke L3" },
          { sapNo: "59826", name: "cable PWRXX06 300kW V2 95mm² L1+/L1-", desc: "assembly heat sink 300kW L1 <----> grid choke L1" },
          { sapNo: "33973", name: "cable set PWRXX06 300kW power cabinet V1", desc: "cons. of:2x185²(+/-)5x95²(L1-3/LH+/-)1x25²(Chopper)4x(10x0,50+owg)f.driver" },
          { sapNo: "60198", name: "mounting plate heating fan V2 D0119029-0", desc: "look instruction s-e-07-ger-eng-05-022 , for 600KW power cabinet" },
          { sapNo: "60197", name: "mounting angle D0054611-0", desc: "look instruction s-e-07-ger-eng-05-022 , for 300KW power cabinet" },
          { sapNo: "34776", name: "PCB 300kW inverter supply V1.2", desc: "replaced by: SAP 711526 (V1.6). alternative: SAP 50081 (V1.5)", alternativeSap: "50081" },
          { sapNo: "50081", name: "PCB 300kW inverter supply V1.5", desc: "replaced by: SAP 711526 (V1.6). alternative: SAP 34776 (V1.2) with pcb current -limiter V1.1 (SAP 60186)", alternativeSap: "34776" },
          { sapNo: "60186", name: "PCB current-limiter V1.1 EXX", desc: "1 VE = 2 ST; adapter for SAP 34776 pcb 300kW inverter-supply V1.2 (or V1.0 / V1.1 / V1.3 / V1.4).  Information: instruction s-e-01-ger-eng-04-036 retrofitting Current-Limiter PCB is closed.  defect PCB Current-Limiter to exchange with PCB 300kW Inverter-Supply V1.5 (SAP 50081) !" },
          { sapNo: "33632", name: "pcb inverter control V1.1", desc: "alternative: SAP 42627 (V1.2); SAP 43365 (V1.3)", alternativeSap: "42627" },
          { sapNo: "43365", name: "pcb inverter control V1.3", desc: "SAP Part details from drawing" },
          { sapNo: "62227", name: "PCB inverter control V2.3", desc: "alternative: SAP 91419 (V2.7) ; SAP 77186 (V2.6) ; SAP 68893 (V2.5) , information: PCB necessary by FACTS control !", alternativeSap: "91419" },
          { sapNo: "68893", name: "PCB inverter control V2.5", desc: "replaced by SAP 91419 (V2.7) ; SAP 77186 (V2.6) ; SAP 62227 (V2.3)", alternativeSap: "91419" },
          { sapNo: "77186", name: "PCB inverter control V2.6", desc: "alternative first up: SAP 91419 (V2.7) ; SAP 68893 (V2.5) ; SAP 62227 (V2.3)", alternativeSap: "91419" },
          { sapNo: "91419", name: "PCB inverter control V2.7", desc: "alternative: SAP 77186 (V2.6) ; SAP 68893 (V2.5) ; SAP 62227 (V2.3)", alternativeSap: "77186" },
          { sapNo: "49216", name: "PWR 300kW V1 ENT", desc: "PWR 300kW V1 ENT = standard STD and dehumidification ENT and external chopper connection  replaced by: SAP 49215 PWR 300kW V1 STD (standard STD and dehumidification ENT and external connection)  alternative: SAP 65834 PWR 300kW V3 CW (standard STD and dehumidification ENT and internal chopper resistance CW) Attention: alternative (V3) only possible, look technical instruction TA s-e-01-ger-eng-05-024 Using the Inverter Control V2.3 PCB.  (look -> Show picture). In the turbine must all PCB version V1.x in the power cabinet PWR 300KW V1 exchanged about PCB version V2.x (SAP 62227 V2.3 or SAP 68893 V2.5 or SAP 77186 V2.6)  again one plug 8p. (SAP 59818) for one PCB Inverter Control V2.x", alternativeSap: "49215" },
          { sapNo: "49218", name: "PWR 300kW V1 NZM", desc: "disabled information: only order by technical section leader !  PWR 300kW V1 NZM = with power switch NZM and dehumidification ENT and external chopper connection alternative:  SAP 65835 PWR 300kW V3 NZM CW (with power switch NZM and dehumidification ENT and internal chopper resistance CW)  Attention:  alternative (V3) only possible, look technical instruction TA s-e-01-ger-eng-05-024 Using the Inverter Control V2.3 PCB.  (look -> Show picture). In the turbine must all PCB version V1.x in the power cabinet PWR 300KW V1 exchanged about PCB version V2.x (SAP 62227 V2.3 or SAP 68893 V2.5 or SAP 77186 V2.6)  again one plug 8p. (SAP 59818) for one PCB Inverter Control V2.x", alternativeSap: "65835" },
          { sapNo: "49217", name: "PWR 300kW V1 NZM ENT", desc: "disabled information: only order by technical section leader !  PWR 300kW V1 NZM ENT = with power switch NZM and dehumidification ENT and external chopper connection alternative:  SAP 65835 PWR 300kW V3 NZM CW (with power switch NZM and dehumidification ENT and internal chopper resistance CW)  Attention:  alternative (V3) only possible, look technical instruction TA s-e-01-ger-eng-05-024 Using the Inverter Control V2.3 PCB.  (look -> Show picture). In the turbine must all PCB version V1.x in the power cabinet PWR 300KW V1 exchanged about PCB version V2.x (SAP 62227 V2.3 or SAP 68893 V2.5 or SAP 77186 V2.6)  again one plug 8p. (SAP 59818) for one PCB Inverter Control V2.x", alternativeSap: "65835" },
          { sapNo: "49215", name: "PWR 300kW V1 STD", desc: "disabled information: only order by technical section leader !  PWR 300kW V1 STD = standard STD and dehumidification ENT and external chopper connection alternative:  SAP 65834 PWR 300kW V3 CW (standard STD and dehumidification ENT and internal chopper resistance CW )  Attention:  alternative only possible, look technical instruction TA s-e-01-ger-eng-05-024 Using the Inverter Control V2.3 PCB.  (look -> Show picture). In the turbine must all PCB version V1.x in the power cabinet PWR 300KW V1 exchanged about PCB version V2.x (SAP 62227 V2.3 or SAP 68893 V2.5 or SAP 77186 V2.6)  again one plug 8p. (SAP 59818) for one PCB Inverter Control V2.x", alternativeSap: "65834" },
          { sapNo: "32145", name: "bar minus- left D0051831-3a", desc: "alternative: SAP 92379 and with 4 pc. SAP 83052 or SAP 91308.", alternativeSap: "92379" },
        ]
      },
      {
        id: "e44_tow_7_power_cabinet",
        name: "Power Cabinet (Güç Kabini 7)",
        imageName: "7 power cabinet.PNG",
        parts: []
      },
      {
        id: "e44_tow_8_power_cabinet",
        name: "Power Cabinet (Güç Kabini 8)",
        imageName: "8 power cabinet.PNG",
        parts: []
      },
      {
        id: "e44_tow_cabinet_10",
        name: "Power Cabinet (Güç Kabini 10)",
        imageName: "10 power cabinet.PNG",
        parts: [
          { sapNo: "31756", name: "Cover DC-link-interface PWR D0051451-7", desc: "cover power cabinet 305x255x4mm" },
          { sapNo: "25812", name: "Capacitor 14000µF 400V ELKO d=90 M2", desc: "manufacturer: Epcos" },
          { sapNo: "33432", name: "PCB DC-link-interface V1.1", desc: "alternative: SAP 65879 (V1.2); SAP 582636 (V2.0)", alternativeSap: "65879" },
          { sapNo: "65879", name: "PCB DC-link-interface V1.2", desc: "alternative: SAP 33432 (V1.1); SAP 582636 (V2.0)", alternativeSap: "33432" },
          { sapNo: "54103", name: "PCB ic-symmetry V1.0", desc: "pcb ic-symmetry" },
          { sapNo: "33333", name: "Overvoltage Arrester Compl. VAL-MS230", desc: "replacement for SAP 1381-, base socket + plug" },
          { sapNo: "33381", name: "Overvoltage Arrester VAL-MS230ST", desc: "plug (insert) in touch with SAP 33375" },
          { sapNo: "33375", name: "Overvoltage Arrester VAL-MSBE", desc: "base socket for SAP 33381 or SAP 19921" },
          { sapNo: "21198", name: "Resistor Power 2k7 GRF 30/120S", desc: "balance resistor" },
          { sapNo: "32009", name: "Capacitor Bank Inverter 300KW EXX", desc: "alternative: SAP 68230 (V2)", alternativeSap: "68230" },
          { sapNo: "27295", name: "Conical Spring Washer DIN6796 08x18x02Z", desc: "alternative / replaced by: SAP 680817", alternativeSap: "680817" },
          { sapNo: "15886", name: "Chopper-module 1200V CM800E2UA-24F hi", desc: "application for heat sink units in power cabinet." },
          { sapNo: "15887", name: "Chopper-module 1200V CM800E3UA-24F lo", desc: "application for heat sink units in power cabinet." },
          { sapNo: "50831", name: "Diode Module 600A/1600V SKKE600/1", desc: "alternative: SAP 16960", alternativeSap: "16960" },
          { sapNo: "16960", name: "Diode Module EUPEC® DZ600N12K", desc: "alternative: SAP 50831", alternativeSap: "50831" },
          { sapNo: "68147", name: "PCB IGBT-driver CM800 V1.1", desc: "alternative: SAP 91710 (V1.2) ; SAP 60739 (V1.0)", alternativeSap: "91710" },
          { sapNo: "91710", name: "PCB IGBT-driver CM800 V1.2", desc: "alternative: SAP 68147 (V1.1) ; SAP 60739 (V1.0)", alternativeSap: "68147" },
          { sapNo: "60739", name: "PCB IGBT-driver CM800 V1.0", desc: "alternative: SAP 91710 (V1.2) ; SAP 68147 (V1.1) ; SAP 33437 (V1.1 old version)", alternativeSap: "91710" },
        ]
      },
      {
        id: "e44_tow_11_power_cabinet",
        name: "Power Cabinet (Güç Kabini 11)",
        imageName: "11 power cabinet.PNG",
        parts: []
      },
      {
        id: "e44_tow_12_power_cabinet",
        name: "Power Cabinet (Güç Kabini 12)",
        imageName: "12 power cabinet.PNG",
        parts: []
      },
      {
        id: "e44_tow_13_pc_v2_0",
        name: "Pc V2.0 (Şema 13)",
        imageName: "13 pc v2.0.PNG",
        parts: []
      },
      {
        id: "e44_tow_14_pc",
        name: "Pc (Şema 14)",
        imageName: "14 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_15_pc",
        name: "Pc (Şema 15)",
        imageName: "15 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_16_pc",
        name: "Pc (Şema 16)",
        imageName: "16 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_17_pc",
        name: "Pc (Şema 17)",
        imageName: "17 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_18_pc_v3_0",
        name: "Pc V3.0 (Şema 18)",
        imageName: "18 pc v3.0.PNG",
        parts: []
      },
      {
        id: "e44_tow_19_pc",
        name: "Pc (Şema 19)",
        imageName: "19 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_20_pc",
        name: "Pc (Şema 20)",
        imageName: "20 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_21_pc",
        name: "Pc (Şema 21)",
        imageName: "21 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_22_pc",
        name: "Pc (Şema 22)",
        imageName: "22 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_23_pc",
        name: "Pc (Şema 23)",
        imageName: "23 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_24_pc",
        name: "Pc (Şema 24)",
        imageName: "24 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_25_pc",
        name: "Pc (Şema 25)",
        imageName: "25 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_26_pc",
        name: "Pc (Şema 26)",
        imageName: "26 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_27_pc",
        name: "Pc (Şema 27)",
        imageName: "27 pc.PNG",
        parts: []
      },
      {
        id: "e44_tow_remote",
        name: "Remote Control Panel",
        imageName: "28 remote control.PNG",
        parts: [
          { sapNo: "2900", name: "Battery Lead- free of maint. 12V 3,4Ah", desc: "replaced by: SAP 779736 battery lead- AGM 12V 3,2Ah", alternativeSap: "779736" },
          { sapNo: "779736", name: "Battery Lead- AGM 12V 3,2Ah", desc: "battery lead AGM" },
          { sapNo: "39206", name: "Mounting Adapter M22-A", desc: "mounting adapter" },
          { sapNo: "39834", name: "Push Button, Round IP 67 M22-D-X", desc: "push button" },
          { sapNo: "39827", name: "Plate for Push Button Black M22-XD-S", desc: "plate for push button" },
          { sapNo: "13336", name: "Socket Insert 3p+PE 10A Screw Term.", desc: "socket insert" },
          { sapNo: "6737", name: "Socket Insert 10p 380V 16A Cage-clamp t.", desc: "Han ES 10-F" },
          { sapNo: "6736", name: "Pin Insert 10p 380VAC 16A Cage-clamp t.", desc: "replacement for SAP 795", alternativeSap: "795" },
          { sapNo: "84612", name: "PCB Batt.charger RC switchgear V1.0 CS82", desc: "replaced by SAP 507329 (V1.2)", alternativeSap: "507329" },
          { sapNo: "91747", name: "PCB Batt.charger RC switchgear V1.1 CS82", desc: "replace SAP 84612 ; alternative: SAP 507329 (V1.2)", alternativeSap: "507329" },
          { sapNo: "507329", name: "PCB Batt.charger RC switchgear V1.2 CS82", desc: "alternative: SAP 91747 (V1.1)", alternativeSap: "91747" },
          { sapNo: "91857", name: "Relay FINDER 55.32.9.048.0090 /2Ch", desc: "inductor 48V DC ; contact 250V AC / 10A , 2 changer ; with LED" },
          { sapNo: "77330", name: "Relay Timing- FINDER 87.41.0.240", desc: "relay timing" },
          { sapNo: "91861", name: "Switch Main- 400V 32A T3-1-102/EA/SVB", desc: "switch main" },
          { sapNo: "36074", name: "Switch Selector 60° 2 pos.engag.M22S-WKV", desc: "switch selector" },
        ]
      },
      {
        id: "e44_tow_cabinet_v1",
        name: "Control Cabinet V1",
        imageName: "29 control cabinet v1.PNG",
        parts: [
          { sapNo: "20160", name: "Battery Lead- free of maint. 12V 7,2Ah", desc: "replaced by: SAP 791043 battery lead- free maint.12V 7Ah Yuasa®", alternativeSap: "791043" },
          { sapNo: "791043", name: "Battery Lead- free maint.12V 7Ah Yuasa®", desc: "battery lead" },
          { sapNo: "205904", name: "Battery Lead- free maint.12V 8,5Ah Yuasa", desc: "replaced by SAP 791043", alternativeSap: "791043" },
          { sapNo: "6451", name: "Spacer Single for U-bracket 8-12mm", desc: "replaced by: SAP 721598 clamp. saddle Polypropylen", alternativeSap: "721598" },
          { sapNo: "56701", name: "Heater Fan 220-240VAC 250W HG Vario 250", desc: "replaced by SAP 77188", alternativeSap: "77188" },
          { sapNo: "77188", name: "Heater Fan 230V/250W ENERCON V2", desc: "heater fan" },
          { sapNo: "68715", name: "PCB Facts-power Control V1.3 C167", desc: "alternative: SAP 6180 (V1.2)", alternativeSap: "6180" },
          { sapNo: "50728", name: "PCB I/O Board V1.2 E112", desc: "alternative: SAP 66802 (V1.5) , SAP 61812 (V1.4) , SAP 55546 (V1.3)", alternativeSap: "66802" },
          { sapNo: "55546", name: "PCB I/O Board V1.3 E112", desc: "alternative: SAP 66802 (V1.5) , SAP 61812 (V1.4) or SAP 692489 (V1.6)", alternativeSap: "66802" },
          { sapNo: "61812", name: "PCB I/O Board V1.4 E112", desc: "alternative: SAP 66802 (V1.5) or SAP 692489 (V1.6)", alternativeSap: "66802" },
          { sapNo: "66802", name: "PCB I/O Board V1.5 E112", desc: "alternative: SAP 61812 (V1.4) or SAP 692489 (V1.6)", alternativeSap: "61812" },
          { sapNo: "50287", name: "PCB Power Control V1.4", desc: "alternative: SAP 66997 (V1.7) ; SAP 56709 (V1.6)", alternativeSap: "66997" },
          { sapNo: "56709", name: "PCB Power Control V1.6", desc: "alternative: SAP 66997 (V1.7)", alternativeSap: "66997" },
          { sapNo: "66997", name: "PCB Power Control V1.7", desc: "alternative: SAP 56709 (V1.6)", alternativeSap: "56709" },
          { sapNo: "46382", name: "PCB Sinewave Generator V1.0 EXX", desc: "alternative: SAP 46455 sinewave generator V1.0 ass. EXX", alternativeSap: "46455" },
          { sapNo: "55122", name: "Switch Motor Protect. 2,8-4,0A 3RV1021", desc: "replaced by: SAP 547185", alternativeSap: "547185" },
        ]
      },
      {
        id: "e44_tow_30",
        name: "30. Şema (Drawing 30)",
        imageName: "30.PNG",
        parts: []
      },
      {
        id: "e44_tow_31",
        name: "31. Şema (Drawing 31)",
        imageName: "31.PNG",
        parts: []
      },
      {
        id: "e44_tow_32_control_cabinet_v3_4",
        name: "Control Cabinet V3-4 (Kontrol Kabini 32)",
        imageName: "32 control cabinet v3-4.PNG",
        parts: []
      },
      {
        id: "e44_tow_33",
        name: "33. Şema (Drawing 33)",
        imageName: "33.PNG",
        parts: []
      },
      {
        id: "e44_tow_34_transformer",
        name: "Transformer (Trafo 34)",
        imageName: "34 transformer.PNG",
        parts: []
      },
      {
        id: "e44_tow_35_tower_cabling",
        name: "Tower Cabling (Kule Kablolama 35)",
        imageName: "35 tower cabling.PNG",
        parts: []
      },
      {
        id: "e44_tow_36_tower_fastener_and_shim",
        name: "Tower Fastener And Shim (Kule Bağlantı Elemanları 36)",
        imageName: "36 tower fastener and shim.PNG",
        parts: []
      },
      {
        id: "e44_tow_37",
        name: "37. Şema (Drawing 37)",
        imageName: "37.PNG",
        parts: []
      },
      {
        id: "e44_tow_38_air_recirculation",
        name: "Air Recirculation (Hava Sirkülasyonu 38)",
        imageName: "38 air recirculation.PNG",
        parts: []
      },
      {
        id: "e44_tow_ups",
        name: "UPS Cabinet (Güç Kaynağı)",
        imageName: "39 ups.PNG",
        parts: [
          { sapNo: "73117", name: "UPS-device Enercon V1.0 STD", desc: "replaced by: SAP 92534 UPS-device Enercon V2.0 STD", alternativeSap: "92534" },
          { sapNo: "73116", name: "UPS-device Enercon V1.0 DC", desc: "UPS device" },
          { sapNo: "65147", name: "Cover Plate D0054631-1", desc: "cover plate 980x690x4mm" },
          { sapNo: "14904", name: "IGBT-module 1200V 400A SKM400GAL124D", desc: "alternative SAP 67110", alternativeSap: "67110" },
          { sapNo: "11768", name: "Capacitor 14000µF 400V HCGH2G143BF196M", desc: "replaced by: SAP 25812", alternativeSap: "25812" },
          { sapNo: "51769", name: "Filter Grid-3x067A 3x0,82mH DSF 67/400", desc: "alternative: SAP 513080 filter unit DUKT 35000 Bv.7365", alternativeSap: "513080" },
          { sapNo: "50081", name: "PCB 300kW Inverter Supply V1.5", desc: "replaced by: SAP 711526 (V1.6). alternative: SAP 34776 (V1.2)", alternativeSap: "711526" },
          { sapNo: "52141", name: "PCB UPS-control V1.1", desc: "for Enercon-USV , alternative: SAP 70518 (V1.2)", alternativeSap: "70518" },
          { sapNo: "70518", name: "PCB UPS-control V1.2", desc: "for Enercon-USV , alternative: SAP 52141 (V1.1)", alternativeSap: "52141" },
          { sapNo: "52280", name: "PCB UPS IGBT-driver V1.2", desc: "replaced by SAP 96012 (V1.3)", alternativeSap: "96012" },
          { sapNo: "96012", name: "PCB UPS IGBT-driver V1.3", desc: "alternative: SAP 52280 (V1.2)", alternativeSap: "52280" },
          { sapNo: "52712", name: "PCB UPS Voltage Adapter V1.0", desc: "for Enercon-USV" },
          { sapNo: "92445", name: "Switch Auxiliary 1NO/1NC 3RV1901-1A SIE®", desc: "replaced by: SAP 547040", alternativeSap: "547040" },
          { sapNo: "547040", name: "Switch Auxiliary 1S/1Ö 3RV2901-1A", desc: "switch auxiliary" },
          { sapNo: "8447", name: "Switch Auxiliary 1NO/3NC 400V 13DIL", desc: "alternative: SAP 58724", alternativeSap: "58724" },
          { sapNo: "28894", name: "Contactor High Power DILM185/22(RAC240)", desc: "replaced by SAP 63203", alternativeSap: "63203" },
          { sapNo: "33184", name: "Sensor PWRXX06 300kW 85° UCHIYA UP62 EX", desc: "replaced by: SAP 508385", alternativeSap: "508385" },
        ]
      },
      {
        id: "e44_tow_40",
        name: "40. Şema (Drawing 40)",
        imageName: "40.PNG",
        parts: []
      },
      {
        id: "e44_tow_41_ups_v2_0",
        name: "Ups V2.0 (UPS Güç Kaynağı 41)",
        imageName: "41 ups v2.0.PNG",
        parts: []
      },
      {
        id: "e44_tow_42",
        name: "42. Şema (Drawing 42)",
        imageName: "42.PNG",
        parts: []
      }
    ]
  }
};
