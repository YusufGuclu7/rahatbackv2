# 🖥️ Rahat Backup - Desktop Agent Roadmap

## 📋 Executive Summary

**Problem:** Localhost database'ler cloud backend'den erişilemediği için backup alınamıyor.

**Çözüm:** Windows Desktop Agent - Kullanıcının PC'sinde çalışan, localhost DB'lere erişip backup alan, web dashboard ile entegre executor agent.

**Hedef Kullanıcı:** Developer'lar ve teknik kullanıcılar (localhost DB backup ihtiyacı olanlar)

**Platform:** Windows (.exe) - MVP

**Mod:** Background service + System tray + Web dashboard entegrasyonu

---

## 🔴 Problem Analysis - Neden Desktop Agent Gerekli?

### Mevcut Durum: Production'da Database Bağlantıları Çalışmıyor

**Senaryo:**
```
Kullanıcı: "localhost:5432'deki PostgreSQL'i backup almak istiyorum"
Web Dashboard: Database eklendi ✅
Backend (Render/Vercel): localhost:5432'ye bağlanmaya çalışıyor...
Sonuç: ❌ ECONNREFUSED - Connection failed!
```

### 🏗️ Mimari Diagram - Neden Çalışmıyor?

```
❌ MEVCUT MİMARİ (Web-Only - ÇALIŞMIYOR!)

┌──────────────────────────────────────────────────┐
│  KULLANICI PC'si (Windows Desktop)               │
│  ├── PostgreSQL (localhost:5432) ← PRIVATE      │
│  ├── MySQL (localhost:3306) ← PRIVATE           │
│  └── MSSQL (localhost:1433) ← PRIVATE           │
└──────────────────────────────────────────────────┘
                    ❌ Erişim YOK
                    (Firewall/NAT)
                         │
                         │
                    INTERNET
                         │
                         │
┌──────────────────────────────────────────────────┐
│  PRODUCTION SERVER (Render/Vercel)               │
│  ├── Backend API (Node.js)                       │
│  │   └── "localhost:5432"e bağlanmaya çalışıyor │
│  │       ❌ Başarısız! (Kendi localhost'una bakıyor)│
│  └── Frontend (React)                            │
└──────────────────────────────────────────────────┘
```

### 🔍 Problem Detayları

#### 1. "localhost" Kavram Kargaşası
```javascript
// 3 farklı "localhost" var!

// 1️⃣ Kullanıcının kafasındaki localhost:
"Benim bilgisayarımdaki database"

// 2️⃣ Backend'in gördüğü localhost (Production):
"Render/Vercel sunucusunun localhost'u"
// (Orada PostgreSQL yok!)

// 3️⃣ Backend'in gördüğü localhost (Development):
"Geliştirici makinenin localhost'u"
// (Geliştirme sırasında çalışır, production'da çalışmaz!)
```

**Sonuç:** Backend production'da **yanlış** localhost'a bakıyor!

#### 2. Network/Firewall Engelleri

**Kullanıcının DB'si neden erişilemez?**
- 🔒 **Firewall:** Router dışarıdan gelen bağlantıları engelliyor
- 🏠 **NAT (Network Address Translation):** Private IP (192.168.x.x) → Backend göremez
- 🚫 **ISP Kısıtlamaları:** Bazı ISP'ler DB portlarını blokluyor (3306, 5432, 1433)
- 🔄 **Dynamic IP:** Ev internet'i her restart'ta IP değişiyor
- 🛡️ **Güvenlik:** Database'i internete açmak **tehlikeli** ve **yapılmamalı**!

#### 3. Çözüm Denemeleri ve Neden Başarısız

```
❌ KÖTÜ ÇÖZÜM 1: "Database'ini internete aç"
   - Güvenlik riski (brute-force attacks, SQL injection)
   - Port forwarding gerekir (kullanıcı bilmeyebilir)
   - Dynamic IP problemi (her restart'ta IP değişir)
   - ISP firewall bypass gerekir
   - ⚠️ TEHLİKELİ VE ÖNERİLMEZ!

❌ KÖTÜ ÇÖZÜM 2: "VPN kullan"
   - Kompleks setup (teknik bilgi gerekir)
   - Sürekli çalışması gerekir (maliyet)
   - Performance kaybı
   - Kullanıcı deneyimi kötü

❌ KÖTÜ ÇÖZÜM 3: "Cloud database kullan"
   - Kullanıcı zaten localhost kullanmak istiyor!
   - Ek maliyet (AWS RDS, Cloud SQL)
   - Migration gerekir (karmaşık)
   - Kullanıcı senaryosuna uymaz
```

### ✅ ÇÖZÜM: Desktop Agent

