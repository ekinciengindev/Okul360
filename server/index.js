const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const db = require('./db');

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost',
  'http://localhost:5000',
  'http://localhost:5173',
  'https://localhost',
  'capacitor://localhost',
  'http://10.0.2.2',
  'http://10.0.2.2:5000',
  '*'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'authorization',
    'x-school-id',
    'X-School-Id',
    'Bypass-Tunnel-Reminder',
    'bypass-tunnel-reminder'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Helper to extract schoolId dynamically from request headers
const getSchoolId = (req) => {
  return req.headers['x-school-id'] || 'school_1';
};

// Clean and normalize phone numbers (e.g., +90 532 123 45 67 -> 5321234567)
const cleanPhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
};

// Safe username normalization (handles Turkish characters, trim, lowercase, ASCII-safe)
const normalizeUsername = (username) => {
  if (!username) return '';
  return String(username)
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.-]/g, '');
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Multer Storage Configuration (Keep quality lossless, use original format, clean filename)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file size limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Yalnızca resim ve video dosyaları yüklenebilir!'));
    }
  }
});

// File Upload API
app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: 'Dosya boyutu çok büyük! Maksimum 50MB yükleyebilirsiniz.' });
        }
        return res.status(400).json({ success: false, message: 'Dosya yükleme hatası: ' + err.message });
      }
      return res.status(400).json({ success: false, message: err.message || 'Dosya yükleme hatası!' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Lütfen yüklenecek bir dosya seçin!' });
    }
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    const isVideo = req.file.mimetype.startsWith('video/');
    res.json({
      success: true,
      fileUrl,
      mediaType: isVideo ? 'video' : 'image'
    });
  });
});

// Parent Login Helper
const handleParentLogin = async (phone, res) => {
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Lütfen telefon numaranızı girin!' });
  }
  const phoneDigits = cleanPhone(phone);
  if (!phoneDigits || phoneDigits.length < 10) {
    return res.status(400).json({ success: false, message: 'Lütfen geçerli bir 10 haneli cep telefonu numarası giriniz (örn: 05xx xxx xx xx)!' });
  }

  let students = await db.Student.findAll();
  let student = students.find(s => {
    const p1 = cleanPhone(s.parentPhone);
    const p2 = cleanPhone(s.motherPhone);
    const p3 = cleanPhone(s.fatherPhone);
    const p4 = cleanPhone(s.emergencyContact);
    return (p1 && p1 === phoneDigits) || (p2 && p2 === phoneDigits) || (p3 && p3 === phoneDigits) || (p4 && p4 === phoneDigits);
  });

  if (!student) {
    try {
      await db.seedDatabase();
      students = await db.Student.findAll();
      student = students.find(s => {
        const p1 = cleanPhone(s.parentPhone);
        const p2 = cleanPhone(s.motherPhone);
        const p3 = cleanPhone(s.fatherPhone);
        const p4 = cleanPhone(s.emergencyContact);
        return (p1 && p1 === phoneDigits) || (p2 && p2 === phoneDigits) || (p3 && p3 === phoneDigits) || (p4 && p4 === phoneDigits);
      });
    } catch (seedErr) {
      console.warn('Seed database fallback notice:', seedErr.message);
    }
  }

  if (student) {
    return res.json({
      success: true,
      role: 'parent',
      parentPhone: phone,
      studentId: student.id,
      studentName: `${student.name} ${student.surname || ''}`.trim(),
      parentName: student.parentName,
      schoolId: student.schoolId
    });
  } else {
    return res.status(401).json({
      success: false,
      message: `Girdiğiniz telefon numarası (${phone}) sistemimizde hiçbir öğrencinin anne, baba veya veli iletişim bilgisiyle eşleşmedi. Lütfen okul idaresine bildirdiğiniz cep telefonu numaranızı başında sıfır olmadan (örn: 5xxxxxxxxx) giriniz veya okulunuzla iletişime geçiniz.`
    });
  }
};

// Dedicated Parent Login API
app.post('/api/auth/parent-login', async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    return await handleParentLogin(phone, res);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Veli girişi başarısız: ' + (err.message || 'Bilinmeyen hata') });
  }
});

// Auth Login API (Supports Parent, Staff, Admin, Superadmin)
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { role, username, password, phone } = req.body || {};

    if (!role) {
      return res.status(400).json({ success: false, message: 'Lütfen kullanıcı rolünü belirtin!' });
    }

    if (role === 'parent') {
      return await handleParentLogin(phone, res);
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre zorunludur!' });
    }

    const trimmedUsername = String(username).trim();
    const cleanUsername = normalizeUsername(trimmedUsername);

    // Case-insensitive username lookup
    let user = null;
    try {
      user = await db.User.findOne({
        where: db.sequelize.where(
          db.sequelize.fn('LOWER', db.sequelize.col('username')),
          cleanUsername
        )
      });
      if (!user) {
        user = await db.User.findOne({
          where: db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('username')),
            trimmedUsername.toLowerCase()
          )
        });
      }
    } catch (queryErr) {
      user = await db.User.findOne({ where: { username: trimmedUsername } });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Kullanıcı adı sistemde bulunamadı. Lütfen kullanıcı adınızı kontrol ediniz.' });
    }

    if (user.password) {
      const isValid = await bcrypt.compare(String(password), user.password);
      if (isValid) {
        return res.json({
          success: true,
          role: user.role,
          userId: user.id,
          teacherId: user.role === 'teacher' ? user.id : undefined,
          name: user.name,
          subject: user.subject,
          schoolId: user.schoolId
        });
      }
    }

    return res.status(401).json({ success: false, message: 'Girdiğiniz şifre hatalı. Lütfen tekrar deneyiniz.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Giriş işlemi başarısız: ' + (err.message || 'Hata') });
  }
});

