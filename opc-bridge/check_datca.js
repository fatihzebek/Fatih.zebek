const axios = require('axios');
const xml2js = require('xml2js');

const OPC_URL = 'http://172.17.78.42:6010';
const TURBINE_COUNT = 38; // Sahadaki turbin sayisi

async function scanDatca() {
    console.log(`\n--- DARES DATÇA CANLI SCADA ARİZA TARAMASI BAŞLATILIYOR ---`);
    console.log(`Hedef OPC: ${OPC_URL}`);
    console.log(`Tarih: ${new Date().toLocaleString('tr-TR')}\n`);
    
    let scannedCount = 0;
    let faultsFound = [];
    
    for (let i = 1; i <= TURBINE_COUNT; i++) {
        const plantId = `Plant${i}`;
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

        try {
            const response = await axios.post(OPC_URL, soapRequest, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
                },
                timeout: 3000
            });

            await new Promise((resolve) => {
                xml2js.parseString(response.data, (err, result) => {
                    if (err) {
                        resolve();
                        return;
                    }
                    
                    const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                    const readResponse = body.ReadResponse[0];
                    const items = readResponse.RItemList[0].Items || [];

                    let power = 0;
                    let windSpeed = 0;
                    let status = 'Unknown';

                    items.forEach((item, index) => {
                        const valueObj = item.Value ? item.Value[0] : null;
                        const value = (valueObj && typeof valueObj === 'object') ? valueObj._ : valueObj;
                        
                        if (index === 0) power = parseFloat(value || 0);
                        if (index === 1) windSpeed = parseFloat(value || 0);
                        if (index === 2) status = value || 'OK';
                    });

                    // Determine if there is a fault:
                    // 1. Status is not 'OK' or '0' or 'Run'
                    // 2. Wind speed is significant (> 4 m/s) but Power is <= 0 (Turbine stopped/faulted)
                    const isFault = (status !== 'OK' && status !== '0' && status !== '1' && status !== 'Run') || 
                                    (windSpeed > 4.5 && power <= 0);
                    
                    scannedCount++;
                    
                    if (isFault) {
                        faultsFound.push({
                            turbine: `Plant ${i}`,
                            power: power,
                            wind: windSpeed,
                            status: status,
                            reason: (windSpeed > 4.5 && power <= 0) ? 'Rüzgar var ama Üretim Yok (Duruş)' : 'Durum Hata Kodu'
                        });
                        console.log(`🚨 Plant ${i} -> Güç: ${power} kW | Rüzgar: ${windSpeed} m/s | Durum: ${status} [ARIZA!]`);
                    } else {
                        console.log(`✅ Plant ${i} -> Güç: ${power} kW | Rüzgar: ${windSpeed} m/s | Durum: ${status}`);
                    }
                    resolve();
                });
            });

        } catch (error) {
            console.log(`❌ Plant ${i} -> Okuma Hatası (${error.message})`);
        }
        
        await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`\n--- TARAMA TAMAMLANDI ---`);
    console.log(`Toplam taranan türbin: ${scannedCount}/${TURBINE_COUNT}`);
    console.log(`Bulunan arızalı türbin sayısı: ${faultsFound.length}`);
    if (faultsFound.length > 0) {
        console.log(`\n--- ARİZALI TÜRBİNLERİN LİSTESİ ---`);
        faultsFound.forEach(f => {
            console.log(`- ${f.turbine}: Durum = ${f.status}, Rüzgar = ${f.wind} m/s, Güç = ${f.power} kW (${f.reason})`);
        });
    } else {
        console.log(`\nTebrikler! Dares Datça sahasında aktif duruş veya arızalı türbin tespit edilmedi.`);
    }
}

scanDatca();