```
✅ YENİ MİMARİ (Desktop Agent - ÇALIŞIYOR!)

┌──────────────────────────────────────────────────┐
│  KULLANICI PC'si (Windows Desktop)               │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │  Desktop Agent (Electron)              │     │
│  │  ├── Background Service                │     │
│  │  ├── System Tray UI                    │     │
│  │  └── Backup Engine                     │     │
│  └────────────────────────────────────────┘     │
│            │ (internal - same machine)          │
│            ↓ ✅ ERIŞEBILIR!                      │
│  ┌────────────────────────────────────────┐     │
│  │  Databases                             │     │
│  │  ├── PostgreSQL :5432                  │     │
│  │  ├── MySQL :3306                       │     │
│  │  └── MSSQL :1433                       │     │
│  └────────────────────────────────────────┘     │
│            │                                     │
│            ↓ (backup files)                     │
│  ┌────────────────────────────────────────┐     │
│  │  C:\RahatBackup\backups\               │     │
│  └────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
            │
            │ HTTPS (443) ✅ Firewall izin verir
            │ - Job polling (GET /v1/agent/jobs)
            │ - Status updates (PATCH /v1/agent/jobs/:id)
            │ - Cloud uploads (S3, Google Drive)
            ↓
┌──────────────────────────────────────────────────┐
│  PRODUCTION SERVER (Render/Vercel)               │
│  ├── Backend API (Node.js)                       │
│  │   ├── Agent jobs yönetir                     │
│  │   ├── Status'leri takip eder                 │
│  │   └── Web dashboard'a servis eder            │
│  └── Frontend (React)                            │
│      └── User backup'ları web'den izler          │
└──────────────────────────────────────────────────┘
            │
            ↓
┌──────────────────────────────────────────────────┐
│  CLOUD STORAGE                                   │
│  ├── AWS S3                                      │
│  └── Google Drive                                │
└──────────────────────────────────────────────────┘
```

### 🎯 Agent Neden Çalışıyor?

| Problem | Web-Only Çözümü | Agent Çözümü |
|---------|-----------------|--------------|
| **localhost erişimi** | Backend yanlış localhost'a bakıyor ❌ | Agent doğru localhost'ta (aynı PC) ✅ |
| **Firewall/NAT** | Dışarıdan DB'ye erişim engelli ❌ | Agent internal bağlantı (firewall'a takılmaz) ✅ |
| **Güvenlik riski** | DB'yi internete açmak tehlikeli ❌ | DB kapalı kalıyor, sadece agent erişir ✅ |
| **Port forwarding** | Karmaşık, kullanıcı bilmeyebilir ❌ | Gerekmiyor! ✅ |
| **Dynamic IP** | Her restart'ta IP değişir ❌ | IP önemsiz (localhost) ✅ |
| **ISP kısıtlamaları** | DB portları bloklu ❌ | HTTPS (443) kullanıyor, izinli ✅ |

### 📊 Senaryo Karşılaştırması

#### ❌ Web-Only Senaryosu:
```
1. User → Web'de DB ekler: localhost:5432
2. Web → Backend'e gönderir
3. Backend (Render'da) → "localhost:5432"e bağlanmaya çalışır
4. Backend → Kendi localhost'una bakıyor (boş!)
5. Sonuç: ❌ ECONNREFUSED - Connection failed!

Kullanıcı: "Ama benim DB çalışıyor ki?" 😕
```

#### ✅ Desktop Agent Senaryosu:
```
1. User → Web'de DB ekler: localhost:5432
2. User → Web'de backup job oluşturur
3. Web → Backend'e kaydeder (job: "pending")
4. Desktop Agent (User'ın PC'sinde):
   - 30 saniyede bir: "Yeni job var mı?" diye sorar
   - Backend: "Evet, localhost:5432'yi backup al"
   - Agent: "Tamam!" → Aynı PC'de olduğu için direkt erişir ✅
5. Agent → Backup alır → S3'e yükler
6. Agent → Backend'e bildirir: "Job tamamlandı ✅"
7. Web Dashboard → "Backup başarılı!" gösterir 🎉

Kullanıcı: "Harika, çalışıyor!" 😊
```

### 🔐 Güvenlik Avantajları

```
Agent ile güvenlik ARTIYOR (azalmıyor!):

✅ Database internete kapalı kalıyor
✅ Port forwarding gerekmiyor
✅ Firewall kurallarını değiştirmeye gerek yok
✅ Agent-Backend arası JWT token ile authenticate
✅ Agent-Backend arası sadece HTTPS (SSL/TLS)
✅ DB credentials encrypt edilmiş şekilde backend'den geliyor
✅ Lokal backuplar encryption ile korunuyor (AES-256)

Firewall Kuralları:
  ✅ İzinli (OUTBOUND - Giden): HTTPS (443) - Agent'ın kullandığı
  ❌ Bloklu (INBOUND - Gelen): DB portları (3306, 5432, 1433)

→ Agent GİDEN bağlantı kullandığı için firewall sorun değil!
```

### 📈 Kullanıcı Deneyimi

**Kullanıcı Beklentisi:**
> "Bilgisayarımdaki PostgreSQL'i otomatik olarak yedeklemek istiyorum"

**Web-Only ile:** ❌ İmkansız
**Agent ile:** ✅ Mümkün!

```
Kullanıcı adımları:
1. RahatBackup-Setup.exe indir (2 dakika)
2. Kur ve login ol (2 dakika)
3. Web dashboard'da backup job oluştur (3 dakika)
4. Agent otomatik çalışır, backup alır
5. ✅ Tamamlandı!

→ Toplam 7 dakika, teknik bilgi gerekmez!
```

---

## 🎯 Agent Özellikleri (MVP v1.0)

### ✅ Core Features (Must Have)