// School Name
app.get('/api/school-name', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const school = await db.School.findByPk(schoolId);
    res.json({
      name: school ? school.name : 'Okul360',
      type: school ? school.type : 'Okul',
      logoUrl: school ? school.logoUrl : ''
    });
  } catch (err) {
    res.json({ name: 'Okul360', type: 'Okul', logoUrl: '' });
  }
});

app.post('/api/school-name', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { name, type, logoUrl } = req.body || {};
    const school = await db.School.findByPk(schoolId);
    if (school) {
      if (name) school.name = name;
      if (type) school.type = type;
      if (logoUrl !== undefined) school.logoUrl = logoUrl;
      await school.save();
    }
    res.json({ success: true, name: school ? school.name : name, type: school ? school.type : type, logoUrl: school ? school.logoUrl : logoUrl });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Okul bilgisi güncellenemedi: ' + (err.message || 'Hata') });
  }
});

// School Registration
app.post('/api/schools/register', async (req, res, next) => {
  try {
    const { name, type, logoUrl, adminUsername, adminPassword, contactPhone } = req.body || {};
    
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Lütfen kurum adını giriniz!' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Lütfen kurum türünü seçiniz!' });
    }

    const cleanAdminUsername = normalizeUsername(adminUsername);
    if (!cleanAdminUsername || cleanAdminUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Yönetici kullanıcı adı en az 3 karakterden oluşmalı ve boşluk içermemelidir!' });
    }

    if (!adminPassword || String(adminPassword).length < 4) {
      return res.status(400).json({ success: false, message: 'Yönetici şifresi en az 4 karakter olmalıdır!' });
    }

    const cleanContact = cleanPhone(contactPhone);
    if (!cleanContact || cleanContact.length < 10) {
      return res.status(400).json({ success: false, message: 'Lütfen geçerli bir 10 haneli iletişim telefonu giriniz (örn: 05xx xxx xx xx)!' });
    }

    // Check if username is already taken (case-insensitive check)
    let existingUser = null;
    try {
      existingUser = await db.User.findOne({
        where: db.sequelize.where(
          db.sequelize.fn('LOWER', db.sequelize.col('username')),
          cleanAdminUsername
        )
      });
    } catch (e) {
      existingUser = await db.User.findOne({ where: { username: cleanAdminUsername } });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten başka bir okul tarafından kullanılıyor! Lütfen farklı bir kullanıcı adı seçiniz.'
      });
    }

    const schoolId = 'school_' + Math.random().toString(36).slice(2, 9);
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    
    // Create school with 14-day free trial and 15 student quota
    const newSchool = await db.School.create({
      id: schoolId,
      name: trimmedName,
      type,
      logoUrl: logoUrl || '',
      studentQuota: 15,
      teacherQuota: 5,
      subscriptionStatus: 'TRIAL',
      trialEndsAt,
      contactPhone: cleanContact,
      notes: '14 Günlük Ücretsiz Deneme Kaydı'
    });

    // Create admin user with normalized username
    const hashedPassword = await bcrypt.hash(String(adminPassword), 10);
    const newAdmin = await db.User.create({
      role: 'admin',
      name: trimmedName + ' Yöneticisi',
      username: cleanAdminUsername,
      password: hashedPassword,
      phone: cleanContact,
      schoolId
    });

    res.json({
      success: true,
      schoolId,
      userId: newAdmin.id,
      schoolName: newSchool.name,
      adminUsername: newAdmin.username
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten başka bir okul tarafından kullanılıyor! Lütfen farklı bir kullanıcı adı seçiniz.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Okul kaydı oluşturulamadı: ' + (err.message || 'Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.')
    });
  }
});

// Change Password API
app.post('/api/auth/change-password', async (req, res, next) => {
  try {
    const { userId, oldPassword, newPassword } = req.body || {};
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Tüm alanlar zorunludur!' });
    }

    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı!' });
    }

    const isValid = await bcrypt.compare(String(oldPassword), user.password);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Mevcut şifre hatalı!' });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Şifre değiştirme başarısız: ' + (err.message || 'Hata') });
  }
});

// Delete Account API (Apple App Store Guideline 5.1.1(v) Mandatory Requirement)
app.post('/api/account/delete', async (req, res, next) => {
  try {
    const { role, userId, parentPhone, confirmationText } = req.body || {};

    if (confirmationText !== 'SIL' && confirmationText !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Lütfen silme işlemini onaylamak için SIL yazın!' });
    }

    if (role === 'parent' && parentPhone) {
      const students = await db.Student.findAll({ where: { parentPhone } });
      if (students.length === 0) {
        return res.status(404).json({ success: false, message: 'Kayıtlı hesap bulunamadı!' });
      }
      for (const student of students) {
        await student.destroy();
      }
      return res.json({ success: true, message: 'Veli hesabınız ve ilişkili tüm öğrenci verileriniz kalıcı olarak silindi.' });
    } else if (userId) {
      const user = await db.User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı!' });
      }
      await user.destroy();
      return res.json({ success: true, message: 'Hesabınız ve kullanıcı verileriniz kalıcı olarak silindi.' });
    }

    return res.status(400).json({ success: false, message: 'Geçersiz istek parametreleri!' });
  } catch (err) {
    next(err);
  }
});

