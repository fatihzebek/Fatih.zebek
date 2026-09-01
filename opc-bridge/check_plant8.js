const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';

async function checkTurbine(plantNo) {
    const plantId = `Plant${plantNo}`;
    console.log(`\n--- ${plantId} DETAYLI ARİZA KODU SORGULAMA ---`);
    
    // We will query:
    // 1. General status: St
    // 2. Number of active statuses: NoSt
    // 3. First 10 status registers: St-1 to St-10
    const tags = [
        `Loc/Wec/${plantId}/Status/St`,
        `Loc/Wec/${plantId}/Status/NoSt`
    ];
    for (let j = 1; j <= 10; j++) {
        tags.push(`Loc/Wec/${plantId}/Status/St-${j}`);
    }

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

        xml2js.parseString(response.data, (err, result) => {
            if (err) {
                console.error("XML Parse Hatası:", err);
                return;
            }
            
            const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
            const readResponse = body.ReadResponse[0];
            const items = readResponse.RItemList[0].Items || [];

            console.log(`\n--- OKUNAN TAG DEĞERLERİ ---`);
            items.forEach((item, index) => {
                const valueObj = item.Value ? item.Value[0] : null;
                const value = (valueObj && typeof valueObj === 'object') ? valueObj._ : valueObj;
                const tagName = tags[index];
                const quality = item.Quality ? item.Quality[0].$.QualityField : 'unknown';
                console.log(`🏷️  ${tagName.split('/').pop()} --> Değer: ${value} (Kalite: ${quality})`);
            });
        });

    } catch (error) {
        console.error("❌ Hata:", error.message);
    }
}

async function run() {
    // Check working turbine (Plant 1)
    await checkTurbine(1);
    
    // Check faulted turbine (Plant 8)
    await checkTurbine(8);
}

run();
