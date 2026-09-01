const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';
const tagName = "Loc/Wec/Plant2/Reset/SessionRequest";

async function tryWriteFormat1() {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://opcfoundation.org/webservices/XMLDA/1.0/">
      <soap:Body>
        <Write xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            <Items ItemName="${tagName}">
              <Value xsi:type="ns1:ArrayOfUnsignedInt">
                <unsignedInt>1</unsignedInt>
                <unsignedInt>3532546021</unsignedInt>
                <unsignedInt>12345</unsignedInt>
              </Value>
            </Items>
          </ItemList>
        </Write>
      </soap:Body>
    </soap:Envelope>`;

    try {
        console.log("Testing Format 1...");
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Write'
            },
            timeout: 5000
        });

        console.log("✅ Format 1 Success!");
        console.log("Response:", response.data);
    } catch (error) {
        console.log("❌ Format 1 Failed.");
        if (error.response && error.response.data) {
            console.log("Error Details:", error.response.data);
        } else {
            console.log("Error:", error.message);
        }
    }
}

tryWriteFormat1();