// Privacy Policy API (Store Compliance requirement)
app.get('/api/privacy-policy', (req, res) => {
  res.json({
    title: 'Okul360 Gizlilik Politikası ve Kişisel Verilerin Korunması',
    lastUpdated: new Date().toISOString().slice(0, 10),
    content: `Okul360 platformu olarak kişisel verilerinizin güvenliğine büyük önem veriyoruz. Bu Gizlilik Politikası, 6698 sayılı KVKK ve Uluslararası Veri Koruma Standartları uyarınca, Okul360 mobil ve web uygulamalarını kullanırken toplanan verilerin işlenme amaçlarını, saklanma koşullarını ve haklarınızı açıklar.

1. Toplanan Veriler: Öğrenci adı, veli iletişim bilgileri, nöbetçi/çıkış takip verileri, devam-devamsızlık kayıtları ve eğitim performans derecelendirmeleri.
2. Verilerin İşlenme Amacı: Okul-veli iletişimini sağlamak, öğrenci güvenliğini üst seviyede tutmak ve okul içi akademik ve operasyonel süreçleri yürütmek.
3. Verilerin Saklanması ve Güvenliği: Tüm verileriniz SSL/TLS şifreleme protokolü ile korunan güvenli sunucularda saklanmaktadır.
4. Hesap ve Veri Silme: Dilediğiniz zaman uygulama içerisindeki "Hesabımı Sil" seçeneğini kullanarak hesabınızın ve kişisel verilerinizin sistemden kalıcı olarak silinmesini talep edebilirsiniz.
5. İletişim: Gizlilik talepleriniz için destek@okul360.com adresi üzerinden bizimle iletişime geçebilirsiniz.`
  });
});

// Terms of Service API
app.get('/api/terms', (req, res) => {
  res.json({
    title: 'Okul360 Kullanım Koşulları',
    lastUpdated: new Date().toISOString().slice(0, 10),
    content: `Okul360 mobil uygulamasını kullanarak aşağıdaki kullanım şartlarını kabul etmiş sayılırsınız:

1. Hizmet Tanımı: Okul360, okullar, veliler ve öğretmenler arasında öğrenci takibi ve iletişim imkanı sağlayan hibrit bir okul yönetim platformudur.
2. Kullanım Kuralları: Kullanıcılar sistemde kendilerine verilen yetkiler çerçevesinde doğru bilgi sağlamakla yükümlüdür.
3. Güvenlik: Kullanıcı adı ve şifrenizin gizliliğinden kullanıcı sorumludur.
4. Fikri Mülkiyet: Okul360 logosu, tasarımı ve yazılım altyapısı izinsiz kopyalanamaz.`
  });
});

// Classes (Distinct classNames list queried dynamically)
app.get('/api/classes', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const studentClasses = await db.Student.findAll({
      where: { schoolId },
      attributes: ['className'],
      group: ['className']
    });
    const lessonClasses = await db.Lesson.findAll({
      where: { schoolId },
      attributes: ['className'],
      group: ['className']
    });
    
    const set = new Set();
    studentClasses.forEach(c => set.add(c.className));
    lessonClasses.forEach(c => set.add(c.className));
    
    // Fallback if none exist yet
    if (set.size === 0) {
      set.add("8-LGS VIP");
      set.add("5-A Üstün Zekalılar");
      set.add("12-Sayısal Derece");
    }
    res.json(Array.from(set));
  } catch (err) {
    next(err);
  }
});

app.post('/api/classes', (req, res) => {
  const { className } = req.body || {};
  if (!className) {
    return res.status(400).json({ success: false, message: 'Sınıf adı zorunludur!' });
  }
  res.json({ success: true, className });
});

