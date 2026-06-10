export interface IMalzeme {
  sapNo: string;
  malzemeAdi: string;
  birim: string;
  stok: number;
  rezerve: number;
  konum: string;
  kritikStok: number;
}

export interface IDepoHareketi {
  kaynakBelge: string; // Hangi rapordan/iş emrinden düşüldü
  kullanici: string; // İşlemi yapan kullanıcı
  islemTipi: 'GİRİŞ' | 'ÇIKIŞ' | 'TRANSFER';
  miktar: number;
  islemTarihi: string | Date;
  aciklama: string;
}

export interface IDepoSayimi {
  sayimYapan: string;
  baslangicTarihi: string | Date;
  bitisTarihi: string | Date;
  sayimSuresiDakika: number;
  sistemStok: number; // Sistemdeki kayıtlı stok
  sayilanStok: number; // Gerçekte sayılan stok
  fark: number;
}
