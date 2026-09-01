const axios = require('axios');

const PROJECT_ID = "dh-servis-rapor";
const API_KEY = "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY";
const WAREHOUSE_ID = "team_Team_15";

async function addStock() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/warehouses/${WAREHOUSE_ID}/inventory_v2?key=${API_KEY}`;

    const data = {
      fields: {
        sapNo: { stringValue: "514482" },
        condition: { stringValue: "NEW" },
        quantity: { integerValue: "1" },
        description: { stringValue: "PCB capacitor-board V3.2 NessCap" },
        serialNo: { stringValue: "" },
        shelfNo: { stringValue: "Tanımsız" },
        lastUpdated: { timestampValue: new Date().toISOString() },
        note: { stringValue: "System corrected stock" }
      }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Referer': 'https://dh-servis-rapor.web.app/',
                'Content-Type': 'application/json'
            }
        });
        console.log("✅ Stock added successfully:", response.data.name);
    } catch (error) {
        console.error("❌ Failed to add stock:", error.response ? error.response.data : error.message);
    }
}

addStock();