// School Subscription & Quota Status API
app.get('/api/school/subscription', async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    let school = await db.School.findByPk(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, message: 'Okul bulunamadı!' });
    }

    const currentStudentCount = await db.Student.count({ where: { schoolId } });
    const currentTeacherCount = await db.User.count({ where: { schoolId, role: 'teacher' } });

    const now = new Date();
    let isExpired = false;
    let daysLeft = 0;

    if (school.subscriptionStatus === 'TRIAL') {
      const trialEnd = school.trialEndsAt ? new Date(school.trialEndsAt) : new Date(school.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
      if (daysLeft <= 0) isExpired = true;
    } else if (school.subscriptionStatus === 'ACTIVE') {
      if (school.subscriptionEndsAt) {
        const subEnd = new Date(school.subscriptionEndsAt);
        daysLeft = Math.max(0, Math.ceil((subEnd - now) / (1000 * 60 * 60 * 24)));
        if (daysLeft <= 0) isExpired = true;
      } else {
        daysLeft = 365;
      }
    } else {
      isExpired = true;
    }

    const quota = school.studentQuota || 15;
    const isQuotaFull = currentStudentCount >= quota;

    res.json({
      success: true,
      schoolId: school.id,
      schoolName: school.name,
      schoolType: school.type,
      studentQuota: quota,
      currentStudentCount,
      teacherQuota: school.teacherQuota || 5,
      currentTeacherCount,
      subscriptionStatus: isExpired ? 'EXPIRED' : (school.subscriptionStatus || 'TRIAL'),
      trialEndsAt: school.trialEndsAt,
      subscriptionEndsAt: school.subscriptionEndsAt,
      daysLeft,
      isExpired,
      isQuotaFull,
      supportWhatsApp: '05349577969',
      supportPhone: '05349577969',
      bankInfo: {
        bankName: 'Ziraat Bankası / Garanti BBVA',
        iban: 'TR12 0001 0000 0000 0000 0000 00',
        accountHolder: 'Engin Ekinci / Okul360 Yazılım'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Abonelik bilgisi alınamadı: ' + err.message });
  }
});

// Students
app.get('/api/students', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Student.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Öğrenciler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/students', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const school = await db.School.findByPk(schoolId);

    // 1. Check Subscription Expiry
    if (school) {
      const now = new Date();
      let isExpired = false;
      if (school.subscriptionStatus === 'EXPIRED') {
        isExpired = true;
      } else if (school.subscriptionStatus === 'TRIAL' && school.trialEndsAt && new Date(school.trialEndsAt) < now) {
        isExpired = true;
      } else if (school.subscriptionStatus === 'ACTIVE' && school.subscriptionEndsAt && new Date(school.subscriptionEndsAt) < now) {
        isExpired = true;
      }

      if (isExpired) {
        return res.status(403).json({
          success: false,
          subscriptionExpired: true,
          message: 'Okulunuzun kullanım lisansı sona erdi. Yeni öğrenci eklemek için lütfen lisansınızı yenileyin!'
        });
      }

      // 2. Check Student Quota
      const currentCount = await db.Student.count({ where: { schoolId } });
      const quota = school.studentQuota || 15;
      if (currentCount >= quota) {
        return res.status(403).json({
          success: false,
          quotaExceeded: true,
          currentCount,
          quota,
          message: `Öğrenci kotanıza (${quota} Öğrenci) ulaştınız! Yeni öğrenci eklemek için paketinizi yükseltin.`
        });
      }
    }

    const {
      name,
      surname,
      photoUrl,
      birthDate,
      tcNo,
      className,
      motherName,
      motherSurname,
      motherJob,
      motherPhone,
      fatherName,
      fatherSurname,
      fatherJob,
      fatherPhone,
      emergencyContact,
      prevReligiousEdu,
      prevReligiousEduDetail,
      healthAllergyInfo,
      additionalNotes,
      referralSource
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanSurname = String(surname || '').trim();
    const cleanClassName = String(className || '').trim();

    if (!cleanName || !cleanSurname || !cleanClassName) {
      return res.status(400).json({ success: false, message: 'Öğrenci adı, soyadı ve sınıfı zorunludur!' });
    }

    const cleanMotherPhone = cleanPhone(motherPhone);
    const cleanFatherPhone = cleanPhone(fatherPhone);
    const cleanEmergency = cleanPhone(emergencyContact);

    const id = 'st_' + Math.random().toString(36).slice(2, 9);
    const parentPhone = cleanFatherPhone || cleanMotherPhone || cleanEmergency || '';
    const parentName = (fatherName ? `${fatherName} ${fatherSurname || ''}` : `${motherName || ''} ${motherSurname || ''}`).trim() || 'Veli';

    const newStudent = await db.Student.create({
      id,
      name: cleanName,
      surname: cleanSurname,
      photoUrl: photoUrl || '',
      birthDate: birthDate || '',
      tcNo: tcNo || '',
      className: cleanClassName,
      motherName: motherName || '',
      motherSurname: motherSurname || '',
      motherJob: motherJob || '',
      motherPhone: cleanMotherPhone,
      fatherName: fatherName || '',
      fatherSurname: fatherSurname || '',
      fatherJob: fatherJob || '',
      fatherPhone: cleanFatherPhone,
      emergencyContact: cleanEmergency,
      prevReligiousEdu: prevReligiousEdu || '',
      prevReligiousEduDetail: prevReligiousEduDetail || '',
      healthAllergyInfo: healthAllergyInfo || '',
      additionalNotes: additionalNotes || '',
      referralSource: referralSource || '',
      parentName: parentName,
      parentPhone: parentPhone,
      schoolId
    });

    res.json({ success: true, student: newStudent });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: 'Lütfen tüm alanları doğru formatta doldurunuz!' });
    }
    return res.status(400).json({ success: false, message: 'Öğrenci eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Delete Student API
app.delete('/api/students/:id', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    const student = await db.Student.findOne({ where: { id, schoolId } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Öğrenci bulunamadı!' });
    }
    await student.destroy();
    res.json({ success: true, message: 'Öğrenci başarıyla silindi.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Öğrenci silinemedi: ' + (err.message || 'Hata') });
  }
});

// Teachers
app.get('/api/teachers', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.User.findAll({ where: { role: 'teacher', schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Öğretmenler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/teachers', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { name, subject } = req.body || {};
    if (!name || !subject) {
      return res.status(400).json({ success: false, message: 'Öğretmen adı ve branşı zorunludur!' });
    }
    const username = name.split(' ')[0].toLowerCase() + String(Math.floor(10 + Math.random() * 90));
    const hashedPassword = await bcrypt.hash('123', 10);
    const newTeacher = await db.User.create({
      role: 'teacher',
      name,
      subject,
      username,
      password: hashedPassword,
      schoolId
    });
    res.json({ success: true, teacher: newTeacher });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Öğretmen eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Grades
app.get('/api/grades', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Grade.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Notlar getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/grades', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, subject, examName, score } = req.body || {};
    if (!studentId || !subject || !examName || score === undefined || isNaN(Number(score))) {
      return res.status(400).json({ success: false, message: 'Eksik veya hatalı not verisi!' });
    }
    const id = 'g_' + Math.random().toString(36).slice(2, 9);
    const newGrade = await db.Grade.create({
      id,
      studentId,
      subject,
      examName,
      score: Number(score),
      date: new Date().toISOString().slice(0, 10),
      schoolId
    });
    res.json({ success: true, grade: newGrade });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Not eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Attendance
app.get('/api/attendance', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Attendance.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yoklama verisi getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/attendance', async (req, res, next) => {
  try {
    const { studentId, date, status } = req.body || {};
    if (!studentId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Öğrenci ID, tarih ve devamsızlık durumu zorunludur!' });
    }
    const schoolId = getSchoolId(req);
    const record = await db.Attendance.findOne({ where: { studentId, date, schoolId } });
    if (record) {
      record.status = status;
      await record.save();
    } else {
      const id = 'att_' + Math.random().toString(36).slice(2, 9);
      await db.Attendance.create({
        id,
        studentId,
        date,
        status,
        schoolId
      });
    }
    res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yoklama kaydedilemedi: ' + (err.message || 'Hata') });
  }
});

// Homework
app.get('/api/homework', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Homework.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Ödevler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/homework', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { className, subject, title, description, dueDate, mediaUrl, mediaType } = req.body || {};
    if (!className || !subject || !title || !description || !dueDate) {
      return res.status(400).json({ success: false, message: 'Lütfen tüm zorunlu ödev alanlarını doldurun!' });
    }
    const id = 'hw_' + Math.random().toString(36).slice(2, 9);
    const newHw = await db.Homework.create({
      id,
      className,
      subject,
      title,
      description,
      dueDate,
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || '',
      schoolId
    });
    res.json({ success: true, homework: newHw });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Ödev eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Announcements
app.get('/api/announcements', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Announcement.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Duyurular getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/announcements', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { title, message, className, mediaUrl, mediaType } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Duyuru başlığı ve mesajı zorunludur!' });
    }
    const id = 'an_' + Math.random().toString(36).slice(2, 9);
    const newAnn = await db.Announcement.create({
      id,
      title,
      message,
      className: className || null,
      date: new Date().toISOString().slice(0, 10),
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || '',
      schoolId
    });
    res.json({ success: true, announcement: newAnn });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Duyuru eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Authorized Persons
app.get('/api/authorized', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.AuthorizedPerson.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yetkili kişiler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/authorized', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, name, relation, phone } = req.body || {};
    if (!studentId || !name || !relation || !phone) {
      return res.status(400).json({ success: false, message: 'Öğrenci ID, ad, yakınlık ve telefon zorunludur!' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const id = 'ap_' + Math.random().toString(36).slice(2, 9);
    const newAuth = await db.AuthorizedPerson.create({
      id,
      studentId,
      name,
      relation,
      phone,
      validity: 'always',
      code,
      schoolId
    });
    res.json({ success: true, authorized: newAuth });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yetkili kişi eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Pickup Requests
app.get('/api/pickups', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.PickupRequest.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Teslimat çağrıları getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/pickups', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, requesterName, vehiclePlate, code, latitude, longitude } = req.body || {};
    if (!studentId || !requesterName) {
      return res.status(400).json({ success: false, message: 'Öğrenci ID ve teslim alan kişi adı zorunludur!' });
    }
    const id = 'pk_' + Math.random().toString(36).slice(2, 9);
    const newPickup = await db.PickupRequest.create({
      id,
      studentId,
      requesterName,
      vehiclePlate: vehiclePlate || '',
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      code: code || String(Math.floor(100000 + Math.random() * 900000)),
      latitude: (latitude !== undefined && !isNaN(Number(latitude))) ? Number(latitude) : 41.0525,
      longitude: (longitude !== undefined && !isNaN(Number(longitude))) ? Number(longitude) : 28.6895,
      schoolId
    });
    res.json({ success: true, pickup: newPickup });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Teslimat çağrısı oluşturulamadı: ' + (err.message || 'Hata') });
  }
});

app.put('/api/pickups/:id', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    const { status, deliveredAt } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'Durum alanı zorunludur!' });
    }
    const pk = await db.PickupRequest.findOne({ where: { id, schoolId } });
    if (pk) {
      pk.status = status;
      if (deliveredAt) {
        pk.deliveredAt = deliveredAt;
      }
      await pk.save();
      res.json({ success: true, pickup: pk });
    } else {
      res.status(404).json({ success: false, message: 'Teslimat kaydı bulunamadı!' });
    }
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Teslimat güncellenemedi: ' + (err.message || 'Hata') });
  }
});

app.put('/api/pickups/:id/location', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    const { latitude, longitude } = req.body || {};
    if (latitude === undefined || longitude === undefined || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return res.status(400).json({ success: false, message: 'Geçersiz konum koordinatları!' });
    }
    const pk = await db.PickupRequest.findOne({ where: { id, schoolId } });
    if (pk) {
      pk.latitude = Number(latitude);
      pk.longitude = Number(longitude);
      await pk.save();
      res.json({ success: true, pickup: pk });
    } else {
      res.status(404).json({ success: false, message: 'Çağrı bulunamadı!' });
    }
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Konum güncellenemedi: ' + (err.message || 'Hata') });
  }
});

