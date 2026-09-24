const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

const isPg = process.env.DATABASE_URL || process.env.DB_DIALECT === 'postgres';
let sequelize;

if (process.env.DATABASE_URL) {
  const isSSL = process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: isSSL ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: false
  });
} else if (process.env.DB_DIALECT === 'postgres') {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'okul360',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false
    }
  );
} else {
  const dbStorage = process.env.DB_STORAGE || path.join(__dirname, 'okul360.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbStorage,
    logging: false
  });
}

const School = sequelize.define('School', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Okul' }, // Okul, Dershane, Anaokulu, Sübyan Mektebi, Değerler Okulu
  logoUrl: { type: DataTypes.STRING, allowNull: true },
  studentQuota: { type: DataTypes.INTEGER, defaultValue: 15 },
  teacherQuota: { type: DataTypes.INTEGER, defaultValue: 5 },
  subscriptionStatus: { type: DataTypes.STRING, defaultValue: 'TRIAL' }, // TRIAL, ACTIVE, EXPIRED, SUSPENDED
  trialEndsAt: { type: DataTypes.DATE, allowNull: true },
  subscriptionEndsAt: { type: DataTypes.DATE, allowNull: true },
  contactPhone: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
});

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  role: { type: DataTypes.STRING, allowNull: false }, // superadmin, admin, teacher, security, parent
  name: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  subject: { type: DataTypes.STRING, allowNull: true }, // Branş (Öğretmenler için)
  isSuperAdmin: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Student = sequelize.define('Student', {
  id: { type: DataTypes.STRING, primaryKey: true }, // Örn: st_alp
  name: { type: DataTypes.STRING, allowNull: false },
  surname: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
  photoUrl: { type: DataTypes.STRING, allowNull: true },
  birthDate: { type: DataTypes.STRING, allowNull: true },
  tcNo: { type: DataTypes.STRING, allowNull: true },
  className: { type: DataTypes.STRING, allowNull: false },
  
  // Anne Bilgileri
  motherName: { type: DataTypes.STRING, allowNull: true },
  motherSurname: { type: DataTypes.STRING, allowNull: true },
  motherJob: { type: DataTypes.STRING, allowNull: true },
  motherPhone: { type: DataTypes.STRING, allowNull: true },
  
  // Baba Bilgileri
  fatherName: { type: DataTypes.STRING, allowNull: true },
  fatherSurname: { type: DataTypes.STRING, allowNull: true },
  fatherJob: { type: DataTypes.STRING, allowNull: true },
  fatherPhone: { type: DataTypes.STRING, allowNull: true },
  
  // Acil Durum İletişim
  emergencyContact: { type: DataTypes.STRING, allowNull: true },
  
  // Ek Bilgiler
  prevReligiousEdu: { type: DataTypes.STRING, allowNull: true },
  prevReligiousEduDetail: { type: DataTypes.STRING, allowNull: true },
  healthAllergyInfo: { type: DataTypes.STRING, allowNull: true },
  additionalNotes: { type: DataTypes.TEXT, allowNull: true },
  referralSource: { type: DataTypes.STRING, allowNull: true },

  // Geriye dönük uyumluluk için
  parentName: { type: DataTypes.STRING, allowNull: false },
  parentPhone: { type: DataTypes.STRING, allowNull: false }
});

const Lesson = sequelize.define('Lesson', {
  id: { type: DataTypes.STRING, primaryKey: true }, // les_123
  className: { type: DataTypes.STRING, allowNull: false },
  start: { type: DataTypes.STRING, allowNull: false },
  end: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: false },
  teacher: { type: DataTypes.STRING, allowNull: false }
});

const Grade = sequelize.define('Grade', {
  id: { type: DataTypes.STRING, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: false },
  examName: { type: DataTypes.STRING, allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false }
});

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.STRING, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false } // geldi, gelmedi
});

const Homework = sequelize.define('Homework', {
  id: { type: DataTypes.STRING, primaryKey: true },
  className: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  dueDate: { type: DataTypes.STRING, allowNull: false },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  mediaType: { type: DataTypes.STRING, defaultValue: '' }
});

