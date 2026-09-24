/**
 * Okul360 - Kapsamlı Otomasyon Test Süiti (QA Test Suite)
 * 
 * Bu test süiti aşağıdaki modülleri yerel backend veya canlı sunucu üzerinde uçtan uca test eder:
 * 1. Okul Kaydı (Zorunlu alanlar, mükerrer kullanıcı adı, Türkçe karakterler, telefon formatları, logo yükleme)
 * 2. Personel Girişi (Admin, Teacher, Security, Superadmin, yanlış şifre, büyük/küçük harf duyarlılığı)
 * 3. Veli Girişi (05xx, +905xx, boşluklu, tireli, olmayan telefon, eksik telefon)
 * 4. Öğrenci İşlemleri & Kota Sınırı (Zorunlu alanlar, 15 kota sınırı, 16. öğrenci 403 kontrolü)
 * 5. Süper Admin İşlemleri (Okul listeleme, kota artırma, süre uzatma)
 * 6. Ek Servisler (Yoklama, Günlük Rapor, Duyuru, Yemek Menüsü, Hesap Silme)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI Renk Kodları
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

const results = [];
let passedCount = 0;
let failedCount = 0;
let skippedCount = 0;

// Test Yardımcısı
async function testCase(id, category, description, fn) {
  const startTime = Date.now();
  try {
    const detail = await fn();
    const duration = Date.now() - startTime;
    passedCount++;
    results.push({ id, category, description, status: 'PASSED', duration, detail: detail || '' });
    console.log(`  ${COLORS.green}✔ [PASS]${COLORS.reset} ${COLORS.bright}${id}${COLORS.reset} - ${description} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
    if (detail && typeof detail === 'string' && detail.trim()) {
      console.log(`         ${COLORS.dim}↳ ${detail}${COLORS.reset}`);
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    failedCount++;
    const errMsg = err.message || String(err);
    results.push({ id, category, description, status: 'FAILED', duration, error: errMsg });
    console.log(`  ${COLORS.red}✖ [FAIL]${COLORS.reset} ${COLORS.bright}${id}${COLORS.reset} - ${description} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
    console.log(`         ${COLORS.red}↳ Hata: ${errMsg}${COLORS.reset}`);
  }
}

// HTTP İstemci Fonksiyonu
function makeRequest(baseUrl, endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(endpoint, baseUrl);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers = {
      ...(options.headers || {})
    };

    let bodyData = null;
    if (options.body) {
      if (options.isMultipart) {
        bodyData = options.body;
      } else if (typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify(options.body);
      } else {
        bodyData = String(options.body);
      }
    }

    if (bodyData && !headers['Content-Length'] && !options.isMultipart) {
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const reqOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: (options.method || 'GET').toUpperCase(),
      headers,
      timeout: options.timeout || 10000
    };

    const req = client.request(reqOptions, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          parsed = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw: rawData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`İstek zaman aşımına uğradı (${reqOptions.timeout}ms)`));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// Multipart FormData Oluşturucu (Harici paket gerektirmeden dosya yükleme simülasyonu)
function buildMultipartBody(fields, fileField) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const CRLF = '\r\n';
  const chunks = [];

  // Form Fields
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      chunks.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}` +
        `${value}${CRLF}`
      ));
    }
  }

  // File Field
  if (fileField) {
    const { name, filename, contentType, content } = fileField;
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`
    );
    const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const footer = Buffer.from(`${CRLF}`);
    chunks.push(header, body, footer);
  }

  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));
  const fullBuffer = Buffer.concat(chunks);

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBuffer
  };
}

// Hedef Sunucu Belirleme ve Sağlık Kontrolü
async function resolveApiBaseUrl() {
  const candidateUrls = [];

  if (process.argv[2]) candidateUrls.push(process.argv[2]);
  if (process.env.TEST_TARGET_URL) candidateUrls.push(process.env.TEST_TARGET_URL);

  candidateUrls.push('http://localhost:3001');
  candidateUrls.push('http://localhost:5000');
  if (process.env.TEST_REMOTE === 'true') {
    candidateUrls.push('https://okul360.onrender.com');
  }

  console.log(`\n${COLORS.cyan}🔍 Aktif Okul360 sunucusu aranıyor...${COLORS.reset}`);

  for (const url of candidateUrls) {
    try {
      const res = await makeRequest(url, '/api/school-name', { timeout: 3000 });
      if (res.status === 200) {
        console.log(`${COLORS.green}✔ Aktif sunucu tespit edildi:${COLORS.reset} ${url}`);
        return { url, inProcessServer: null };
      }
    } catch (e) {
      // Devam et
    }
  }

  // Eğer hiçbir aktif sunucu bulunamazsa, in-process sunucu başlat
  console.log(`${COLORS.yellow}⚠ Canlı bir HTTP sunucusu bulunamadı. Yerel uygulama doğrudan ayağa kaldırılıyor...${COLORS.reset}`);
  
  const serverPath = path.join(__dirname, 'server', 'index.js');
  const dbPath = path.join(__dirname, 'server', 'db.js');
  
  const db = require(dbPath);
  await db.initDb();
  const app = require(serverPath);

  const testPort = process.env.TEST_PORT || 3001;
  const inProcessServer = await new Promise((resolve, reject) => {
    const srv = app.listen(testPort, '127.0.0.1', () => {
      console.log(`${COLORS.green}✔ Yerel test sunucusu 127.0.0.1:${testPort} üzerinde başarıyla başlatıldı.${COLORS.reset}`);
      resolve(srv);
    });
    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Ephemeral port dene
        const srv2 = app.listen(0, '127.0.0.1', () => {
          const actualPort = srv2.address().port;
          console.log(`${COLORS.green}✔ Yerel test sunucusu 127.0.0.1:${actualPort} portunda başlatıldı.${COLORS.reset}`);
          resolve(srv2);
        });
      } else {
        reject(err);
      }
    });
  });

  const assignedPort = inProcessServer.address().port;
  return {
    url: `http://127.0.0.1:${assignedPort}`,
    inProcessServer
  };
}

// =========================================================================
// ANA TEST KOŞUCUSU
// =========================================================================
async function runTests() {
  console.log(`\n${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}         OKUL360 KAPSAMLI OTOMASYON TEST SÜİTİ (QA)              ${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════${COLORS.reset}`);

  const { url: API_URL, inProcessServer } = await resolveApiBaseUrl();
  console.log(`${COLORS.bright}Test Hedefi:${COLORS.reset} ${API_URL}`);
  console.log(`${COLORS.dim}Tarih/Saat: ${new Date().toISOString()}${COLORS.reset}\n`);

  // Test Verileri & Hafıza
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  let createdSchoolId = null;
  let createdAdminUser = null;
  let createdAdminPass = 'TestPass123!';
  let createdTurkishUsername = `mudur_çağdaş_${randomSuffix}`;

  // =========================================================================
  // 1. OKUL KAYDI TESTLERİ (School Registration)
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 1: OKUL KAYDI TESTLERİ]${COLORS.reset}`);

  await testCase('REG-01', 'Okul Kaydı', 'Eksik okul adı gönderildiğinde 400 ve hata mesajı dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: { type: 'Kolej', adminUsername: 'adm_' + randomSuffix, adminPassword: '123' }
    });
    if (res.status !== 400 || res.data?.success !== false) {
      throw new Error(`Beklenen 400 alındı: ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Alınan hata: "${res.data.message}" (HTTP ${res.status})`;
  });

  await testCase('REG-02', 'Okul Kaydı', 'Eksik okul türü gönderildiğinde 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: { name: 'Test Okulu', adminUsername: 'adm_' + randomSuffix, adminPassword: '123' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `HTTP ${res.status} Doğrulandı`;
  });

  await testCase('REG-03', 'Okul Kaydı', 'Eksik yönetici kullanıcı adı gönderildiğinde 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: { name: 'Test Okulu', type: 'Okul', adminPassword: '123' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `HTTP ${res.status} Doğrulandı`;
  });

  await testCase('REG-04', 'Okul Kaydı', 'Eksik yönetici şifresi gönderildiğinde 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: { name: 'Test Okulu', type: 'Okul', adminUsername: 'adm_' + randomSuffix }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `HTTP ${res.status} Doğrulandı`;
  });

  await testCase('REG-05', 'Okul Kaydı', 'Mükerrer kullanıcı adı ile kayıt engellenmeli (SequelizeUniqueConstraintError -> 400)', async () => {
    // 'admin' kullanıcı adı varsayılan seed ile veritabanında mevcuttur
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: {
        name: 'Mükerrer Okul',
        type: 'Dershane',
        adminUsername: 'admin',
        adminPassword: 'password123',
        contactPhone: '05321234567'
      }
    });
    const msg = res.data?.message || '';
    if (res.status !== 400 || (!msg.includes('zaten') && !msg.includes('alınmış') && !msg.includes('kullanılıyor'))) {
      throw new Error(`Mükerrer kullanıcı adı engellenmedi! HTTP: ${res.status}, Mesaj: ${res.data?.message}`);
    }
    return `Engelleme Başarılı: "${res.data.message}"`;
  });

  await testCase('REG-06', 'Okul Kaydı', 'Geçerli verilerle yeni okul ve 14 günlük deneme kaydı oluşturulmalı', async () => {
    const adminUsername = `test_admin_${randomSuffix}`;
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: {
        name: `Okul360 Test Koleji ${randomSuffix}`,
        type: 'Kolej',
        logoUrl: 'https://placehold.co/100x100.png',
        adminUsername,
        adminPassword: createdAdminPass,
        contactPhone: '+90 (534) 957 79 69'
      }
    });
    if (res.status !== 200 || !res.data?.success || !res.data?.schoolId) {
      throw new Error(`Kayıt başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    createdSchoolId = res.data.schoolId;
    createdAdminUser = adminUsername;
    return `Okul ID: ${createdSchoolId}, Yönetici: ${createdAdminUser}`;
  });

  await testCase('REG-07', 'Okul Kaydı', 'Türkçe karakterli kullanıcı adı ile okul ve yönetici kaydı yapılabilmeli', async () => {
    const res = await makeRequest(API_URL, '/api/schools/register', {
      method: 'POST',
      body: {
        name: `Çağdaş Bilimler Okulu ${randomSuffix}`,
        type: 'Okul',
        adminUsername: createdTurkishUsername,
        adminPassword: 'şifre_123ÇĞİ',
        contactPhone: '0555 444 33 22'
      }
    });
    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Türkçe karakterli kullanıcı kaydı yapılamadı: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Türkçe Kullanıcı Adı Başarıyla Kaydedildi: "${createdTurkishUsername}"`;
  });

  await testCase('REG-08', 'Okul Kaydı', 'Logo Yükleme API (/api/upload) geçerli resim yüklemesini kabul etmeli (200, fileUrl)', async () => {
    const fakeImagePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
    ]);

    const multipart = buildMultipartBody(
      { description: 'Okul Logosu' },
      { name: 'file', filename: 'okul_logo.png', contentType: 'image/png', content: fakeImagePng }
    );

    const res = await makeRequest(API_URL, '/api/upload', {
      method: 'POST',
      isMultipart: true,
      headers: {
        'Content-Type': multipart.contentType,
        'Content-Length': multipart.body.length
      },
      body: multipart.body
    });

    if (res.status !== 200 || !res.data?.fileUrl) {
      throw new Error(`Resim yüklenemedi! HTTP: ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Yüklenen Dosya URL'i: ${res.data.fileUrl}`;
  });

  await testCase('REG-09', 'Okul Kaydı', 'Logo Yükleme API (/api/upload) geçersiz dosya tipini (text/plain) reddetmeli (400)', async () => {
    const fakeTxt = Buffer.from('Bu bir resim dosyası değildir.');
    const multipart = buildMultipartBody(
      {},
      { name: 'file', filename: 'zararli.exe.txt', contentType: 'text/plain', content: fakeTxt }
    );

    const res = await makeRequest(API_URL, '/api/upload', {
      method: 'POST',
      isMultipart: true,
      headers: {
        'Content-Type': multipart.contentType,
        'Content-Length': multipart.body.length
      },
      body: multipart.body
    });

    if (res.status !== 400 || res.data?.success !== false) {
      throw new Error(`Geçersiz dosya tipi engellenmedi! HTTP: ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Güvenlik Kontrolü Başarılı: "${res.data.message}"`;
  });

  // =========================================================================
  // 2. PERSONEL GİRİŞİ TESTLERİ (Staff Login)
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 2: PERSONEL GİRİŞİ TESTLERİ]${COLORS.reset}`);

  await testCase('AUTH-01', 'Personel Girişi', 'Admin kullanıcısı doğru şifre ile giriş yapabilmeli (admin / 123)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: 'admin', password: '123' }
    });
    if (res.status !== 200 || res.data?.role !== 'admin') {
      throw new Error(`Giriş başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Giriş Başarılı: Role=${res.data.role}, Name="${res.data.name}", SchoolId="${res.data.schoolId}"`;
  });

  await testCase('AUTH-02', 'Personel Girişi', 'Yeni kaydedilen okul yöneticisi ile giriş yapılabilmeli', async () => {
    if (!createdAdminUser) throw new Error('Test okulu yöneticisi mevcut değil');
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: createdAdminUser, password: createdAdminPass }
    });
    if (res.status !== 200 || res.data?.role !== 'admin') {
      throw new Error(`Kayıtlı okul yöneticisi giriş yapamadı: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Giriş Başarılı: User="${res.data.name}", SchoolId="${res.data.schoolId}"`;
  });

  await testCase('AUTH-03', 'Personel Girişi', 'Öğretmen kullanıcısı doğru şifre ile giriş yapabilmeli (ahmet / 123)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'teacher', username: 'ahmet', password: '123' }
    });
    if (res.status !== 200 || res.data?.role !== 'teacher') {
      throw new Error(`Öğretmen girişi başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Giriş Başarılı: Öğretmen="${res.data.name}", Branş="${res.data.subject}"`;
  });

  await testCase('AUTH-04', 'Personel Girişi', 'Güvenlik görevlisi doğru şifre ile giriş yapabilmeli (security / 123)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'security', username: 'security', password: '123' }
    });
    if (res.status !== 200 || res.data?.role !== 'security') {
      throw new Error(`Güvenlik girişi başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Giriş Başarılı: Rol="${res.data.role}", İsim="${res.data.name}"`;
  });

  await testCase('AUTH-05', 'Personel Girişi', 'Süper Admin kullanıcısı giriş yapabilmeli (superadmin / 123)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'superadmin', username: 'superadmin', password: '123' }
    });
    if (res.status !== 200 || res.data?.role !== 'superadmin') {
      throw new Error(`Süper admin girişi başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Giriş Başarılı: Rol="${res.data.role}"`;
  });

  await testCase('AUTH-06', 'Personel Girişi', 'Süper Admin Özel Giriş Endpointi (/api/superadmin/login) test edilmeli', async () => {
    const res = await makeRequest(API_URL, '/api/superadmin/login', {
      method: 'POST',
      body: { username: 'superadmin', password: '123' }
    });
    if (res.status !== 200 || !res.data?.success || res.data?.role !== 'superadmin') {
      throw new Error(`Süper admin özel girişi başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Özel Endpoint Başarılı: Rol="${res.data.role}", Name="${res.data.name}"`;
  });

  await testCase('AUTH-07', 'Personel Girişi', 'Yanlış şifre ile girişte 401 yetkisiz hatası dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: 'admin', password: 'yanlis_sifre_999' }
    });
    if (res.status !== 401 || res.data?.success !== false) {
      throw new Error(`Hatalı şifre 401 döndürmedi! HTTP: ${res.status}, Yanıt: ${res.raw}`);
    }
    return `401 Başarıyla Döndü: "${res.data.message}"`;
  });

  await testCase('AUTH-08', 'Personel Girişi', 'Boş kullanıcı adı veya şifrede 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: '', password: '' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `400 Doğrulandı: "${res.data?.message}"`;
  });

  await testCase('AUTH-09', 'Personel Girişi', 'Türkçe karakterli kullanıcı adı ve şifre ile giriş doğrulanmalı', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: createdTurkishUsername, password: 'şifre_123ÇĞİ' }
    });
    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Türkçe karakterli kullanıcı giriş yapamadı! HTTP: ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Türkçe Karakter Başarılı: User="${res.data.name}", SchoolId="${res.data.schoolId}"`;
  });

  await testCase('AUTH-10', 'Personel Girişi', 'Büyük / Küçük Harf Davranışı (Case Sensitivity Analizi)', async () => {
    const resUpper = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'admin', username: 'ADMIN', password: '123' }
    });
    // Veritabanı SQLite ise varsayılan olarak case-insensitive eşleşebilir, PostgreSQL'de case-sensitive'dir.
    const isSensitive = resUpper.status === 401;
    return `Veritabanı / Auth Davranışı: ${isSensitive ? 'Büyük/Küçük Harfe DUYARLI (Case-Sensitive, HTTP 401)' : 'Büyük/Küçük Harfe DUYARSIZ (Case-Insensitive, HTTP 200)'}`;
  });

  // =========================================================================
  // 3. VELİ GİRİŞİ TESTLERİ (Parent Login via Phone)
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 3: VELİ GİRİŞİ TESTLERİ]${COLORS.reset}`);

  await testCase('PARENT-01', 'Veli Girişi', '05xx standart formatta telefon numarası ile veli girişi (05349577969)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '05349577969' }
    });
    if (res.status !== 200 || res.data?.role !== 'parent' || !res.data?.studentId) {
      throw new Error(`Veli girişi başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Veli Girişi Başarılı: Veli="${res.data.parentName}", ÖğrenciId="${res.data.studentId}"`;
  });

  await testCase('PARENT-02', 'Veli Girişi', '+905xx uluslararası formatta telefon ile veli girişi (+905349577969)', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '+905349577969' }
    });
    if (res.status !== 200 || !res.data?.studentId) {
      throw new Error(`+90 formatı başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Uluslararası Format Kabul Edildi: ÖğrenciId="${res.data.studentId}"`;
  });

  await testCase('PARENT-03', 'Veli Girişi', 'Boşluklu formatta telefon ile veli girişi ("0 534 957 79 69")', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '0 534 957 79 69' }
    });
    if (res.status !== 200 || !res.data?.studentId) {
      throw new Error(`Boşluklu telefon formatı başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Boşluklu Format Başarıyla Temizlendi ve Eşleşti`;
  });

  await testCase('PARENT-04', 'Veli Girişi', 'Tireli / Parantezli format ("+90 (534) 957-79-69")', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '+90 (534) 957-79-69' }
    });
    if (res.status !== 200 || !res.data?.studentId) {
      throw new Error(`Tireli format başarısız: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `Karmaşık Format Başarıyla Eşleşti`;
  });

  await testCase('PARENT-05', 'Veli Girişi', 'Sistemde kayıtlı olmayan telefon numarası ile girişte 401 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '05991112233' }
    });
    if (res.status !== 401 || res.data?.success !== false) {
      throw new Error(`Kayıtsız numara 401 dönmedi: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `401 Başarıyla Döndü: "${res.data.message}"`;
  });

  await testCase('PARENT-06', 'Veli Girişi', 'Geçersiz / çok kısa telefon numarasında 400 dönmeli ("12345")', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '12345' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `Doğrulama Başarılı: "${res.data?.message}"`;
  });

  await testCase('PARENT-07', 'Veli Girişi', 'Boş telefon numarasında 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/auth/login', {
      method: 'POST',
      body: { role: 'parent', phone: '' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `400 Alındı: "${res.data?.message}"`;
  });

  // =========================================================================
  // 4. ÖĞRENCİ İŞLEMLERİ & KOTA SINIRI TESTLERİ (15 Quota & 16th 403 Forbidden)
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 4: ÖĞRENCİ İŞLEMLERİ & 15 KOTA SINIRI TESTLERİ]${COLORS.reset}`);

  await testCase('STU-01', 'Öğrenci İşlemleri', 'Zorunlu alanlar (isim, soyisim, sınıf) eksik olduğunda 400 dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/students', {
      method: 'POST',
      headers: { 'x-school-id': createdSchoolId },
      body: { name: 'Eksik Öğrenci' }
    });
    if (res.status !== 400) throw new Error(`Beklenen 400, Alınan: ${res.status}`);
    return `Zorunlu Alan Doğrulandı: "${res.data?.message}"`;
  });

  await testCase('STU-02', 'Öğrenci İşlemleri', 'Yeni oluşturulan test okuluna 15 öğrenci başarıyla eklenebilmeli (1-15 Kotası)', async () => {
    if (!createdSchoolId) throw new Error('Test okulu ID bulunamadı');

    const addedStudents = [];
    for (let i = 1; i <= 15; i++) {
      const studentPayload = {
        name: `Öğrenci_${i}`,
        surname: `TestSoyad_${i}`,
        className: '8-LGS VIP',
        motherName: `Anne_${i}`,
        motherPhone: `0530000${String(100 + i).slice(-3)}`,
        fatherName: `Baba_${i}`,
        fatherPhone: `0531000${String(100 + i).slice(-3)}`
      };

      const res = await makeRequest(API_URL, '/api/students', {
        method: 'POST',
        headers: { 'x-school-id': createdSchoolId },
        body: studentPayload
      });

      if (res.status !== 200 || !res.data?.success) {
        throw new Error(`${i}. öğrenci eklenirken hata: HTTP ${res.status}, Yanıt: ${res.raw}`);
      }
      addedStudents.push(res.data.student.id);
    }

    return `15 Öğrenci Başarıyla Kaydedildi (Kota %100 Doldu)`;
  });

  await testCase('STU-03', 'Kota Sınırı', '16. Öğrenci eklendiğinde sistem 403 Forbidden ve quotaExceeded: true yanıtı vermeli', async () => {
    const student16Payload = {
      name: 'KotayıAşan_Öğrenci_16',
      surname: 'Yasaklı',
      className: '8-LGS VIP',
      fatherPhone: '05399999999'
    };

    const res = await makeRequest(API_URL, '/api/students', {
      method: 'POST',
      headers: { 'x-school-id': createdSchoolId },
      body: student16Payload
    });

    if (res.status !== 403) {
      throw new Error(`16. öğrenci 403 Forbidden ile engellenmeliydi! Ancak HTTP ${res.status} döndü. Yanıt: ${res.raw}`);
    }

    if (!res.data?.quotaExceeded) {
      throw new Error(`Yanıt gövdesinde quotaExceeded: true bekleniyordu! Yanıt: ${res.raw}`);
    }

    return `403 FORBIDDEN BAŞARIYLA ALINDI! Mesaj: "${res.data.message}", Kotadaki: ${res.data.currentCount}/${res.data.quota}`;
  });

  await testCase('STU-04', 'Kota Sınırı', 'Abonelik / Kota Durum API (/api/school/subscription) kota doluluğunu doğrulamalı', async () => {
    const res = await makeRequest(API_URL, '/api/school/subscription', {
      headers: { 'x-school-id': createdSchoolId }
    });

    if (res.status !== 200) throw new Error(`Abonelik sorgulanamadı: HTTP ${res.status}`);
    const sub = res.data;
    if (sub.currentStudentCount !== 15 || sub.studentQuota !== 15 || sub.isQuotaFull !== true) {
      throw new Error(`Kota bilgileri tutarsız! Count: ${sub.currentStudentCount}, Quota: ${sub.studentQuota}, isQuotaFull: ${sub.isQuotaFull}`);
    }
    return `Kota Durumu Doğrulandı: ${sub.currentStudentCount}/${sub.studentQuota} (isQuotaFull=${sub.isQuotaFull}, Kalan Gün=${sub.daysLeft})`;
  });

  // =========================================================================
  // 5. SÜPER ADMİN İŞLEMLERİ (Super Admin Management)
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 5: SÜPER ADMİN YÖNETİM TESTLERİ]${COLORS.reset}`);

  await testCase('SADM-01', 'Süper Admin', 'Tüm okulları listeleme API (/api/superadmin/schools) tüm okulları ve istatistiklerini dönmeli', async () => {
    const res = await makeRequest(API_URL, '/api/superadmin/schools');
    if (res.status !== 200 || !res.data?.success || !Array.isArray(res.data?.schools)) {
      throw new Error(`Okullar listelenemedi: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    const found = res.data.schools.find(s => s.id === createdSchoolId);
    if (!found) {
      throw new Error(`Yeni oluşturulan ${createdSchoolId} süper admin listesinde bulunamadı!`);
    }
    return `Toplam ${res.data.schools.length} Okul Listelendi. Test Okulu Öğrenci Sayısı: ${found.studentCount}/${found.studentQuota}`;
  });

  await testCase('SADM-02', 'Süper Admin', 'Süper Admin öğrenci kotasını 15\'ten 25\'e artırabilmeli (PUT /api/superadmin/schools/:id/subscription)', async () => {
    const res = await makeRequest(API_URL, `/api/superadmin/schools/${createdSchoolId}/subscription`, {
      method: 'PUT',
      body: {
        studentQuota: 25,
        teacherQuota: 10,
        notes: 'QA Test Otomasyonu Tarafından Kota Artırıldı'
      }
    });

    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Kota artırılamadı: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    if (res.data.school?.studentQuota !== 25) {
      throw new Error(`Yeni kota 25 olmadı: ${res.data.school?.studentQuota}`);
    }
    return `Kota Başarıyla 25'e Güncellendi. Mesaj: "${res.data.message}"`;
  });

  await testCase('SADM-03', 'Süper Admin', 'Kota artırıldıktan sonra 16. öğrenci ekleme işlemi artık BAŞARILI olmalı (200 OK)', async () => {
    const student16Payload = {
      name: 'YeniÖğrenci_16_KotaArtisiSonrasi',
      surname: 'Onaylandı',
      className: '8-LGS VIP',
      fatherPhone: '05398887766'
    };

    const res = await makeRequest(API_URL, '/api/students', {
      method: 'POST',
      headers: { 'x-school-id': createdSchoolId },
      body: student16Payload
    });

    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Kota artışından sonra 16. öğrenci eklenemedi! HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    return `16. Öğrenci Başarıyla Eklendi (ID: ${res.data.student.id}). Kota Artışı Uçtan Uca Doğrulandı!`;
  });

  await testCase('SADM-04', 'Süper Admin', 'Süper Admin okul lisans süresini 1 yıl uzatabilmeli (durationYears: 1 -> ACTIVE)', async () => {
    const res = await makeRequest(API_URL, `/api/superadmin/schools/${createdSchoolId}/subscription`, {
      method: 'PUT',
      body: {
        durationYears: 1,
        subscriptionStatus: 'ACTIVE',
        notes: '1 Yıllık Tam Lisans Tanımlandı'
      }
    });

    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Süre uzatılamadı: HTTP ${res.status}, Yanıt: ${res.raw}`);
    }
    const school = res.data.school;
    if (school.subscriptionStatus !== 'ACTIVE' || !school.subscriptionEndsAt) {
      throw new Error(`Abonelik durumu güncellenemedi: ${JSON.stringify(school)}`);
    }
    return `Lisans 1 Yıl Uzatıldı: Bitiş Tarihi = ${new Date(school.subscriptionEndsAt).toLocaleDateString('tr-TR')}`;
  });

  // =========================================================================
  // 6. EK SERVİSLER & MODÜL TESTLERİ
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.magenta}[BÖLÜM 6: DİĞER MODÜL TESTLERİ (YOKLAMA, RAPOR, YEMEK, HESAP SİLME)]${COLORS.reset}`);

  let testStudentId = 'st_alp'; // default seeded student

  await testCase('MOD-01', 'Yoklama', 'Öğrenciye yoklama durumu kaydedilebilmeli ve listelenebilmeli', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const postRes = await makeRequest(API_URL, '/api/attendance', {
      method: 'POST',
      headers: { 'x-school-id': 'school_1' },
      body: { studentId: testStudentId, date: today, status: 'geldi' }
    });
    if (postRes.status !== 200 || !postRes.data?.success) {
      throw new Error(`Yoklama kaydedilemedi: HTTP ${postRes.status}`);
    }

    const getRes = await makeRequest(API_URL, '/api/attendance', {
      headers: { 'x-school-id': 'school_1' }
    });
    if (getRes.status !== 200 || !Array.isArray(getRes.data)) {
      throw new Error(`Yoklama listelenemedi: HTTP ${getRes.status}`);
    }
    return `Yoklama Başarıyla Kaydedildi ve Doğrulandı (Tarih: ${today})`;
  });

  await testCase('MOD-02', 'Günlük Rapor', 'Öğrenciye günlük beslenme ve ruh hali durumu kaydedilebilmeli', async () => {
    const postRes = await makeRequest(API_URL, '/api/daily-logs', {
      method: 'POST',
      headers: { 'x-school-id': 'school_1' },
      body: {
        studentId: testStudentId,
        mealStatus: 'Yemeklerin hepsini bitirdi',
        mood: 'Çok Neşeli',
        notes: 'Etkinliklere aktif katıldı.'
      }
    });
    if (postRes.status !== 200 || !postRes.data?.success) {
      throw new Error(`Günlük durum kaydedilemedi: HTTP ${postRes.status}`);
    }

    const getRes = await makeRequest(API_URL, '/api/daily-logs', {
      headers: { 'x-school-id': 'school_1' }
    });
    if (getRes.status !== 200 || !getRes.data[testStudentId]) {
      throw new Error(`Günlük log getirilemedi: HTTP ${getRes.status}`);
    }
    return `Günlük Durum Kaydedildi: "${getRes.data[testStudentId].mood}", Not: "${getRes.data[testStudentId].notes}"`;
  });

  await testCase('MOD-03', 'Yemek Menüsü', 'Günün yemek menüsü güncellenebilmeli ve veliye gösterilebilmeli', async () => {
    const postRes = await makeRequest(API_URL, '/api/meals', {
      method: 'POST',
      headers: { 'x-school-id': 'school_1' },
      body: {
        soup: 'Mercimek Çorbası',
        main: 'İzmir Köfte',
        side: 'Pirinç Pilavı',
        dessert: 'Mevsim Meyvesi'
      }
    });
    if (postRes.status !== 200 || !postRes.data?.success) {
      throw new Error(`Yemek menüsü kaydedilemedi: HTTP ${postRes.status}`);
    }

    const getRes = await makeRequest(API_URL, '/api/meals', {
      headers: { 'x-school-id': 'school_1' }
    });
    if (getRes.status !== 200 || getRes.data?.main !== 'İzmir Köfte') {
      throw new Error(`Yemek menüsü okunamadı: HTTP ${getRes.status}`);
    }
    return `Yemek Menüsü Doğrulandı: ${getRes.data.soup}, ${getRes.data.main}, ${getRes.data.side}`;
  });

  await testCase('MOD-04', 'Duyurular', 'Okul genelinde yeni duyuru yayınlanabilmeli ve listelenebilmeli', async () => {
    const postRes = await makeRequest(API_URL, '/api/announcements', {
      method: 'POST',
      headers: { 'x-school-id': 'school_1' },
      body: {
        title: `Veli Toplantısı Duyurusu ${randomSuffix}`,
        message: 'Hafta sonu saat 14:00\'te tüm velilerimizin katılımını rica ederiz.',
        className: null
      }
    });
    if (postRes.status !== 200 || !postRes.data?.success) {
      throw new Error(`Duyuru oluşturulamadı: HTTP ${postRes.status}`);
    }

    const getRes = await makeRequest(API_URL, '/api/announcements', {
      headers: { 'x-school-id': 'school_1' }
    });
    if (getRes.status !== 200 || !Array.isArray(getRes.data)) {
      throw new Error(`Duyurular listelenemedi: HTTP ${getRes.status}`);
    }
    return `Duyuru Yayınlandı (ID: ${postRes.data.announcement?.id})`;
  });

  await testCase('MOD-05', 'Hesap Silme Güvenliği', 'Hesap Silme API (/api/account/delete) SIL onayı olmadan reddetmeli (400)', async () => {
    const res = await makeRequest(API_URL, '/api/account/delete', {
      method: 'POST',
      body: { role: 'parent', parentPhone: '05349577969', confirmationText: 'YANLIS_ONAY' }
    });
    if (res.status !== 400 || res.data?.success !== false) {
      throw new Error(`Onaysız silme isteği reddedilmedi! HTTP: ${res.status}`);
    }
    return `Onaysız Silme Engellendi: "${res.data?.message}"`;
  });

  // =========================================================================
  // RAPORLAMA VE ÖZET
  // =========================================================================
  console.log(`\n${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}                    TEST SONUÇ RAPORU                           ${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════${COLORS.reset}`);

  const total = results.length;
  console.log(`\n  Toplam Test Sayısı : ${COLORS.bright}${total}${COLORS.reset}`);
  console.log(`  Başarılı (PASS)    : ${COLORS.green}${COLORS.bright}${passedCount}${COLORS.reset} (%${((passedCount / total) * 100).toFixed(1)})`);
  console.log(`  Başarısız (FAIL)   : ${failedCount > 0 ? COLORS.red : COLORS.dim}${COLORS.bright}${failedCount}${COLORS.reset}`);
  console.log(`  Atlanan (SKIP)     : ${skippedCount}\n`);

  // Sonuçları JSON olarak kaydet
  const reportPath = path.join(__dirname, 'test_results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    total,
    passed: passedCount,
    failed: failedCount,
    successRate: `${((passedCount / total) * 100).toFixed(1)}%`,
    results
  }, null, 2), 'utf-8');
  console.log(`${COLORS.dim}Ayrıntılı JSON raporu kaydedildi: ${reportPath}${COLORS.reset}`);

  // Eğer in-process sunucu başlatılmışsa kapat
  if (inProcessServer) {
    inProcessServer.close();
  }

  return { total, passedCount, failedCount, results };
}

// Doğrudan çalıştırıldığında başlat
if (require.main === module) {
  runTests().then(({ failedCount }) => {
    process.exit(failedCount > 0 ? 1 : 0);
  }).catch((err) => {
    console.error('Test süiti beklenmeyen hata ile sonlandı:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