// Gate Logs
app.get('/api/gatelogs', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.GateLog.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Geçiş kayıtları getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/gatelogs', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, type, time, gate } = req.body || {};
    if (!studentId || !type || !time || !gate) {
      return res.status(400).json({ success: false, message: 'Geçiş kaydı için tüm alanlar zorunludur!' });
    }
    const newLog = await db.GateLog.create({
      studentId,
      type,
      time,
      gate,
      schoolId
    });
    res.json({ success: true, log: newLog });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Geçiş kaydı eklenemedi: ' + (err.message || 'Hata') });
  }
});

// Chat Messages
app.get('/api/chat', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.ChatMessage.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Sohbet mesajları getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/chat', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { from, to, message, time, date } = req.body || {};
    if (!from || !to || !message) {
      return res.status(400).json({ success: false, message: 'Gönderen, alıcı ve mesaj metni zorunludur!' });
    }
    const newMsg = await db.ChatMessage.create({
      from,
      to,
      message,
      time: time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      date: date || new Date().toISOString().slice(0, 10),
      schoolId
    });
    res.json({ success: true, chat: newMsg });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Mesaj gönderilemedi: ' + (err.message || 'Hata') });
  }
});

// Meal Menu
app.get('/api/meals', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const meals = await db.MealMenu.findOne({ where: { schoolId } });
    res.json(meals || { soup: '', main: '', side: '', dessert: '' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yemek menüsü getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/meals', async (req, res, next) => {
  try {
    const { soup, main, side, dessert } = req.body || {};
    const schoolId = getSchoolId(req);
    let meals = await db.MealMenu.findOne({ where: { schoolId } });
    if (meals) {
      meals.soup = soup || '';
      meals.main = main || '';
      meals.side = side || '';
      meals.dessert = dessert || '';
      await meals.save();
    } else {
      meals = await db.MealMenu.create({
        id: 'meal_' + Math.random().toString(36).slice(2, 9),
        soup: soup || '',
        main: main || '',
        side: side || '',
        dessert: dessert || '',
        schoolId
      });
    }
    res.json({ success: true, meals });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Yemek menüsü güncellenemedi: ' + (err.message || 'Hata') });
  }
});

// Daily Wellness Logs
app.get('/api/daily-logs', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.DailyLog.findAll({ where: { schoolId } });
    const keyed = {};
    list.forEach(item => {
      keyed[item.studentId] = {
        mealStatus: item.mealStatus,
        mood: item.mood,
        notes: item.notes
      };
    });
    res.json(keyed);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Günlük günlükler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/daily-logs', async (req, res, next) => {
  try {
    const { studentId, mealStatus, mood, notes } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Öğrenci ID zorunludur!' });
    }
    const schoolId = getSchoolId(req);
    let log = await db.DailyLog.findOne({ where: { studentId, schoolId } });
    if (log) {
      log.mealStatus = mealStatus || log.mealStatus;
      log.mood = mood || log.mood;
      log.notes = notes !== undefined ? notes : log.notes;
      await log.save();
    } else {
      log = await db.DailyLog.create({
        studentId,
        mealStatus: mealStatus || 'Hepsi',
        mood: mood || 'Harika',
        notes: notes || '',
        schoolId
      });
    }
    res.json({ success: true, log });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Günlük durum kaydedilemedi: ' + (err.message || 'Hata') });
  }
});