| Özellik | Açıklama | Öncelik |
|---------|----------|---------|
| **Localhost DB Access** | PostgreSQL, MySQL, MSSQL, MongoDB, MariaDB localhost'a bağlanma | P0 |
| **Multi-Database Support** | Tek agent ile birden fazla local DB (örn: localhost:5432 + localhost:3306) | P0 |
| **Web Dashboard Integration** | API üzerinden job'ları çekme, backend'e sync | P0 |
| **Background Service** | Windows başlangıcında otomatik çalışma | P0 |
| **System Tray UI** | Minimal tray icon + context menu | P0 |
| **JWT Authentication** | Web hesabı ile login (email/password → JWT token) | P0 |
| **Backup Execution** | Full, Incremental, Differential backup | P0 |
| **Restore Execution** | Local backup'tan veya cloud'dan restore | P0 |
| **Storage Options** | Local (C:\RahatBackup\backups) VEYA Cloud (S3, Google Drive) | P0 |
| **Cloud Upload** | Local'de backup al, cloud'a upload, sonra local'i sil (user choice) | P0 |
| **Logging** | Agent'ta logs sayfası + C:\RahatBackup\logs\agent.log | P0 |
| **Web Dashboard Logs** | Backend'e log/status raporlama | P0 |

### ⏭️ Future Features (v1.1+)

| Özellik | Açıklama | Versiyon |
|---------|----------|----------|
| Auto-Update | electron-updater ile otomatik güncelleme | v1.1 |
| Network Discovery | Local network DB'ler (192.168.x.x) | v1.2 |
| Mac Support | .dmg installer | v1.3 |
| Linux Support | .AppImage | v1.4 |

---

## 🏗️ Teknik Mimari

### Technology Stack

```
Desktop Agent
├── Electron ^28.0.0 (Framework)
│   ├── Main Process (Node.js backend)
│   │   ├── Express server (API endpoint'ler için)
│   │   ├── node-cron (polling scheduler)
│   │   ├── axios (backend API client)
│   │   └── Database connectors (mevcut backend kodları)
│   └── Renderer Process (React UI)
│       ├── React ^18.3.1 (mevcut frontend)
│       ├── Material-UI (mevcut component'ler)
│       └── System Tray UI (minimal)
├── electron-store ^8.1.0 (Local config/settings)
├── winston ^3.11.0 (Logging)
└── electron-builder ^24.0.0 (Build & Package)
```

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DESKTOP AGENT                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Main Process (Node.js)                   │ │
│  │                                                       │ │
│  │  ┌──────────────┐      ┌──────────────────────────┐ │ │
│  │  │ System Tray  │      │   Polling Service        │ │ │
│  │  │   (Icon +    │      │   (node-cron)            │ │ │
│  │  │   Menu)      │      │   - Every 30s check API  │ │ │
│  │  └──────────────┘      │   - Fetch pending jobs   │ │ │
│  │                        └──────────────────────────┘ │ │
│  │                                                       │ │
│  │  ┌──────────────────────────────────────────────────┐│ │
│  │  │         Backup Engine                            ││ │
│  │  │  ┌──────────────┐  ┌──────────────┐             ││ │
│  │  │  │ postgresql   │  │   mysql      │             ││ │
│  │  │  │ connector    │  │   connector  │  ...        ││ │
│  │  │  └──────────────┘  └──────────────┘             ││ │
│  │  └──────────────────────────────────────────────────┘│ │
│  │                                                       │ │
│  │  ┌──────────────────────────────────────────────────┐│ │
│  │  │         Cloud Upload Service                     ││ │
│  │  │   - S3 connector                                 ││ │
│  │  │   - Google Drive connector                       ││ │
│  │  └──────────────────────────────────────────────────┘│ │
│  │                                                       │ │
│  │  ┌──────────────────────────────────────────────────┐│ │
│  │  │         API Client (Backend Sync)                ││ │
│  │  │   - JWT token management                         ││ │
│  │  │   - Fetch jobs from web backend                  ││ │
│  │  │   - Report status/logs to backend                ││ │
│  │  └──────────────────────────────────────────────────┘│ │
│  │                                                       │ │
│  │  ┌──────────────────────────────────────────────────┐│ │
│  │  │    Local Storage (electron-store)                ││ │
│  │  │   - JWT token (encrypted)                        ││ │
│  │  │   - Agent settings                               ││ │
│  │  │   - Last sync timestamp                          ││ │
│  │  └──────────────────────────────────────────────────┘│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Renderer Process (React UI)                   │ │
│  │   - Tray window (minimal)                             │ │
│  │   - Logs window                                       │ │
│  │   - Settings window                                   │ │
│  │   - Login window                                      │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ↕ (HTTPS - JWT Token)
┌─────────────────────────────────────────────────────────────┐
│              WEB BACKEND (Cloud)                            │
│   - /v1/agent/jobs GET (pending jobs for agent)             │
│   - /v1/agent/jobs/:id/status PATCH (report job status)     │
│   - /v1/agent/register POST (agent registration)            │
│   - /v1/auth/login POST (get JWT token)                     │
└─────────────────────────────────────────────────────────────┘
         ↕
┌─────────────────────────────────────────────────────────────┐
│              WEB DASHBOARD (React)                          │
│   - User creates backup jobs                                │
│   - User assigns jobs to agent                              │
│   - User monitors agent status                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Proje Yapısı

