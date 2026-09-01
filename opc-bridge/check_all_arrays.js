const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';
const TURBINE_COUNT = 36;

async function check() {
    for (let i = 1; i <= TURBINE_COUNT; i++) {
        const plantId = `Plant${i}`;
        const tags = [
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

        try {
            const response = await axios.post(OPC_URL, soapRequest, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
                },
                timeout: 3000
            });

            xml2js.parseString(response.data, (err, result) => {
                if (err) return;
                const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                const readResponse = body.ReadResponse[0];
                const items = readResponse.RItemList[0].Items || [];
                const item = items[0];
                const valueObj = item.Value ? item.Value[0] : null;
                
                if (valueObj && valueObj.unsignedShort) {
                    console.log(`${plantId} -> [${valueObj.unsignedShort.join(', ')}]`);
                } else {
                    console.log(`${plantId} -> Not an array:`, valueObj);
                }
            });
        } catch (e) {
            console.log(`${plantId} -> Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }
}

check().catch(console.error);
