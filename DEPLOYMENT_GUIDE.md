# 🚀 Rahat Backup - Production Deployment Guide

## 📋 Deployment Stack
- **Backend:** Render.com (Node.js + PM2)
- **Frontend:** Vercel (React)
- **Database:** Render PostgreSQL

---

## 🗄️ ADIM 1: Render PostgreSQL Setup

### 1.1 Render'da PostgreSQL Oluştur
1. [Render.com](https://render.com) hesabına giriş yap
2. Dashboard → **New +** → **PostgreSQL**
3. Ayarlar:
   - **Name:** `rahat-backup-db`
   - **Database:** `rahat_backup_prod`
   - **User:** `rahat_admin` (otomatik oluşur)
   - **Region:** Frankfurt (en yakın)
   - **Plan:** Free (90 gün ücretsiz)
4. **Create Database** tıkla

### 1.2 Connection String'i Kopyala
Database oluştuktan sonra:
- **Internal Database URL** kopyala (daha hızlı)
- Format: `postgresql://user:password@hostname:5432/dbname`

### 1.3 Backend .env.production'ı Güncelle
```bash
# backend/.env.production dosyasında:
DATABASE_URL=postgresql://rahat_admin:xxx@dpg-xxx.frankfurt-postgres.render.com/rahat_backup_prod
```

---

## 🖥️ ADIM 2: Backend Deployment (Render)

### 2.1 GitHub Repository Hazırla
```bash
# Backend klasöründe
cd backend

# Git initialized değilse:
git init
git add .
git commit -m "Initial backend setup for production"

# GitHub'a push et (veya mevcut repo kullan)
git remote add origin https://github.com/username/rahat-backup-backend.git
git push -u origin main
```

### 2.2 Render'da Web Service Oluştur
1. Render Dashboard → **New +** → **Web Service**
2. **Connect GitHub repository** seç
3. Repository seç (rahat-backup veya backend repo)
4. Ayarlar:
   ```
   Name: rahat-backup-api
   Region: Frankfurt
   Branch: main
   Root Directory: backend (eğer monorepo ise)
   Runtime: Node
   Build Command: bash render-build.sh
   Start Command: npm start
   Plan: Free
   ```

### 2.3 Environment Variables Ekle
Render'da **Environment** sekmesinde ekle:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL Internal URL>
JWT_SECRET=<güçlü-random-secret-min-32-karakter>
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
JWT_RESET_PASSWORD_EXPIRATION_MINUTES=10
JWT_VERIFY_EMAIL_EXPIRATION_MINUTES=10

EMAIL_ENABLED=true
EMAIL_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=<gmail-app-password>

GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-client-secret>
GOOGLE_REDIRECT_URI=https://rahat-backup-api.onrender.com/v1/cloud-storage/google-drive/callback

AWS_CREDENTIALS_ENCRYPTION_KEY=<64-char-hex-string>
BACKUP_STORAGE_PATH=/tmp/backups
APP_URL=https://rahat-backup-api.onrender.com
```

**⚠️ JWT_SECRET Generate:**
```bash
# Node.js ile:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ AWS_CREDENTIALS_ENCRYPTION_KEY Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Deploy Başlat
- **Create Web Service** tıkla
- Build ve deploy otomatik başlayacak
- Logs'u takip et: `npx prisma migrate deploy` çalışmalı

### 2.5 Backend URL'i Kopyala
Deploy tamamlandıktan sonra:
- URL: `https://rahat-backup-api.onrender.com`
- Test et: `https://rahat-backup-api.onrender.com/v1/health` (404 olabilir, normal)

---

## 🌐 ADIM 3: Frontend Deployment (Vercel)

### 3.1 GitHub Repository Hazırla
```bash
cd frontend

# Git initialized değilse:
git init
git add .
git commit -m "Initial frontend setup for production"
git push
```

### 3.2 Vercel'de Project Oluştur
1. [Vercel](https://vercel.com) hesabına giriş yap
2. **Add New** → **Project**
3. **Import Git Repository** seç
4. Repository seç (rahat-backup veya frontend repo)
5. Ayarlar:
   ```
   Framework Preset: Create React App
   Root Directory: frontend (eğer monorepo ise)
   Build Command: npm run build
   Output Directory: build
   Install Command: npm install
   ```

### 3.3 Environment Variables Ekle
Vercel'de **Environment Variables** sekmesinde:

```env
REACT_APP_API_URL=https://rahat-backup-api.onrender.com
REACT_APP_LANDING_PAGE_DOMAIN=rahatbackup.com
```

**⚠️ Dikkat:** Backend URL'ini doğru gir (trailing slash olmamalı)

### 3.4 Deploy Başlat
- **Deploy** tıkla
- Build başlayacak (2-3 dakika)
- Deploy tamamlanınca URL verilecek: `https://rahat-backup.vercel.app`

---

## 🧪 ADIM 4: Test & Verification

### 4.1 Backend Health Check
```bash
# API çalışıyor mu?
curl https://rahat-backup-api.onrender.com/v1/auth/login

# Beklenen: 400 Bad Request (çünkü body yok, ama endpoint çalışıyor)
```

### 4.2 Frontend Test
1. Browser'da aç: `https://rahat-backup.vercel.app`
2. Login sayfası açılmalı
3. Yeni hesap oluştur (Register)
4. Login ol
5. Dashboard görünmeli

### 4.3 Backup Job Test
1. Database bağlantısı ekle (PostgreSQL/MySQL)
2. Cloud storage ekle (S3 veya Google Drive)
3. Backup job oluştur
4. "Backup Now" çalıştır
5. Logs'da hata var mı kontrol et

### 4.4 Render Logs İzleme
```
Render Dashboard → rahat-backup-api → Logs
```

Şunları kontrol et:
- ✅ Prisma migration başarılı
- ✅ Server started on port 3000
- ✅ Database connected
- ❌ Hata yok

---

## 🔧 ADIM 5: CORS Düzeltme (Gerekirse)

Eğer frontend'den backend'e istek atarken CORS hatası alırsan:

### Backend'de CORS ayarları (backend/src/app.js)
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3001',
    'https://rahat-backup.vercel.app',
    'https://rahat-backup-*.vercel.app' // Preview deployments
  ],
  credentials: true
}));
```

---

## 📊 ADIM 6: Monitoring & Logs

### 6.1 Render Monitoring
- **Metrics:** CPU, Memory kullanımı
- **Logs:** Real-time logs
- **Events:** Deploy history

### 6.2 Vercel Analytics
- **Analytics** sekmesinde:
  - Page views
  - Performance metrics
  - Error tracking

### 6.3 Database Monitoring
Render PostgreSQL Dashboard:
- **Metrics:** Connection count, DB size
- **Backups:** Otomatik 7 günlük backup

---

## 🚨 Troubleshooting

### Problem 1: Prisma Migration Hatası
**Hata:** `prisma migrate deploy` failed

**Çözüm:**
```bash
# Local'de test et:
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Render'da manuel çalıştır (Render Shell):
npx prisma migrate deploy
```

### Problem 2: Environment Variable Yüklenmedi
**Hata:** `JWT_SECRET is not defined`

**Çözüm:**
- Render'da Environment tab'inde değişkeni ekle
- Service'i **Manual Deploy** ile yeniden başlat

### Problem 3: Frontend API'ye Ulaşamıyor
**Hata:** `Network Error` veya CORS

**Çözüm:**
1. Backend URL'i kontrol et (https, trailing slash yok)
2. Backend'de CORS ayarlarını kontrol et
3. Vercel'de env var doğru mu?

### Problem 4: Google Drive OAuth Çalışmıyor
**Hata:** `redirect_uri_mismatch`

**Çözüm:**
1. Google Cloud Console → Credentials
2. OAuth Client'ta Authorized redirect URIs ekle:
   ```
   https://rahat-backup-api.onrender.com/v1/cloud-storage/google-drive/callback
   ```

---

## ✅ Deployment Checklist

### Before Deploy
- [ ] `.env.production` dosyaları hazır
- [ ] JWT_SECRET generate edildi (güçlü)
- [ ] AWS encryption key generate edildi
- [ ] Gmail App Password alındı
- [ ] Google OAuth production credentials hazır
- [ ] GitHub repository güncel

### Database
- [ ] Render PostgreSQL oluşturuldu
- [ ] Connection string kopyalandı
- [ ] `.env.production` güncellendi

### Backend
- [ ] Render Web Service oluşturuldu
- [ ] Environment variables eklendi
- [ ] Build successful
- [ ] Prisma migration çalıştı
- [ ] Logs'da hata yok

### Frontend
- [ ] Vercel project oluşturuldu
- [ ] REACT_APP_API_URL doğru
- [ ] Build successful
- [ ] Login sayfası açılıyor

### Testing
- [ ] Register çalışıyor
- [ ] Login çalışıyor
- [ ] Dashboard yükleniyor
- [ ] Database connection eklenebiliyor
- [ ] Backup job oluşturuluyor
- [ ] Backup çalıştırılabiliyor

---

## 🎉 Deploy Tamamlandı!

**Production URLs:**
- Frontend: `https://rahat-backup.vercel.app`
- Backend: `https://rahat-backup-api.onrender.com`
- Database: Render Internal (secure)

**Next Steps:**
1. 1 hafta staging test
2. Bug fixes
3. Custom domain ekle (opsiyonel)
4. SSL certificate (Render/Vercel otomatik)
5. Faz 2: Desktop Agent'a geç! 🖥️

---

## 💰 Maliyet (İlk 90 Gün)

| Service | Plan | Cost |
|---------|------|------|
| Render PostgreSQL | Starter | **$0** (90 gün) |
| Render Web Service | Free | **$0** |
| Vercel | Hobby | **$0** |
| **TOPLAM** | | **$0/ay** |

**90 gün sonra:**
- Render PostgreSQL: $7/ay
- Diğerleri: $0/ay
- **Toplam: $7/ay**

---

## 📞 Support

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
