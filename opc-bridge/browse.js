const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.75.50:6010';

async function browseOPC(itemPath = "") {
    console.log(`\n--- OPC Klasor Tarama Baslatiliyor (${itemPath || 'Kök Dizin'}) ---`);

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Browse xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/" 
                ItemPath="${itemPath}" 
                BrowseFilter="all" 
                MaxElementsReturned="100" />
      </soap:Body>
    </soap:Envelope>`;

    try {
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Browse'
            }
        });

        xml2js.parseString(response.data, (err, result) => {
            if (err) return console.error("XML Error:", err);
            
            const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
            const browseResponse = body.BrowseResponse[0];
            const elements = browseResponse.Elements || [];

            console.log("\n--- Bulunan Veriler / Klasorler ---");
            elements.forEach(el => {
                const name = el.$.Name;
                const itemName = el.$.ItemName;
                const isItem = el.$.IsItem === 'true';
                const hasChildren = el.$.HasChildren === 'true';

                console.log(`${isItem ? '[Veri]' : '[Klasor]'} ${name} --> ${itemName}`);
            });

            if (elements.length === 0) console.log("Bu dizinde eleman bulunamadi.");

        });

    } catch (error) {
        console.error("❌ Browse Hatasi:", error.message);
    }
}

browseOPC("Loc/Wec/Plant1/Status"); // Durum detaylarina bak