```
rahatbackv2/
├── backend/           (Mevcut)
├── frontend/          (Mevcut)
└── desktop-agent/     (YENİ)
    ├── package.json
    ├── electron-builder.yml
    ├── forge.config.js (opsiyonel)
    │
    ├── resources/     (Icons, installers)
    │   ├── icon.ico   (Windows icon)
    │   ├── icon.png   (Tray icon)
    │   └── installer/ (NSIS custom pages)
    │
    ├── src/
    │   ├── main/      (Electron Main Process)
    │   │   ├── index.js          (Entry point)
    │   │   ├── app.js            (App initialization)
    │   │   ├── tray.js           (System tray management)
    │   │   ├── windows.js        (Window management)
    │   │   │
    │   │   ├── api/              (Backend API client)
    │   │   │   ├── client.js     (axios instance + JWT interceptor)
    │   │   │   ├── auth.js       (login, register agent)
    │   │   │   ├── jobs.js       (fetch jobs, update status)
    │   │   │   └── logs.js       (send logs to backend)
    │   │   │
    │   │   ├── services/
    │   │   │   ├── backup.service.js    (Backup orchestrator)
    │   │   │   ├── restore.service.js   (Restore orchestrator)
    │   │   │   ├── storage.service.js   (Local/Cloud storage)
    │   │   │   ├── polling.service.js   (Job polling - node-cron)
    │   │   │   └── logger.service.js    (Winston logger)
    │   │   │
    │   │   ├── connectors/       (Database connectors - from backend)
    │   │   │   ├── index.js
    │   │   │   ├── postgresql.connector.js
    │   │   │   ├── mysql.connector.js
    │   │   │   ├── mssql.connector.js
    │   │   │   ├── mongodb.connector.js
    │   │   │   └── mariadb.connector.js
    │   │   │
    │   │   ├── cloud/            (Cloud storage - from backend)
    │   │   │   ├── s3.connector.js
    │   │   │   └── googleDrive.connector.js
    │   │   │
    │   │   ├── utils/
    │   │   │   ├── encryption.js (AES-256 - from backend)
    │   │   │   ├── compression.js
    │   │   │   └── paths.js      (Agent paths: backups, logs, config)
    │   │   │
    │   │   └── config/
    │   │       ├── constants.js  (Backend URL, polling interval)
    │   │       └── store.js      (electron-store config)
    │   │
    │   └── renderer/  (React UI)
    │       ├── index.html
    │       ├── index.js
    │       ├── App.js
    │       │
    │       ├── windows/
    │       │   ├── TrayWindow.js      (System tray popup - minimal)
    │       │   ├── LoginWindow.js     (First-time login)
    │       │   ├── LogsWindow.js      (Agent logs viewer)
    │       │   └── SettingsWindow.js  (Agent settings)
    │       │
    │       ├── components/
    │       │   ├── StatusIndicator.js (Agent status badge)
    │       │   ├── JobItem.js         (Running job display)
    │       │   └── LogViewer.js       (Log display component)
    │       │
    │       └── styles/
    │           └── tray.css
    │
    └── dist/          (Build output - .gitignore)
        ├── RahatBackup-Setup-1.0.0.exe (Windows installer)
        └── win-unpacked/ (Development build)
```

---

## 🚀 Implementation Roadmap (3 Haftalık Plan)

### **HAFTA 1: Foundation & Setup (5 gün)**

#### Gün 1-2: Proje Setup & Electron Basics
```bash
# Desktop agent projesi oluştur
mkdir desktop-agent
cd desktop-agent
npm init -y

# Dependencies kur
npm install electron electron-builder electron-store axios winston node-cron
npm install react react-dom @mui/material @emotion/react @emotion/styled
npm install --save-dev electron-rebuild webpack webpack-cli
```

**Deliverables:**
- [x] `package.json` configured
- [x] Basic Electron app runs (Hello World)
- [x] System tray icon appears
- [x] Dev mode hot reload working

**Files to create:**
- `src/main/index.js` - Electron main entry
- `src/main/tray.js` - System tray
- `src/renderer/index.html` - Basic UI
- `electron-builder.yml` - Build config

---

#### Gün 3-4: Backend Connector Migration
**Görev:** Backend'deki database connector'ları agent'a taşı

```bash
# Backend'den kopyala
cp -r ../backend/src/utils/dbConnectors/* src/main/connectors/
cp ../backend/src/utils/encryption.js src/main/utils/
```

**Adaptasyon gerekli yerleri düzelt:**
- Prisma bağımlılıklarını çıkar (agent Prisma kullanmayacak)
- File path'leri agent paths'e göre güncelle
- Logger'ı winston'a adapt et

**Test:**
- Localhost PostgreSQL'e bağlan
- Backup al, dosyayı C:\RahatBackup\backups\ altına kaydet
- Compression çalışıyor mu kontrol et

**Deliverables:**
- [x] All 5 DB connectors working
- [x] Test script: `npm run test:connectors`
- [x] Backup taken from localhost:5432
- [x] File saved locally

---

#### Gün 5: API Client & Authentication
**Görev:** Backend API ile konuşan client yaz

```javascript
// src/main/api/client.js
const axios = require('axios');
const Store = require('electron-store');

const store = new Store();
const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// JWT token interceptor
apiClient.interceptors.request.use((config) => {
  const token = store.get('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

module.exports = apiClient;
```

