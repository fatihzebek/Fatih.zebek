const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.75.50:6010';
const baseTag = "Loc/Wec/Plant2/Reset";

async function readTag(tagName) {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            <Items ItemName="${tagName}" />
          </ItemList>
        </Read>
      </soap:Body>
    </soap:Envelope>`;

    const response = await axios.post(OPC_URL, soapRequest, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
        },
        timeout: 5000
    });

    return new Promise((resolve, reject) => {
        xml2js.parseString(response.data, (err, result) => {
            if (err) return reject(err);
            try {
                const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                const readResponse = body.ReadResponse[0];
                const items = readResponse.RItemList[0].Items || [];
                const valueObj = items[0].Value ? items[0].Value[0] : null;
                const value = (valueObj && typeof valueObj === 'object') ? (valueObj._ || valueObj.unsignedInt || valueObj.unsignedShort || valueObj.short || valueObj.string) : valueObj;
                resolve(value);
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function writeTag(tagName, arrayValues) {
    const itemValues = arrayValues.map(v => `<unsignedInt>${v}</unsignedInt>`).join('');
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://opcfoundation.org/webservices/XMLDA/1.0/">
      <soap:Body>
        <Write xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            <Items ItemName="${tagName}">
              <Value xsi:type="ns1:ArrayOfUnsignedInt">
                ${itemValues}
              </Value>
            </Items>
          </ItemList>
        </Write>
      </soap:Body>
    </soap:Envelope>`;

    await axios.post(OPC_URL, soapRequest, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Write'
        },
        timeout: 5000
    });
}

async function runFlow() {
    const randomSessionId = Math.floor(Math.random() * 65535) + 1;
    const testBaseTag = "Loc/Wec/Plant1/Reset";
    console.log(`--- BEFORE RESERVATION (SessionID: ${randomSessionId}) ---`);
    const stateBefore = await readTag(`${testBaseTag}/SessionState`);
    const pubKeyBefore = await readTag(`${testBaseTag}/SessionPubKey`);
    console.log("SessionState:", stateBefore);
    console.log("SessionPubKey:", pubKeyBefore);

    console.log("\n--- RESERVING SESSION ---");
    // [SessionID, UserID, PrivateKey]
    await writeTag(`${testBaseTag}/SessionRequest`, [randomSessionId, 3532546021, 12345]);
    console.log("SessionRequest written.");

    await new Promise(r => setTimeout(r, 1000));

    console.log("\n--- AFTER RESERVATION ---");
    const stateAfter = await readTag(`${testBaseTag}/SessionState`);
    const pubKeyAfter = await readTag(`${testBaseTag}/SessionPubKey`);
    console.log("SessionState:", stateAfter);
    console.log("SessionPubKey:", pubKeyAfter);
}

runFlow().catch(console.error);