const Announcement = sequelize.define('Announcement', {
  id: { type: DataTypes.STRING, primaryKey: true },
  className: { type: DataTypes.STRING, allowNull: true }, // null ise tüm okula
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  mediaType: { type: DataTypes.STRING, defaultValue: '' }
});

const AuthorizedPerson = sequelize.define('AuthorizedPerson', {
  id: { type: DataTypes.STRING, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  relation: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  validity: { type: DataTypes.STRING, defaultValue: 'always' },
  code: { type: DataTypes.STRING, allowNull: false }
});

const PickupRequest = sequelize.define('PickupRequest', {
  id: { type: DataTypes.STRING, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  requesterName: { type: DataTypes.STRING, allowNull: false },
  vehiclePlate: { type: DataTypes.STRING, defaultValue: '' },
  status: { type: DataTypes.STRING, defaultValue: 'REQUESTED' }, // REQUESTED, PREPARING, READY, DELIVERED, CANCELLED
  createdAt: { type: DataTypes.STRING, allowNull: false },
  deliveredAt: { type: DataTypes.STRING, allowNull: true },
  code: { type: DataTypes.STRING, allowNull: false },
  latitude: { type: DataTypes.DOUBLE, defaultValue: 41.0525 },
  longitude: { type: DataTypes.DOUBLE, defaultValue: 28.6895 }
});

const GateLog = sequelize.define('GateLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // GİRİŞ, ÇIKIŞ
  time: { type: DataTypes.STRING, allowNull: false },
  gate: { type: DataTypes.STRING, allowNull: false }
});

const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  from: { type: DataTypes.STRING, allowNull: false },
  to: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false }
});

const MealMenu = sequelize.define('MealMenu', {
  id: { type: DataTypes.STRING, primaryKey: true }, // Örn: meal_1
  soup: { type: DataTypes.STRING, defaultValue: '' },
  main: { type: DataTypes.STRING, defaultValue: '' },
  side: { type: DataTypes.STRING, defaultValue: '' },
  dessert: { type: DataTypes.STRING, defaultValue: '' }
});

const DailyLog = sequelize.define('DailyLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, unique: true, allowNull: false },
  mealStatus: { type: DataTypes.STRING, defaultValue: 'Hepsi' },
  mood: { type: DataTypes.STRING, defaultValue: 'Harika' },
  notes: { type: DataTypes.TEXT, defaultValue: '' }
});

const StudentValueProgress = sequelize.define('StudentValueProgress', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  progress: { type: DataTypes.INTEGER, defaultValue: 0 },
  badgeName: { type: DataTypes.STRING, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' }
});

const MedicineTask = sequelize.define('MedicineTask', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  medicineName: { type: DataTypes.STRING, allowNull: false },
  dosage: { type: DataTypes.STRING, allowNull: false },
  scheduledTime: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
  givenAt: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' }
});

const StudentFinance = sequelize.define('StudentFinance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false, unique: true },
  totalAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
  paidAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
  installments: { type: DataTypes.INTEGER, defaultValue: 1 },
  dueDate: { type: DataTypes.STRING, defaultValue: '' }
});

const Survey = sequelize.define('Survey', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  question: { type: DataTypes.STRING, allowNull: false },
  options: { type: DataTypes.TEXT, allowNull: false },
  results: { type: DataTypes.TEXT, allowNull: false }
});

const ConsentRequest = sequelize.define('ConsentRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
  signedBy: { type: DataTypes.STRING, defaultValue: '' }
});

// Modeller Arası İlişkileri Kur (SaaS Multi-School Isolation)
const models = { School, User, Student, Lesson, Grade, Attendance, Homework, Announcement, AuthorizedPerson, PickupRequest, GateLog, ChatMessage, MealMenu, DailyLog, StudentValueProgress, MedicineTask, StudentFinance, Survey, ConsentRequest };

Object.keys(models).forEach((modelName) => {
  if (modelName !== 'School') {
    School.hasMany(models[modelName], { foreignKey: 'schoolId', onDelete: 'CASCADE' });
    models[modelName].belongsTo(School, { foreignKey: 'schoolId' });
  }
});

