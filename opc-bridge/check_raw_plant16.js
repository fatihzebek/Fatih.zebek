const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';
const plantId = 'Plant16';
const tags = [
    `Loc/Wec/${plantId}/P`,
    `Loc/Wec/${plantId}/Vwind`,
    `Loc/Wec/${plantId}/Status/St`
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

async function check() {
    const response = await axios.post(OPC_URL, soapRequest, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
        }
    });

    console.log("=== RAW XML RESPONSE ===");
    console.log(response.data);

    xml2js.parseString(response.data, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("=== PARSED RESULT ===");
        const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
        const readResponse = body.ReadResponse[0];
        const items = readResponse.RItemList[0].Items || [];
        console.log(JSON.stringify(items, null, 2));
    });
}

check().catch(console.error);
