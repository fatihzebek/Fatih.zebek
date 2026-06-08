const fs = require('fs');
let t = fs.readFileSync('extracted_chunk_full.txt', 'utf8');

const dict = {
  '\uFFFD!IKLAMA': 'AÇIKLAMA',
  '\uFFFDSR\uFFFDSN': 'ÜRÜN',
  'G\uFFFDSNCELLE': 'GÜNCELLE',
  'Y\uFFFDSKLE': 'YÜKLE',
  'Y\u0013NETİCİ': 'YÖNETİCİ',
  'ARA\uFFFD!LARI': 'ARAÇLARI',
  'GE\uFFFD!M': 'GEÇM',
  'sipari\uFFFDx': 'sipariş',
  'G\uFFFDSNCEL': 'GÜNCEL',
  'G\uFFFDSN': 'GÜN',
  'mi\uFFFDxi': 'mişi',
  'L\uFFFDS': 'LÜ',
  'YA\uFFFD!': 'YAÇ',
  'sa\uFFFDxl': 'sağl',
  'G\uFFFDSVEN': 'GÜVEN',
  'istedi\uFFFDxiniz': 'istediğiniz',
  'Eri\uFFFDxilebilir': 'Erişilebilir',
  'eri\uFFFDxim': 'erişim',
  'da\uFFFDx': 'dağ',
  'R\uFFFDSNT\uFFFDSLE': 'RÜNTÜLE',
  'olu\uFFFDxtu': 'oluştu',
  'de\uFFFDxi\uFFFDxtirme': 'değiştirme',
  'ba\uFFFDxar': 'başar',
  'istedi\uFFFDxinize': 'istediğinize',
  'i\uFFFDxlemi': 'işlemi',
  'de\uFFFDxi\uFFFDxtirmeyi': 'değiştirmeyi',
  'G\uFFFDSNCELLEME': 'GÜNCELLEME',
  'Sa\uFFFDxl': 'Sağl',
  'M\uFFFD!F': 'MÇF',
  'T\uFFFDSRE': 'TÜRE',
  'T\uFFFDSUM': 'TÜM',
  'T\uFFFDSMB': 'TÜMB',
  'T\uFFFDSRB': 'TÜRB',
  'bo\uFFFDx': 'boş',
  'i\uFFFDxlenecek': 'işlenecek',
  'A\uFFFDxa\uFFFDx': 'Aşağı',
  'olu\uFFFDxturulacak': 'oluşturulacak',
  'Sipari\uFFFDx': 'Sipariş',
  'duyuldu\uFFFDxunu': 'duyulduğunu',
  'Hur\uFFFDxit': 'Hurşit',
  'olu\uFFFDxturuldu': 'oluşturuldu',
  'olu\uFFFDxturulurken': 'oluşturulurken',
  'i\uFFFDxlem': 'işlem',
  'İ\uFFFDxlem': 'İşlem',
  'T\uFFFDSM': 'TÜM',
  'bo\uFFFDxalt': 'boşalt',
  'ka\uFFFDx': 'kağ',
  'yerle\uFFFDxtirdi\uFFFDxinizden': 'yerleştirdiğinizden',
  'di\uFFFDxer': 'diğer',
  'olu\uFFFDxturun': 'oluşturun',
  'ba\uFFFDxlay': 'başlay',
  'A\uFFFD!': 'AÇ',
  '\uFFFD!IKIŞ': 'ÇIKIŞ',
  '\uFFFD!OK': 'ÇOK',
  '\uFFFD\u0013L\uFFFDS': 'ÖLÜ',
  '\uFFFD\u0013rn': 'Örn',
  'G\uFFFD\u0013RSEL': 'GÖRSEL',
  'G\uFFFD\u0013R\uFFFDSN': 'GÖRÜN',
  '\uFFFD\u0013\uFFFDxe': 'Öğe',
  '\uFFFD!evrim': 'Çevrim',
  '\uFFFDR ': '⚠️ ',
  '\uFFFDS ': '🚚 '
};

for (const [bad, good] of Object.entries(dict)) {
    t = t.replaceAll(bad, good);
}

// Any remaining generic ones
t = t.replaceAll('\uFFFD!', 'Ç');
t = t.replaceAll('!\uFFFD', 'Ç');
t = t.replaceAll('\uFFFDx', 'ş');

fs.writeFileSync('extracted_chunk_fixed.txt', t);
console.log('Fixed chunk and saved to extracted_chunk_fixed.txt');