**API Endpoints (Backend'e eklenecek):**
- `POST /v1/auth/login` - Existing (no change)
- `POST /v1/agent/register` - NEW (agent registers with backend)
- `GET /v1/agent/jobs` - NEW (get pending jobs for agent)
- `PATCH /v1/agent/jobs/:id/status` - NEW (update job status)
- `POST /v1/agent/logs` - NEW (send agent logs)

**Deliverables:**
- [x] Login working (JWT token saved)
- [x] Agent registration working
- [x] API client ready

---

### **HAFTA 2: Core Features (5 gün)**

#### Gün 6-7: Job Polling & Execution Engine
**Görev:** Periyodik olarak backend'den job çek ve çalıştır

```javascript
// src/main/services/polling.service.js
const cron = require('node-cron');
const { fetchPendingJobs } = require('../api/jobs');
const { executeBackup } = require('./backup.service');

let pollingTask = null;

function startPolling() {
  // Her 30 saniyede bir kontrol et
  pollingTask = cron.schedule('*/30 * * * * *', async () => {
    try {
      const jobs = await fetchPendingJobs();

      for (const job of jobs) {
        await executeBackup(job);
      }
    } catch (error) {
      logger.error('Polling error:', error);
    }
  });
}

module.exports = { startPolling, stopPolling };
```

**Backup Execution Flow:**
```
1. Polling service → API'den pending jobs al
2. Her job için:
   a. Job status = 'running' (backend'e bildir)
   b. DB credentials'ları decrypt et (backend'den geliyor)
   c. Connector'a gönder (postgresql, mysql, etc.)
   d. Backup al → C:\RahatBackup\backups\{jobId}\
   e. Compress (gzip)
   f. Encrypt (if enabled)
   g. Storage seçimi:
      - Local: Dosyayı lokal'de bırak
      - Cloud: Upload → Cloud'a yükle → Local'i sil
   h. Job status = 'completed' (backend'e bildir + log)
3. Hata durumunda:
   - Job status = 'failed'
   - Error log'u backend'e gönder
```

**Deliverables:**
- [x] Polling working (30s interval)
- [x] Backup execution working
- [x] Error handling working
- [x] Status updates sent to backend

---

#### Gün 8: Cloud Upload Integration
**Görev:** Backup'ı S3 ve Google Drive'a yükle

```bash
# Backend'den cloud connector'ları kopyala
cp -r ../backend/src/utils/cloudStorage/* src/main/cloud/
```

**Adaptasyon:**
- AWS SDK ve Google APIs kurulu mu kontrol et
- Credentials'ları backend API'den çek (user'ın cloud storage settings'i)

**Flow:**
```javascript
// src/main/services/storage.service.js
async function handleBackupStorage(job, backupFilePath) {
  const { storageType, cloudStorageId } = job;

  if (storageType === 'LOCAL') {
    // Dosyayı lokal'de bırak
    logger.info(`Backup saved locally: ${backupFilePath}`);
    return { location: 'local', path: backupFilePath };
  }

  if (storageType === 'CLOUD') {
    // Cloud storage ayarlarını backend'den al
    const cloudStorage = await fetchCloudStorageById(cloudStorageId);

    // Upload
    const cloudUrl = await uploadToCloud(cloudStorage, backupFilePath);

    // Local'i sil
    await fs.unlink(backupFilePath);

    logger.info(`Backup uploaded to cloud: ${cloudUrl}`);
    return { location: 'cloud', url: cloudUrl };
  }
}
```

**Deliverables:**
- [x] S3 upload working
- [x] Google Drive upload working
- [x] Local backup option working
- [x] Local file cleanup after cloud upload

---

#### Gün 9: Restore Functionality
**Görev:** Restore feature ekle

```javascript
// src/main/services/restore.service.js
async function executeRestore(restoreJob) {
  const { backupHistoryId, databaseId, restoreOptions } = restoreJob;

  // 1. Backup dosyasını bul
  const backupHistory = await fetchBackupHistory(backupHistoryId);

  let backupFilePath;
  if (backupHistory.storageType === 'LOCAL') {
    backupFilePath = backupHistory.localPath;
  } else {
    // Cloud'dan indir
    backupFilePath = await downloadFromCloud(backupHistory.cloudUrl);
  }

  // 2. Decrypt (if encrypted)
  if (backupHistory.isEncrypted) {
    backupFilePath = await decryptFile(backupFilePath, restoreOptions.password);
  }

  // 3. Decompress
  backupFilePath = await decompressFile(backupFilePath);

  // 4. Database'e restore et
  const dbConfig = await fetchDatabaseConfig(databaseId);
  const connector = getConnector(dbConfig.type);

  await connector.restore(dbConfig, backupFilePath, restoreOptions);

  // 5. Cleanup
  await fs.unlink(backupFilePath);

  // 6. Report success
  await updateRestoreJobStatus(restoreJob.id, 'completed');
}
```

**Deliverables:**
- [x] Restore from local working
- [x] Restore from cloud working
- [x] Encrypted backup restore working
- [x] All 5 DB types restore working

---

#### Gün 10: Logging & Error Handling
**Görev:** Comprehensive logging system

```javascript
// src/main/services/logger.service.js
const winston = require('winston');
const path = require('path');
const { app } = require('electron');

const logDir = path.join(app.getPath('userData'), 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // File log
    new winston.transports.File({
      filename: path.join(logDir, 'agent.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Console log (dev mode)
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Backend'e log gönder
async function sendLogToBackend(level, message, metadata) {
  try {
    await apiClient.post('/v1/agent/logs', {
      level,
      message,
      metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    // Backend'e gönderemediyse sessizce fail et
  }
}
```

**Deliverables:**
- [x] Local log file working (C:\Users\{user}\AppData\Roaming\RahatBackup\logs\agent.log)
- [x] Backend'e log sync working
- [x] Error handling comprehensive
- [x] Log rotation working (max 10MB × 5 files)

---

### **HAFTA 3: UI, Polish & Distribution (5 gün)**

#### Gün 11-12: System Tray UI
**Görev:** Minimal ama kullanışlı tray UI

**System Tray Menu:**
```
┌─────────────────────────────┐
│ Rahat Backup Agent          │
│ Status: ● Active            │ (yeşil dot)
├─────────────────────────────┤
│ Running Jobs: 2             │
│  ├─ PostgreSQL Backup (45%) │
│  └─ MySQL Backup (queued)   │
├─────────────────────────────┤
│ ⚙️  Open Settings            │
│ 📋 View Logs                 │
│ 🌐 Open Web Dashboard        │
├─────────────────────────────┤
│ ⏸️  Pause Agent              │
│ 🔄 Sync Now                  │
├─────────────────────────────┤
│ ❌ Quit                       │
└─────────────────────────────┘
```

**Tray Popup Window (On click):**
- Mini dashboard (200px × 300px)
- Last 3 backups status
- Agent status indicator
- Quick actions

**Deliverables:**
- [x] System tray icon + menu
- [x] Tray popup window
- [x] Status indicators working
- [x] Quick actions working

---

#### Gün 13: Login & Settings UI
**Görev:** İlk açılışta login, settings sayfası

**Login Window (First Launch):**
```
┌──────────────────────────────────────┐
│      Welcome to Rahat Backup         │
│                                      │
│  Email:    [________________]        │
│  Password: [________________]        │
│                                      │
│  [ ] Remember me                     │
│                                      │
│       [     Login     ]              │
│                                      │
│  Don't have account? Sign up on web │
└──────────────────────────────────────┘
```

**Settings Window:**
```
┌──────────────────────────────────────┐
│      Agent Settings                  │
│                                      │
│  Backend URL:                        │
│  [https://api.yourdomain.com    ]   │
│                                      │
│  Polling Interval:                   │
│  [30] seconds                        │
│                                      │
│  Auto-start on boot:                 │
│  [x] Enabled                         │
│                                      │
│  Storage Path:                       │
│  [C:\RahatBackup\backups   ] [...]  │
│                                      │
│  [ Save ]  [ Cancel ]                │
└──────────────────────────────────────┘
```

**Deliverables:**
- [x] Login window working
- [x] JWT token saved securely
- [x] Settings window working
- [x] Settings persisted (electron-store)

---

#### Gün 14: Logs Viewer UI
**Görev:** Agent log'larını görüntüle

**Logs Window:**
```
┌────────────────────────────────────────────────┐
│      Agent Logs                         [x]    │
├────────────────────────────────────────────────┤
│ Filter: [All ▼] [Info ▼] [Warning ▼] [Error ▼]│
│ Search: [________________] [🔍]                │
├────────────────────────────────────────────────┤
│                                                │
│ 2025-01-20 14:32:15 [INFO]  Polling started   │
│ 2025-01-20 14:32:45 [INFO]  Fetched 3 jobs    │
│ 2025-01-20 14:33:00 [INFO]  Backup started... │
│ 2025-01-20 14:35:12 [SUCCESS] Backup complete │
│ 2025-01-20 14:35:15 [INFO]  Uploaded to S3    │
│ 2025-01-20 14:40:00 [ERROR] Connection failed │
│   └─ Details: ECONNREFUSED localhost:5432     │
│                                                │
├────────────────────────────────────────────────┤
│ [Clear Logs] [Export] [Refresh]        1/50   │
└────────────────────────────────────────────────┘
```

**Deliverables:**
- [x] Log viewer UI working
- [x] Filter by level (info, warning, error)
- [x] Search functionality
- [x] Export logs (txt file)

---

#### Gün 15: Build & Distribution
**Görev:** Windows installer (.exe) oluştur

**electron-builder config:**
```yaml
# electron-builder.yml
appId: com.rahatbackup.agent
productName: Rahat Backup Agent
copyright: Copyright © 2025 Rahat Backup

directories:
  output: dist
  buildResources: resources

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: false
  createStartMenuShortcut: true
  shortcutName: Rahat Backup Agent
  include: resources/installer/installer.nsh

  # Custom install dir
  installerHeader: resources/installer/header.bmp
  installerSidebar: resources/installer/sidebar.bmp
```

**Build commands:**
```bash
# Development build (quick test)
npm run build:dev

# Production build
npm run build:prod

# Output:
# dist/RahatBackup-Setup-1.0.0.exe (installer)
# dist/win-unpacked/ (portable)
```

**Deliverables:**
- [x] Build successful
- [x] Installer tested on clean Windows 10/11
- [x] Auto-start on boot working
- [x] Uninstaller working

---

## 🔌 Backend API Extensions (Yeni Endpoint'ler)

Agent için backend'e eklenecek endpoint'ler:

### 1. Agent Registration
```javascript
// POST /v1/agent/register
// Body: { agentName, machineId, platform, version }
// Response: { agentId, status: 'registered' }
```

### 2. Fetch Pending Jobs
```javascript
// GET /v1/agent/jobs?status=pending&agentId={agentId}
// Response: [
//   {
//     id, jobId, databaseId, backupType,
//     schedule, storageType, cloudStorageId,
//     database: { host, port, username, password (encrypted), type }
//   }
// ]
```

### 3. Update Job Status
```javascript
// PATCH /v1/agent/jobs/:id/status
// Body: { status: 'running' | 'completed' | 'failed', logs, metadata }
```

### 4. Send Agent Logs
```javascript
// POST /v1/agent/logs
// Body: { level, message, metadata, timestamp }
```

### 5. Fetch Cloud Storage Config
```javascript
// GET /v1/agent/cloud-storage/:id
// Response: { type, credentials (encrypted), bucket, region }
```

### 6. Agent Heartbeat
```javascript
// POST /v1/agent/heartbeat
// Body: { agentId, status: 'online' | 'busy' | 'offline' }
// Response: { ok: true, serverTime }
```

**Backend Implementation (Hafta 3 - Gün 13-14):**
- `backend/src/routes/v1/agent.route.js` - Yeni route file
- `backend/src/controllers/agent.controller.js` - Controller
- `backend/src/services/agent.service.js` - Business logic
- `backend/src/models/agent.model.js` - Agent model (optional)
- Prisma migration - Agent table (optional, şimdilik User ile ilişkilendir)

---

## 📊 Database Schema Updates (Backend)

Agent için minimal schema değişiklikleri:

```prisma
// backend/src/prisma/schema.prisma

model BackupJob {
  // ... existing fields

  // Agent assignment
  assignedToAgent String?  // User'ın agent'ını belirtmek için (opsiyonel)
  runOnAgent      Boolean @default(true)  // True = agent'ta çalışacak

  @@index([userId, runOnAgent])
}

model BackupHistory {
  // ... existing fields

  // Agent info
  executedByAgent String?  // Hangi agent çalıştırdı
  agentVersion    String?

  @@index([executedByAgent])
}

// Opsiyonel: Agent tracking (gelecekte multi-agent için)
model Agent {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  agentName   String   // User-defined name
  machineId   String   @unique  // Machine identifier
  platform    String   // "win32"
  version     String   // Agent version

  status      String   @default("offline")  // online, offline, busy
  lastSeen    DateTime @updatedAt

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([status])
}
```

**Migration:**
```bash
cd backend
npx prisma migrate dev --name add_agent_support
```

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
// desktop-agent/__tests__/unit/
├── connectors/
│   ├── postgresql.test.js
│   ├── mysql.test.js
│   └── ...
├── services/
│   ├── backup.service.test.js
│   ├── restore.service.test.js
│   └── polling.service.test.js
└── api/
    └── client.test.js
```

**Coverage Target:** 70%+

### Integration Tests
```javascript
// desktop-agent/__tests__/integration/
├── backup-flow.test.js      // End-to-end backup test
├── restore-flow.test.js     // End-to-end restore test
└── api-sync.test.js         // Backend sync test
```

### Manual Testing Checklist
- [ ] Install on clean Windows 10
- [ ] Install on clean Windows 11
- [ ] Login with web credentials
- [ ] Backup localhost PostgreSQL
- [ ] Backup localhost MySQL
- [ ] Upload to S3
- [ ] Upload to Google Drive
- [ ] Restore from local
- [ ] Restore from cloud
- [ ] Agent survives PC restart
- [ ] Uninstall clean

---

## 📦 Distribution & Deployment

### Release Process

1. **Versioning:**
   - Semantic versioning: v1.0.0, v1.0.1, v1.1.0
   - Update `package.json` version
   - Git tag: `git tag v1.0.0`

2. **Build:**
   ```bash
   npm run build:prod
   ```

3. **Test Installer:**
   - Install on clean Windows VM
   - Run full test checklist
   - Check logs for errors

4. **Upload to GitHub Releases:**
   ```bash
   gh release create v1.0.0 \
     dist/RahatBackup-Setup-1.0.0.exe \
     --title "Rahat Backup Agent v1.0.0" \
     --notes "Initial release"
   ```

5. **Update Download Link:**
   - Web dashboard: "Download Agent" button
   - Direct link: `https://github.com/yourorg/rahat-backup/releases/latest`

### Auto-Update (v1.1+)
```javascript
// Future: electron-updater
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'yourorg',
  repo: 'rahat-backup',
});

autoUpdater.checkForUpdatesAndNotify();
```

---

## 🚨 Risk Management

### Risk 1: Agent Crash / Hanging
**Problem:** Agent process crash olursa backup'lar durur

**Çözüm:**
- Winston error logging (crash öncesi log)
- Electron crash reporter
- Backend'e heartbeat gönder (30s), timeout'ta alert
- Process monitor (opsiyonel: PM2 style restart)

### Risk 2: Credential Security
**Problem:** DB credentials agent'ta saklanacak

**Çözüm:**
- Credentials backend'den gelir (encrypt edilmiş)
- Agent'ta decrypt et, memory'de tut
- electron-store encrypted mode kullan
- Hassas data'yı disk'e yazma

### Risk 3: Network Failure During Backup
**Problem:** Backup sırasında internet kesilirse?

**Çözüm:**
- Backup local'e tamamen kaydedilir
- Cloud upload ayrı adım (retry mechanism)
- 3 retry + exponential backoff
- Başarısız upload'lar queue'da bekler, sonra tekrar dener

### Risk 4: Large Backup Files
**Problem:** Multi-GB backup upload yavaş

**Çözüm:**
- Progress tracking (real-time)
- Stream-based upload (chunk'lar halinde)
- Pause/Resume support (v1.1+)
- Background upload (UI block etmez)

### Risk 5: Multiple Agents per User
**Problem:** Kullanıcı birden fazla PC'de agent kurarsa?

**Çözüm:**
- Agent registration ile her agent unique ID alır
- Web dashboard'da tüm agent'lar listelenir
- Job assignment: "Run on Agent 1" veya "Run on any available agent"
- (v1.0'da desteklenmeyebilir, v1.2+ için plan)

---

## 🎯 Success Metrics (MVP v1.0)

### Technical KPIs
- [ ] **Agent Build Success:** Installer (.exe) başarıyla oluşturuldu
- [ ] **Install Success Rate:** %100 (clean Windows 10/11'de)
- [ ] **Backup Success Rate:** >95% (localhost DB'ler için)
- [ ] **Cloud Upload Success:** >95%
- [ ] **Restore Success Rate:** >95%
- [ ] **Agent Uptime:** >99.5% (crash rate <0.5%)
- [ ] **Memory Usage:** <200MB (idle), <500MB (backup sırasında)
- [ ] **CPU Usage:** <1% (idle), <20% (backup sırasında)
- [ ] **Test Coverage:** >70%

### User Experience KPIs
- [ ] **Setup Time:** <5 dakika (download + install + login)
- [ ] **First Backup Time:** <10 dakika (ilk job oluştur + agent çalıştır)
- [ ] **User Errors:** <5% (installation/setup hatası)
- [ ] **Support Tickets:** <2/hafta (MVP phase)

---

## 📚 Documentation (Son Gün)

### User Documentation
- **AGENT_SETUP_GUIDE.md** - Kullanıcı kurulum guide
- **AGENT_TROUBLESHOOTING.md** - Sorun giderme
- **AGENT_FAQ.md** - Sıkça sorulan sorular

### Developer Documentation
- **AGENT_ARCHITECTURE.md** - Teknik mimari
- **AGENT_API.md** - Backend API integration
- **AGENT_DEVELOPMENT.md** - Development guide
- **AGENT_BUILD.md** - Build & distribution

---

## 🎉 Sprint Checklist (Hafta Sonu Kontrolleri)

### Hafta 1 Bitiş Kontrolü ✅
- [ ] Electron app çalışıyor
- [ ] System tray icon var
- [ ] Tüm DB connector'lar test edildi
- [ ] API client login yapabiliyor
- [ ] JWT token güvenli şekilde saklanıyor

### Hafta 2 Bitiş Kontrolü ✅
- [ ] Polling service çalışıyor (30s interval)
- [ ] Backend'den job'lar çekiliyor
- [ ] Backup alınıp local'e kaydediliyor
- [ ] Cloud upload (S3 + Google Drive) çalışıyor
- [ ] Restore functionality çalışıyor
- [ ] Log system working (local + backend)

### Hafta 3 Bitiş Kontrolü ✅
- [ ] System tray UI polished
- [ ] Login window çalışıyor
- [ ] Settings window çalışıyor
- [ ] Logs viewer çalışıyor
- [ ] Windows installer (.exe) oluşturuldu
- [ ] Clean Windows'ta test edildi
- [ ] Backend API endpoints eklendi
- [ ] Documentation tamamlandı

---

## 🔮 Future Roadmap (Post v1.0)

### v1.1 - Stability & Polish (2 hafta)
- [ ] Auto-update (electron-updater)
- [ ] Better error messages
- [ ] Progress bars for uploads
- [ ] Notification system (Windows toast)
- [ ] Pause/Resume backup

### v1.2 - Network Support (2 hafta)
- [ ] Local network DB discovery (192.168.x.x)
- [ ] Multi-agent management (web dashboard)
- [ ] Agent groups/tags
- [ ] Bandwidth throttling

### v1.3 - Mac Support (3 hafta)
- [ ] Mac .dmg installer
- [ ] Menu bar app (Mac tray equivalent)
- [ ] Mac-specific paths
- [ ] Code signing (Apple Developer)

### v1.4 - Linux Support (2 hafta)
- [ ] .AppImage
- [ ] .deb package
- [ ] Systemd service

### v2.0 - Advanced Features (4+ hafta)
- [ ] Backup verification (integrity check)
- [ ] Bandwidth scheduling (backup at night)
- [ ] P2P backup sync (between agents)
- [ ] CLI mode (headless server)

---

## 💬 Next Steps

**Şimdi yapılacaklar:**
1. ✅ **Roadmap Review** - Bu roadmap'i inceleyin, feedback verin
2. 🛠️ **Desktop Agent Projesi Oluştur** - `mkdir desktop-agent && cd desktop-agent`
3. 📦 **Dependencies Kur** - `npm install electron electron-builder ...`
4. 🚀 **Gün 1'e Başla** - Basic Electron app + System tray

**Sorular?**
- Herhangi bir adım net değil mi?
- Farklı bir yaklaşım öneriyor musunuz?
- Timeline'ı değiştirmek ister misiniz?

Benimle birlikte implement edeceğiz, her adımda yanınızdayım! 🚀

**Hazır mısınız? Başlayalım! 🎯**