// Dynamic Lessons CRUD API
app.get('/api/lessons', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Lesson.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Dersler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/lessons', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { className, start, end, subject, teacher } = req.body || {};
    if (!className || !start || !end || !subject || !teacher) {
      return res.status(400).json({ success: false, message: 'Ders kaydı için tüm alanlar zorunludur!' });
    }
    const id = 'les_' + Math.random().toString(36).slice(2, 9);
    const newLesson = await db.Lesson.create({
      id,
      className,
      start,
      end,
      subject,
      teacher,
      schoolId
    });
    res.json({ success: true, lesson: newLesson });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Ders eklenemedi: ' + (err.message || 'Hata') });
  }
});

app.delete('/api/lessons/:id', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    await db.Lesson.destroy({ where: { id, schoolId } });
    res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Ders silinemedi: ' + (err.message || 'Hata') });
  }
});

// --- Advanced Modules APIs ---

// 1. Character & Values Education
app.get('/api/values/:studentId', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId } = req.params;
    const list = await db.StudentValueProgress.findAll({ where: { studentId, schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Değerler eğitimi kayıtları getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/values', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, category, progress, badgeName, notes } = req.body || {};
    if (!studentId || !category) {
      return res.status(400).json({ success: false, message: 'Öğrenci ve kategori zorunludur!' });
    }
    const [record, created] = await db.StudentValueProgress.findOrCreate({
      where: { studentId, category, schoolId },
      defaults: { progress: progress || 0, badgeName: badgeName || '', notes: notes || '' }
    });
    if (!created) {
      if (progress !== undefined) record.progress = progress;
      if (badgeName !== undefined) record.badgeName = badgeName;
      if (notes !== undefined) record.notes = notes;
      await record.save();
    }
    res.json({ success: true, record });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Değerler kaydı eklenemedi: ' + (err.message || 'Hata') });
  }
});

