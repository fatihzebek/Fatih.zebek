const axios = require('axios');

const OPC_URL = 'http://172.17.78.42:6010';

async function checkRaw() {
    const tags = [
        `Loc/Wec/Plant8/Status/St`,
        `Loc/Wec/Plant8/Status/NoSt`,
        `Loc/Wec/Plant8/Status/St-1`,
        `Loc/Wec/Plant8/Status/St-2`
    ];

    const itemElements = tags.map(tag => `<Items ItemName="${tag}" />`).join('');
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>${itemElements}</ItemList>
        </Read>
      </soap:Body>
    </soap:Envelope>`;

    try {
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
            },
            timeout: 5000
        });

        console.log("RAW XML RESPONSE:\n", response.data);

    } catch (error) {
        console.error("❌ Hata:", error.message);
    }
}

checkRaw();