// Seed data function to populate DB on first boot
const seedDatabase = async () => {
  try {
    console.log('SQL Veritabanı kontrol ediliyor ve başlangıç verileri senkronize ediliyor...');

    // 1. Create Default School if missing
    let school1 = await School.findByPk('school_1');
    if (!school1) {
      school1 = await School.create({
        id: 'school_1',
        name: 'Bahçeşehir Prestij Koleji',
        type: 'Okul',
        logoUrl: '',
        studentQuota: 50,
        teacherQuota: 10,
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        contactPhone: '05349577969',
        notes: 'Varsayılan Demo Okulu'
      });
    }

    // 2. Create Hashed Staff Users if missing
    const userCount = await User.count();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash('123', 10);
      await User.bulkCreate([
        { role: 'admin', name: 'Okul Müdürü', username: 'admin', password: hashedPassword, schoolId: 'school_1' },
        { role: 'security', name: 'Kapı Güvenlik', username: 'security', password: hashedPassword, schoolId: 'school_1' },
        { role: 'teacher', name: 'Dr. Ahmet Yılmaz', username: 'ahmet', password: hashedPassword, subject: 'Matematik', schoolId: 'school_1' },
        { role: 'teacher', name: 'Zeynep Kaya', username: 'zeynep', password: hashedPassword, subject: 'Fen Bilimleri', schoolId: 'school_1' },
        { role: 'teacher', name: 'Selin Demir', username: 'selin', password: hashedPassword, subject: 'Türkçe', schoolId: 'school_1' }
      ]);
    }

    // 2.1 Ensure Super Admin User exists
    let superAdmin = await User.findOne({ where: { username: 'superadmin' } });
    if (!superAdmin) {
      const superHash = await bcrypt.hash('123', 10);
      await User.create({
        role: 'superadmin',
        name: 'Sistem Süper Yöneticisi',
        username: 'superadmin',
        password: superHash,
        phone: '05349577969',
        isSuperAdmin: true,
        schoolId: 'school_1'
      });
    }

    // 3. Create Default Students if missing
    const studentCount = await Student.count();
    if (studentCount === 0) {
      await Student.bulkCreate([
        { 
          id: 'st_alp', 
      name: 'Alp', 
      surname: 'Ekinci', 
      birthDate: '2012-05-15',
      tcNo: '12345678901',
      className: '8-LGS VIP', 
      motherName: 'Emel',
      motherSurname: 'Ekinci',
      motherJob: 'Mühendis',
      motherPhone: '05349577969',
      fatherName: 'Engin',
      fatherSurname: 'Ekinci',
      fatherJob: 'Yazılımcı',
      fatherPhone: '05349577969',
      emergencyContact: 'Amca Mehmet Ekinci - 05335554433',
      prevReligiousEdu: 'Hayır',
      prevReligiousEduDetail: '',
      healthAllergyInfo: 'Yok',
      additionalNotes: 'Herhangi bir not yok.',
      referralSource: 'İnternet Araması',
      parentName: 'Engin Ekinci', 
      parentPhone: '05349577969', 
      schoolId: 'school_1' 
    },
    { 
      id: 'st_elif', 
      name: 'Elif', 
      surname: 'Yılmaz', 
      birthDate: '2015-08-20',
      tcNo: '98765432101',
      className: '5-A Üstün Zekalılar', 
      motherName: 'Ayşe',
      motherSurname: 'Yılmaz',
      motherJob: 'Ev Hanımı',
      motherPhone: '05429876543',
      fatherName: 'Mehmet',
      fatherSurname: 'Yılmaz',
      fatherJob: 'Esnaf',
      fatherPhone: '05429876543',
      emergencyContact: 'Teyze Fatma Kaya - 05412223344',
      prevReligiousEdu: 'Evet',
      prevReligiousEduDetail: 'Kuran Kursu',
      healthAllergyInfo: 'Gluten Hassasiyeti',
      additionalNotes: 'Okula servis ile gelip gidecek.',
      referralSource: 'Sosyal Medya',
      parentName: 'Ayşe Yılmaz', 
      parentPhone: '05429876543', 
      schoolId: 'school_1' 
    },
    { 
      id: 'st_kaan', 
      name: 'Kaan', 
      surname: 'Demir', 
      birthDate: '2009-11-02',
      tcNo: '55544433322',
      className: '12-Sayısal Derece', 
      motherName: 'Merve',
      motherSurname: 'Demir',
      motherJob: 'Doktor',
      motherPhone: '05551112233',
      fatherName: 'Murat',
      fatherSurname: 'Demir',
      fatherJob: 'Mimar',
      fatherPhone: '05551112233',
      emergencyContact: 'Dayı Ahmet Kaya - 05559998877',
      prevReligiousEdu: 'Hayır',
      prevReligiousEduDetail: '',
      healthAllergyInfo: 'Yok',
      additionalNotes: 'Derece sınıfında ek kaynaklar takip ediyor.',
      referralSource: 'Tavsiye',
      parentName: 'Murat Demir', 
      parentPhone: '05551112233', 
      schoolId: 'school_1' 
    }
  ]);
  }

  // 4. Create Default Lessons
  if ((await Lesson.count()) === 0) {
    await Lesson.bulkCreate([
      { id: 'les1', className: '8-LGS VIP', start: '09:00', end: '09:40', subject: 'Matematik', teacher: 'Dr. Ahmet Yılmaz', schoolId: 'school_1' },
      { id: 'les2', className: '8-LGS VIP', start: '09:50', end: '10:30', subject: 'Matematik', teacher: 'Dr. Ahmet Yılmaz', schoolId: 'school_1' },
      { id: 'les3', className: '8-LGS VIP', start: '10:45', end: '11:25', subject: 'Türkçe', teacher: 'Selin Demir', schoolId: 'school_1' },
      { id: 'les4', className: '8-LGS VIP', start: '11:35', end: '12:15', subject: 'Fen Bilimleri', teacher: 'Zeynep Kaya', schoolId: 'school_1' },
      { id: 'les5', className: '8-LGS VIP', start: '12:15', end: '13:00', subject: 'Öğle Arası Yemek', teacher: '-', schoolId: 'school_1' },
      { id: 'les6', className: '8-LGS VIP', start: '13:00', end: '13:40', subject: 'Fen Bilimleri', teacher: 'Zeynep Kaya', schoolId: 'school_1' },
      { id: 'les7', className: '8-LGS VIP', start: '13:50', end: '14:30', subject: 'İngilizce', teacher: 'Selin Demir', schoolId: 'school_1' },
      { id: 'les8', className: '8-LGS VIP', start: '14:40', end: '15:20', subject: 'LGS Soru Çözümü', teacher: 'Dr. Ahmet Yılmaz', schoolId: 'school_1' },
      { id: 'les9', className: '8-LGS VIP', start: '15:30', end: '16:10', subject: 'Etüt', teacher: 'Dr. Ahmet Yılmaz', schoolId: 'school_1' }
    ], { ignoreDuplicates: true });
  }

  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const getDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const getDaysAhead = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // 5. Create Default Grades
  if ((await Grade.count()) === 0) {
    await Grade.bulkCreate([
      { id: 'g1', studentId: 'st_alp', subject: 'Matematik', examName: 'LGS Deneme-1', score: 85, date: getDaysAgo(14), schoolId: 'school_1' },
      { id: 'g2', studentId: 'st_alp', subject: 'Matematik', examName: '1. Yazılı', score: 90, date: getDaysAgo(10), schoolId: 'school_1' },
      { id: 'g3', studentId: 'st_alp', subject: 'Matematik', examName: 'LGS Deneme-2', score: 94, date: getDaysAgo(5), schoolId: 'school_1' },
      { id: 'g4', studentId: 'st_alp', subject: 'Fen Bilimleri', examName: '1. Yazılı', score: 88, date: getDaysAgo(7), schoolId: 'school_1' },
      { id: 'g5', studentId: 'st_alp', subject: 'Türkçe', examName: '1. Yazılı', score: 92, date: getDaysAgo(2), schoolId: 'school_1' }
    ], { ignoreDuplicates: true });
  }

  // 6. Create Attendance Log
  if ((await Attendance.count()) === 0) {
    await Attendance.create({
      id: 'at1',
      studentId: 'st_alp',
      date: getTodayStr(),
      status: 'geldi',
      schoolId: 'school_1'
    });
  }

  // 7. Create Homework
  if ((await Homework.count()) === 0) {
    await Homework.bulkCreate([
      { id: 'hw1', className: '8-LGS VIP', subject: 'Matematik', title: 'Üslü Sayılar ve Karekök', description: 'Premium LGS soru bankasından test 4 ve 5 tamamlanacak.', dueDate: getDaysAhead(2), schoolId: 'school_1' },
      { id: 'hw2', className: '8-LGS VIP', subject: 'Fen Bilimleri', title: 'Mevsimlerin Oluşumu', description: 'Ders kitabındaki konu sonu değerlendirme soruları çözülecek.', dueDate: getDaysAhead(4), schoolId: 'school_1' },
      { id: 'hw3', className: '5-A Üstün Zekalılar', subject: 'Türkçe', title: 'Kitap Analizi', description: 'Seçilen dünya klasiği kitabın ilk 50 sayfasının analizi yazılacak.', dueDate: getDaysAhead(7), schoolId: 'school_1' }
    ], { ignoreDuplicates: true });
  }

  // 8. Create Announcements
  if ((await Announcement.count()) === 0) {
    await Announcement.bulkCreate([
      { id: 'an1', title: 'LGS Prova Sınavı', message: 'Tüm 8. sınıflarımız için LGS Deneme sınavı bu Cumartesi saat 10:00dadır.', date: getTodayStr(), className: '8-LGS VIP', schoolId: 'school_1' },
      { id: 'an2', title: 'Prestij Kulüp Çalışmaları', message: 'Ders dışı kulüp faaliyetlerimiz haftaya Pazartesi günü başlayacaktır.', date: getDaysAgo(1), className: null, schoolId: 'school_1' }
    ], { ignoreDuplicates: true });
  }

  // 9. Create Authorized Persons (Akrabalar)
  if ((await AuthorizedPerson.count()) === 0) {
    await AuthorizedPerson.create({
      id: 'ap1',
      studentId: 'st_alp',
      name: 'Mehmet Ekinci',
      relation: 'Amca',
      phone: '05335554433',
      validity: 'always',
      code: '482931',
      schoolId: 'school_1'
    });
  }

  // 10. Gate entry log
  if ((await GateLog.count()) === 0) {
    await GateLog.create({
      studentId: 'st_alp',
      type: 'GİRİŞ',
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      gate: 'Turnike 1 - Ana Giriş',
      schoolId: 'school_1'
    });
  }

  // 11. Initial Chat Message
  if ((await ChatMessage.count()) === 0) {
    await ChatMessage.create({
      from: 't_ahmet',
      to: 'st_alp_parent',
      message: 'Merhabalar Engin Bey, Alp bugün matematik dersinde çok aktifti. Konuyu gayet iyi pekiştirdi.',
      time: '16:15',
      date: getTodayStr(),
      schoolId: 'school_1'
    });
  }

  // 12. Meal Menu
  if ((await MealMenu.count()) === 0) {
    await MealMenu.create({
      id: 'meal_1',
      soup: 'Organik Mercimek Çorbası',
      main: 'Kuzu Tandır ve Fırın Patates',
      side: 'Saray Pilavı (Safranlı)',
      dessert: 'Antep Fıstıklı Ev Baklavası',
      schoolId: 'school_1'
    });
  }

  // 13. Daily observation logs
  if ((await DailyLog.count()) === 0) {
    await DailyLog.create({
      studentId: 'st_alp',
      mealStatus: 'Hepsi',
      mood: 'Harika',
      notes: 'Bugün çok konsantreydi. Matematik dersinde tahtadaki zor soruya çok güzel bir yaklaşım getirdi.',
      schoolId: 'school_1'
    });
  }

  // 14. Seed Student Value Progress
  if ((await StudentValueProgress.count()) === 0) {
    await StudentValueProgress.bulkCreate([
      { studentId: 'st_alp', category: 'Kuran-ı Kerim', progress: 65, badgeName: 'Elif-Ba Fatihi', notes: 'Kur\'an okumada tecvid kurallarına geçildi.', schoolId: 'school_1' },
      { studentId: 'st_alp', category: 'Namaz Takibi', progress: 80, badgeName: 'Cemaat Yoldaşı', notes: 'Vakit namazlarına düzenli katılım sağlıyor.', schoolId: 'school_1' },
      { studentId: 'st_alp', category: 'Yardımlaşma', progress: 95, badgeName: 'Gönül Elçisi', notes: 'Arkadaşlarına derslerde ve dışarıda yardımcı oluyor.', schoolId: 'school_1' }
    ], { ignoreDuplicates: true });
  }

  // 15. Seed Medicine Task
  if ((await MedicineTask.count()) === 0) {
    await MedicineTask.create({
      studentId: 'st_alp',
      medicineName: 'Calpol Şurup',
      dosage: '1 Ölçek (5ml)',
      scheduledTime: '13:00',
      status: 'PENDING',
      notes: 'Öğle yemeğinden sonra tok karnına verilecek.',
      schoolId: 'school_1'
    });
  }

  // 16. Seed Student Finance
  if ((await StudentFinance.count()) === 0) {
    await StudentFinance.create({
      studentId: 'st_alp',
      totalAmount: 45000,
      paidAmount: 20000,
      installments: 10,
      dueDate: getDaysAhead(30),
      schoolId: 'school_1'
    });
  }

  // 17. Seed Survey
  if ((await Survey.count()) === 0) {
    await Survey.create({
      title: 'Hafta Sonu Etkinlik Tercihi',
      question: 'Cumartesi günü düzenlenecek piknik gezisine katılmak ister misiniz?',
      options: JSON.stringify(['Evet, Katılacağız', 'Hayır, Katılmayacağız', 'Kararsızız']),
      results: JSON.stringify({'Evet, Katılacağız': 5, 'Hayır, Katılmayacağız': 2, 'Kararsızız': 1}),
      schoolId: 'school_1'
    });
  }

  // 18. Seed Consent Request
  if ((await ConsentRequest.count()) === 0) {
    await ConsentRequest.create({
      studentId: 'st_alp',
      title: 'Doğa Yürüyüşü ve Çevre Temizliği İzin Belgesi',
      description: 'Önümüzdeki hafta sonu düzenlenecek Belgrad Ormanı Doğa Yürüyüşü ve Çevre Temizliği etkinliğine öğrencimizin katılmasına ve servis aracıyla seyahat etmesine velisi olarak izin veriyorum.',
      status: 'PENDING',
      schoolId: 'school_1'
    });
  }

    console.log('Okul360 başlangıç verileri başarıyla yüklendi.');
  } catch (seedErr) {
    console.error('Seed veritabanı hatası (sunucu çalışmaya devam ediyor):', seedErr.message || seedErr);
  }
};

const initDb = async () => {
  try {
    await sequelize.authenticate();
    console.log('SQL Veritabanı bağlantısı başarıyla kuruldu.');
    
    // Sync models to database with fallback
    try {
      await sequelize.sync({ alter: true });
    } catch (syncErr) {
      console.warn('Sync alter uyarısı, standart sync kullanılıyor:', syncErr.message);
      try {
        await sequelize.sync();
      } catch (err2) {
        console.error('Sequelize sync hatası (sunucu çalışmaya devam ediyor):', err2.message || err2);
      }
    }
    
    // Seed initial mock values
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.error('Seed veritabanı hatası:', seedErr.message || seedErr);
    }
  } catch (error) {
    console.error('Veritabanı başlatma hatası (sunucu çalışmaya devam ediyor):', error.message || error);
  }
};

module.exports = {
  sequelize,
  initDb,
  seedDatabase,
  ...models
};