// 2. Health & Medicines
app.get('/api/medicines', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.MedicineTask.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İlaç kayıtları getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/medicines', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, medicineName, dosage, scheduledTime, notes } = req.body || {};
    if (!studentId || !medicineName || !dosage || !scheduledTime) {
      return res.status(400).json({ success: false, message: 'Eksik ilaç takip bilgisi girdiniz!' });
    }
    const record = await db.MedicineTask.create({
      studentId,
      medicineName,
      dosage,
      scheduledTime,
      status: 'PENDING',
      notes: notes || '',
      schoolId
    });
    res.json({ success: true, record });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İlaç görevi oluşturulamadı: ' + (err.message || 'Hata') });
  }
});

app.put('/api/medicines/:id/give', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    const record = await db.MedicineTask.findOne({ where: { id, schoolId } });
    if (!record) {
      return res.status(404).json({ success: false, message: 'İlaç kaydı bulunamadı!' });
    }
    record.status = 'GIVEN';
    record.givenAt = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    await record.save();
    res.json({ success: true, record });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İlaç durumu güncellenemedi: ' + (err.message || 'Hata') });
  }
});

// 3. Finance & Tuition
app.get('/api/finance/:studentId', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId } = req.params;
    let finance = await db.StudentFinance.findOne({ where: { studentId, schoolId } });
    if (!finance) {
      finance = { studentId, totalAmount: 0, paidAmount: 0, installments: 1, dueDate: '' };
    }
    res.json(finance);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Finansal bilgiler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/finance', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, totalAmount, paidAmount, installments, dueDate } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Öğrenci ID zorunludur!' });
    }
    const [finance, created] = await db.StudentFinance.findOrCreate({
      where: { studentId, schoolId },
      defaults: { totalAmount: totalAmount || 0, paidAmount: paidAmount || 0, installments: installments || 1, dueDate: dueDate || '' }
    });
    if (!created) {
      if (totalAmount !== undefined) finance.totalAmount = totalAmount;
      if (paidAmount !== undefined) finance.paidAmount = paidAmount;
      if (installments !== undefined) finance.installments = installments;
      if (dueDate !== undefined) finance.dueDate = dueDate;
      await finance.save();
    }
    res.json({ success: true, finance });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Finansal bilgi güncellenemedi: ' + (err.message || 'Hata') });
  }
});

// 4. Surveys & Consents
app.get('/api/surveys', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const list = await db.Survey.findAll({ where: { schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Anketler getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/surveys', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { title, question, options } = req.body || {};
    if (!title || !question || !options) {
      return res.status(400).json({ success: false, message: 'Eksik anket bilgisi girdiniz!' });
    }
    let optionList;
    try {
      optionList = Array.isArray(options) ? options : JSON.parse(options);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Anket seçenekleri geçerli bir dizi veya JSON formatında olmalıdır!' });
    }
    const resultsMap = {};
    optionList.forEach(opt => { resultsMap[opt] = 0; });
    const survey = await db.Survey.create({
      title,
      question,
      options: JSON.stringify(optionList),
      results: JSON.stringify(resultsMap),
      schoolId
    });
    res.json({ success: true, survey });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Anket oluşturulamadı: ' + (err.message || 'Hata') });
  }
});

app.post('/api/surveys/vote', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { surveyId, option } = req.body || {};
    if (!surveyId || !option) {
      return res.status(400).json({ success: false, message: 'Anket ID ve oy seçeneği zorunludur!' });
    }
    const survey = await db.Survey.findOne({ where: { id: surveyId, schoolId } });
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Anket bulunamadı!' });
    }
    let resultsMap;
    try {
      resultsMap = JSON.parse(survey.results);
    } catch (e) {
      resultsMap = {};
    }
    if (resultsMap[option] !== undefined) {
      resultsMap[option] += 1;
      survey.results = JSON.stringify(resultsMap);
      await survey.save();
    }
    res.json({ success: true, survey });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Oy kaydı başarısız: ' + (err.message || 'Hata') });
  }
});

app.get('/api/consents/:studentId', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId } = req.params;
    const list = await db.ConsentRequest.findAll({ where: { studentId, schoolId } });
    res.json(list);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İzin belgeleri getirilemedi: ' + (err.message || 'Hata') });
  }
});

app.post('/api/consents', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentId, title, description } = req.body || {};
    if (!studentId || !title || !description) {
      return res.status(400).json({ success: false, message: 'Tüm alanlar zorunludur!' });
    }
    const record = await db.ConsentRequest.create({
      studentId,
      title,
      description,
      status: 'PENDING',
      schoolId
    });
    res.json({ success: true, record });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İzin talebi oluşturulamadı: ' + (err.message || 'Hata') });
  }
});

app.put('/api/consents/:id/respond', async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    const { status, signedBy } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'Durum yanıtı zorunludur!' });
    }
    const record = await db.ConsentRequest.findOne({ where: { id, schoolId } });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Talep bulunamadı!' });
    }
    record.status = status;
    record.signedBy = signedBy || '';
    await record.save();
    res.json({ success: true, record });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'İzin yanıtı kaydedilemedi: ' + (err.message || 'Hata') });
  }
});
// ==========================================
// SUPER ADMIN MANAGEMENT APIs
// ==========================================

