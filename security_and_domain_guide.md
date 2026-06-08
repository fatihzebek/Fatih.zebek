# 🛡️ DH Servis - Güvenlik ve Özel Alan Adı (Domain) Kurulum Kılavuzu

Bu kılavuz, Demirer Holding teknik ekibi veya bilgi işlem departmanı tarafından sistem yayına alınırken yapılacak **ücretsiz güvenlik ve domain** ayarlarını içerir.

---

## 🔒 1. Veritabanı Güvenlik Durumu (Firestore & Storage)
Geliştirme aşamasında açık olan veritabanı kapıları tamamen zırhlanmıştır.

* **Firestore Kuralları (Canlıda Aktif):** Sadece geçerli bir hesapla sisteme giriş yapmış olan Demirer Holding personeli verilere erişebilir. Dışarıdan anonim sızma girişimleri tamamen engellenmiştir.
* **Storage Kuralları:** `storage.rules` dosyamız en güvenli haline (`request.auth != null`) getirilmiştir. Bulutta Storage servisi etkinleştirildiğinde otomatik olarak devreye girecektir.

---

## 🌐 2. Özel Alan Adı Bağlama (`servis.demirerholding.com`)
Uygulamayı şirketinizin kurumsal alt alan adında **tamamen ücretsiz** olarak yayına almak için bu adımları izleyin:

### Adım A: Firebase Hosting Tanımlaması
1. [Firebase Console](https://console.firebase.google.com/)'a girin ve projenizi seçin.
2. Sol menüden **Hosting** sekmesine tıklayın.
3. **"Add Custom Domain"** (Özel Alan Adı Ekle) butonuna tıklayın.
4. Çıkan kutuya `servis.demirerholding.com` yazıp devam edin.

### Adım B: Bilgi İşlem / DNS Ayarları
Firebase size sahiplik doğrulaması için **TXT** ve yönlendirme için **A (IP adresi)** kayıtları verecektir. Bu kayıtları şirketinizin DNS/Alan adı yöneticisine (IHS, Natro, GoDaddy, Cloudflare vb. paneli yöneten arkadaşa) iletin:
* *Gönderilecek Mesaj:* *"DH Servis uygulaması için bu DNS kayıtlarının (CNAME/A kayıtları) alan adı yönetim panelimize eklenmesini rica ederiz."*
* Kayıtlar eklendikten sonra Firebase sitenize otomatik olarak **ücretsiz SSL güvenlik sertifikası** (yeşil kilit / HTTPS) tanımlar.

---

## 🔑 3. Google Cloud API Anahtarı Kısıtlaması (HTTP Referrer)
API anahtarınızın başka web sitelerinde taklit edilmesini veya kötüye kullanılmasını engellemek için bu ayarı yapın:

1. [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials) sayfasına gidin.
2. Firebase projenizin bağlı olduğu Google hesabıyla giriş yapın.
3. *"API Keys"* başlığı altında yer alan aktif anahtarınıza tıklayın.
4. **"Application Restrictions"** (Uygulama Kısıtlamaları) bölümüne gelin:
   * **"HTTP referrers (web sites)"** seçeneğini işaretleyin.
   * **"ADD" (Ekle)** butonuna tıklayarak şu adresleri girin:
     1. `localhost/*` (Yerel bilgisayarda geliştirme yapabilmek için)
     2. `*.web.app/*` (Firebase varsayılan canlı adresi)
     3. `https://servis.demirerholding.com/*` (Demirer Holding resmi servis adresi)
5. En alttan **"Save" (Kaydet)** butonuna tıklayarak işlemi tamamlayın.

---

> [!NOTE]
> Bu işlemlerin tamamı **%100 ÜCRETSİZDİR** ve yereldeki kodlarınızı veya çalışmalarınızı hiçbir şekilde etkilemez. İstediğiniz zaman bu kılavuza bakarak adımları tamamlayabilirsiniz.
