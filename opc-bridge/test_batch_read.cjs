const axios = require('axios');
const xml2js = require('xml2js');

const opcUrl = 'http://172.17.6.202:6010'; // Sarıkaya OPC URL
const tagNames = [
  'Loc/Wec/Plant1/Para/1000',
  'Loc/Wec/Plant1/Para/1001',
  'Loc/Wec/Plant1/Para/1002'
];

const itemsMarkup = tagNames.map(tagName => `<Items ItemName="${tagName}" />`).join('');

const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
      <Options ReturnErrorText="true" LocaleID="en-us" />
      <ItemList>
        ${itemsMarkup}
      </ItemList>
    </Read>
  </soap:Body>
</soap:Envelope>`;

async function run() {
    try {
        console.log("Sending SOAP request...");
        const response = await axios.post(opcUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
            },
            timeout: 10000
        });

        console.log("Response received. Parsing XML...");
        xml2js.parseString(response.data, (err, result) => {
            if (err) {
                console.error("XML parse error:", err);
                return;
            }
            
            // Print the parsed structure
            console.log("Full Result:", JSON.stringify(result, null, 2));
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();