// Super Admin Login
app.post('/api/superadmin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre zorunludur!' });
    }

    let user = await db.User.findOne({
      where: {
        username,
        [Sequelize.Op.or]: [
          { role: 'superadmin' },
          { isSuperAdmin: true }
        ]
      }
    });

    // Fallback check if user is superadmin
    if (!user && username === 'superadmin') {
      user = await db.User.findOne({ where: { username: 'superadmin' } });
    }

    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Süper yönetici yetkisi bulunamadı veya şifre hatalı!' });
    }

    const isValid = await bcrypt.compare(String(password), user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Şifre hatalı!' });
    }

    res.json({
      success: true,
      role: 'superadmin',
      name: user.name,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Giriş hatası: ' + err.message });
  }
});

// Super Admin List All Schools
app.get('/api/superadmin/schools', async (req, res) => {
  try {
    const schools = await db.School.findAll({
      order: [['createdAt', 'DESC']]
    });

    const schoolsWithStats = await Promise.all(schools.map(async (school) => {
      const studentCount = await db.Student.count({ where: { schoolId: school.id } });
      const teacherCount = await db.User.count({ where: { schoolId: school.id, role: 'teacher' } });
      const adminUser = await db.User.findOne({ where: { schoolId: school.id, role: 'admin' } });

      const now = new Date();
      let daysLeft = 0;
      let isExpired = false;

      if (school.subscriptionStatus === 'TRIAL') {
        const trialEnd = school.trialEndsAt ? new Date(school.trialEndsAt) : new Date(new Date(school.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000);
        daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
        if (daysLeft <= 0) isExpired = true;
      } else if (school.subscriptionStatus === 'ACTIVE') {
        if (school.subscriptionEndsAt) {
          const subEnd = new Date(school.subscriptionEndsAt);
          daysLeft = Math.max(0, Math.ceil((subEnd - now) / (1000 * 60 * 60 * 24)));
          if (daysLeft <= 0) isExpired = true;
        } else {
          daysLeft = 365;
        }
      } else {
        isExpired = true;
      }

      return {
        id: school.id,
        name: school.name,
        type: school.type,
        logoUrl: school.logoUrl,
        studentQuota: school.studentQuota || 15,
        studentCount,
        teacherQuota: school.teacherQuota || 5,
        teacherCount,
        subscriptionStatus: isExpired ? 'EXPIRED' : (school.subscriptionStatus || 'TRIAL'),
        trialEndsAt: school.trialEndsAt,
        subscriptionEndsAt: school.subscriptionEndsAt,
        daysLeft,
        isExpired,
        contactPhone: school.contactPhone || (adminUser ? adminUser.phone : ''),
        adminUsername: adminUser ? adminUser.username : '',
        adminName: adminUser ? adminUser.name : '',
        notes: school.notes || '',
        createdAt: school.createdAt
      };
    }));

    res.json({ success: true, schools: schoolsWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Okullar listelenemedi: ' + err.message });
  }
});

// Super Admin Update School Subscription / Quota
app.put('/api/superadmin/schools/:id/subscription', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentQuota, teacherQuota, subscriptionStatus, durationYears, subscriptionEndsAt, notes, contactPhone } = req.body || {};

    const school = await db.School.findByPk(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'Okul bulunamadı!' });
    }

    if (studentQuota !== undefined) school.studentQuota = parseInt(studentQuota, 10);
    if (teacherQuota !== undefined) school.teacherQuota = parseInt(teacherQuota, 10);
    if (subscriptionStatus) school.subscriptionStatus = subscriptionStatus;
    if (notes !== undefined) school.notes = notes;
    if (contactPhone !== undefined) school.contactPhone = contactPhone;

    if (durationYears) {
      const years = parseInt(durationYears, 10);
      const baseDate = (school.subscriptionEndsAt && new Date(school.subscriptionEndsAt) > new Date())
        ? new Date(school.subscriptionEndsAt)
        : new Date();
      baseDate.setFullYear(baseDate.getFullYear() + years);
      school.subscriptionEndsAt = baseDate;
      school.subscriptionStatus = 'ACTIVE';
    } else if (subscriptionEndsAt) {
      school.subscriptionEndsAt = new Date(subscriptionEndsAt);
    }

    await school.save();

    res.json({
      success: true,
      message: `${school.name} lisans bilgileri başarıyla güncellendi.`,
      school
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lisans güncellenemedi: ' + err.message });
  }
});

// Comprehensive Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR HANDLER]:', err.message || err);
  
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Sunucuda beklenmeyen bir hata oluştu.';

  if (err.name === 'SequelizeUniqueConstraintError') {
    status = 400;
    message = 'Bu kayıt sistemde zaten mevcut! Lütfen benzersiz bir değer giriniz.';
  } else if (err.name === 'SequelizeValidationError') {
    status = 400;
    message = err.errors && err.errors.length > 0 
      ? err.errors.map(e => e.message).join(', ')
      : 'Girilen bilgiler doğrulama kurallarına uymuyor.';
  } else if (err.name === 'SequelizeDatabaseError') {
    status = 500;
    message = 'Veritabanı işlemi gerçekleştirilirken bir hata oluştu.';
  } else if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Dosya boyutu çok büyük! Maksimum 50MB yükleyebilirsiniz.';
    } else {
      message = 'Dosya yükleme hatası: ' + err.message;
    }
  }

  res.status(status).json({
    success: false,
    message
  });
});

// Init database and Start Server
if (require.main === module) {
  db.initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Okul360 Server is running on port ${PORT} (0.0.0.0)`);
    });
  }).catch(err => {
    console.error('Sunucu başlatılamadı:', err);
  });
}

module.exports = app;

