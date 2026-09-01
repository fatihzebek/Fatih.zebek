const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';

async function checkProperties() {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetProperties xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <ItemIDs ItemName="Loc/Wec/Plant1/Reset/SessionRequest" />
        </GetProperties>
      </soap:Body>
    </soap:Envelope>`;

    try {
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/GetProperties'
            },
            timeout: 5000
        });

        console.log("Raw Response:", response.data);
    } catch (error) {
        if (error.response && error.response.data) {
            console.log("Error Details:", error.response.data);
        } else {
            console.log("Error:", error.message);
        }
    }
}

checkProperties();
