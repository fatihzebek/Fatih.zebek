# Project Rules & Customizations

## 📋 General Rules & Guidelines

- **ÖNCE FİKİR ALIŞVERİŞİ (ONAY SÜRECİ):** Herhangi bir kod yazma, dosya değiştirme veya canlıya yükleme (deploy) işlemi yapmadan önce mutlaka kullanıcıya ne yapılacağını detaylı bir şekilde açıklayın. Fikir alışverişi yapıp kullanıcının onayını aldıktan sonra uygulamaya geçin.
- Keep all comments and docstrings intact when editing code.
- Always use `file://` link schemes when referencing files or types in communication.
- **DİĞER HİÇBİR ÖZELLİĞİ DEĞİŞTİRME/BOZMAMA KURALI (REGRESYON ENGELLEME):** Bir güncelleme veya hata düzeltmesi üzerinde çalışırken, uygulamanın diğer hiçbir sayfasına, dosyasına veya çalışan özelliğine dokunulmamalıdır. Değişiklikler olabildiğince dar kapsamlı tutulmalı ve her güncelleme sonrasında mutlaka `npm run build` ile derleme testi yapılarak projenin genel kararlılığı doğrulanmalıdır.
- **KESİN YEREL-ÖNCE VE CANLIYA GEÇİŞ DİSİPLİNİ (NO PREEMPTIVE DEPLOY):**
  1. Tüm geliştirmeler, hata gidermeler ve yapılandırma güncellemeleri yalnızca yerel (local) ortamda yapılmalı ve doğrulanmalıdır.
  2. Yerel ortamdaki değişiklikler bittikten sonra kullanıcıya sunulmalı ve test etmesi için onay istenmelidir.
  3. Kullanıcı yerel hali görüp onay vermeden ve "canlıya alalım / deploy edelim" şeklinde açıkça talimat vermeden canlı ortama (`firebase deploy`, Firebase Console veya canlı veritabanı belgelerinde) kesinlikle hiçbir güncelleme gönderilmemelidir. Canlıya aktarım komutları sadece bu nihai onayın ardından çalıştırılabilir.

