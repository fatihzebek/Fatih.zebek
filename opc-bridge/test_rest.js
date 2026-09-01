const axios = require('axios');

const projectId = "dh-servis-rapor";
const apiKey = "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY";
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/realtimeStatus/Plant1?key=${apiKey}`;

const data = {
  fields: {
    power: { doubleValue: 120 },
    windSpeed: { doubleValue: 5.5 },
    status: { stringValue: "OK" },
    updatedAt: { stringValue: new Date().toISOString() }
  }
};

async function testWrite() {
  try {
    const response = await axios.patch(url, data, {
      headers: {
        'Referer': 'https://dh-servis-rapor.web.app/',
        'Content-Type': 'application/json'
      }
    });
    console.log("✅ REST Write Success:", response.data);
  } catch (error) {
    console.error("❌ REST Write Error:", error.response ? error.response.data : error.message);
  }
}

testWrite();
