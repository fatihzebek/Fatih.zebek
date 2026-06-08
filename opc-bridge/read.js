const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.75.50:6010';

async function tryRead(formatType) {
    let soapBody = "";
    
    if (formatType === 1) {
        // Options eklenmis format
        soapBody = `<Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
            <Options ReturnErrorText="true" LocaleID="en-us" />
            <ItemList>
                <Items ItemName="Loc/Wec/Plant1/P" />
            </ItemList>
        </Read>`;
    } else if (formatType === 2) {
        // Namespace Prefikli Format
        soapBody = `<ns1:Read xmlns:ns1="http://opcfoundation.org/webservices/XMLDA/1.0/"><ns1:ItemList><ns1:Items ItemName="Loc/Wec/Plant1/P" /></ns1:ItemList></ns1:Read>`;
    } else {
        // Namespace icinde ItemList
        soapBody = `<Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/"><ItemList xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/"><Items ItemName="Loc/Wec/Plant1/P" /></ItemList></Read>`;
    }

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>${soapBody}</soap:Body>
    </soap:Envelope>`;

    try {
        console.log(`Format ${formatType} deneniyor...`);
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
            },
            timeout: 3000
        });

        console.log(`✅ Format ${formatType} CALISTI!`);
        console.log("Ham Cevap:", response.data);
        return true;
    } catch (error) {
        console.log(`❌ Format ${formatType} basarisiz.`);
        if (error.response && error.response.data) {
            console.log("Sunucudan Gelen Hata Detayi:", error.response.data);
        } else {
            console.log("Hata:", error.message);
        }
        return false;
    }
}

async function runTests() {
    for (let i = 1; i <= 3; i++) {
        const success = await tryRead(i);
        if (success) break;
    }
}

runTests();
