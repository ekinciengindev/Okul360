import React, { useState, useEffect, useRef } from 'react';

let activeApiHost = '192.168.1.136';

const getHost = () => {
  if (window.Capacitor?.isNativePlatform()) {
    return activeApiHost;
  }
  return window.location.hostname || 'localhost';
};

const LIVE_API_URL = 'https://okul360.onrender.com/api';

const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const schoolId = localStorage.getItem('okul360_schoolId') || 'school_1';
  let targetUrl = url.toString();
  
  options.headers = options.headers || {};
  if (!options.headers['x-school-id']) {
    options.headers['x-school-id'] = schoolId;
  }
  
  try {
    const res = await originalFetch(targetUrl, options);
    return res;
  } catch (err) {
    const candidateHosts = ['okul360.onrender.com', '192.168.1.136', '10.0.2.2'];
    for (const host of candidateHosts) {
      if (!targetUrl.includes(host)) {
        const protocol = host.includes('.onrender.com') ? 'https' : 'http';
        const portStr = host.includes('.onrender.com') ? '' : ':5000';
        const fallbackUrl = targetUrl.replace(/https?:\/\/[^/]+/, `${protocol}://${host}${portStr}`);
        try {
          const fallbackRes = await originalFetch(fallbackUrl, options);
          activeApiHost = host;
          return fallbackRes;
        } catch (e) {
          // continue loop
        }
      }
    }
    throw err;
  }
};

const API_BASE = import.meta.env.VITE_API_URL || LIVE_API_URL;

// Password Change Modal Component
function PasswordChangeModal({ isOpen, onClose, userId, showToast }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Yeni şifreler eşleşmiyor!', true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oldPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Şifreniz başarıyla güncellendi.');
        onClose();
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(data.message || 'Şifre güncellenemedi!', true);
      }
    } catch (err) {
      showToast('Bağlantı hatası!', true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '360px', margin: 0, background: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary)' }}>Şifre Değiştir</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Mevcut Şifre</label>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>
          <div className="field" style={{ marginTop: '12px' }}>
            <label>Yeni Şifre</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="field" style={{ marginTop: '12px' }}>
            <label>Yeni Şifre (Tekrar)</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '18px' }}>Güncelle</button>
        </form>
      </div>
    </div>
  );
}

// Account Delete Modal Component (Mandatory for Apple App Store 5.1.1(v))
function AccountDeleteModal({ isOpen, onClose, user, logOut, showToast }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async (e) => {
    e.preventDefault();
    if (confirmText !== 'SIL' && confirmText !== 'DELETE') {
      showToast('Lütfen silme işlemini onaylamak için SIL yazın!', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/account/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: user?.role,
          userId: user?.userId,
          parentPhone: user?.parentPhone,
          confirmationText: confirmText
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Hesabınız ve verileriniz silindi.');
        onClose();
        logOut();
      } else {
        showToast(data.message || 'Hesap silinirken hata oluştu!', true);
      }
    } catch (err) {
      showToast('Hesap silme bağlantı hatası!', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '380px', margin: 0, background: '#fff', borderRadius: '16px', borderTop: '4px solid var(--error)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--error)' }}>⚠️ Hesabımı Sil</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
          Apple ve Mağaza kuralları gereği hesabınızı ve ilişkili tüm kişisel verilerinizi dilediğiniz zaman kalıcı olarak silebilirsiniz. <strong>Bu işlem geri alınamaz!</strong>
        </p>
        <form onSubmit={handleDelete}>
          <div className="field">
            <label>Onaylamak için <strong>SIL</strong> yazın:</label>
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SIL" required />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn" style={{ flex: 1, background: 'var(--error)', color: '#fff' }} disabled={loading}>
              {loading ? 'Siliniyor...' : 'Evet, Kalıcı Olarak Sil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Privacy Policy Modal Component
function PrivacyPolicyModal({ isOpen, onClose }) {
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_BASE}/privacy-policy`)
        .then(res => res.json())
        .then(data => setPolicy(data))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', margin: 0, background: '#fff', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--primary)' }}>{policy ? policy.title : 'Gizlilik Politikası'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
        </div>
        {policy ? (
          <div style={{ fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {policy.content}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Yükleniyor...</div>
        )}
        <button className="btn btn-accent" style={{ width: '100%', marginTop: '16px' }} onClick={onClose}>Kapat</button>
      </div>
    </div>
  );
}

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Tone 1: E5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);

    // Tone 2: G5
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      gain2.gain.setValueAtTime(0.08, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.4);
    }, 120);
  } catch (e) {
    console.error('Web Audio API notification chime blocked or unsupported', e);
  }
};

// Haversine Distance Calculator
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c); // in metres
};

const parseTime = (tStr) => {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return h * 60 + m;
};

// Reusable Leaflet Map Component (Exposes real-time location lossless-ly)
function PickupMap({ pickup, schoolCoords = [41.0583, 28.6942] }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const parentMarker = useRef(null);
  const schoolMarker = useRef(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapRef.current) return;

    const parentLat = pickup.latitude || 41.0525;
    const parentLng = pickup.longitude || 28.6895;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(schoolCoords, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap.current);

      // School Marker
      schoolMarker.current = L.marker(schoolCoords).addTo(leafletMap.current)
        .bindPopup("🏫 <b>Prestij Koleji</b><br/>Öğrenci Teslim Noktası")
        .openPopup();
    }

    // Parent Marker
    if (!parentMarker.current) {
      parentMarker.current = L.marker([parentLat, parentLng]).addTo(leafletMap.current)
        .bindPopup(`🚗 <b>Veli (${pickup.requesterName})</b>`);
    } else {
      parentMarker.current.setLatLng([parentLat, parentLng]);
    }

    // Fit view bounds dynamically
    try {
      const group = L.featureGroup([schoolMarker.current, parentMarker.current]);
      leafletMap.current.fitBounds(group.getBounds().pad(0.2));
    } catch (e) {
      console.error('Error fitting Leaflet map bounds', e);
    }
  }, [pickup, schoolCoords]);

  // Clean up Leaflet map instance on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        parentMarker.current = null;
        schoolMarker.current = null;
      }
    };
  }, []);

  if (typeof L === 'undefined') {
    return (
      <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
        Harita yükleniyor...
      </div>
    );
  }

  return (
    <div ref={mapRef} style={{ width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', marginTop: '8px', zIndex: 1 }} />
  );
}

export default function App() {
  const [user, setUser] = useState(null); // { role, details }
  const [toastMsg, setToastMsg] = useState('');
  const [toastAlert, setToastAlert] = useState(false);
  const [now, setNow] = useState(new Date());

  // Real-time live clock ticker
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const simDay = days[now.getDay()];
  const simTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formattedDateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  // Real-time states
  const [dbState, setDbState] = useState({
    schoolName: '',
    schoolType: 'Okul',
    schoolLogo: '',
    classes: [],
    students: [],
    teachers: [],
    grades: [],
    attendance: [],
    homework: [],
    announcements: [],
    authorizedPersons: [],
    pickupRequests: [],
    gateLogs: [],
    chat: [],
    meals: { soup: '', main: '', side: '', dessert: '' },
    dailyLogs: {},
    lessons: []
  });

  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const prevPickupsRef = useRef([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);

  // Network offline listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll database every 2.5 seconds when active & online (saves mobile battery)
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchData();
      }
    };
    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [user]);

  const safeFetchJson = async (url, fallback) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return fallback;
      return await res.json();
    } catch (e) {
      return fallback;
    }
  };

  const fetchData = async () => {
    try {
      const [
        schoolNameRes,
        classesRes,
        studentsRes,
        teachersRes,
        gradesRes,
        attendanceRes,
        homeworkRes,
        announcementsRes,
        authorizedRes,
        pickupsRes,
        gatelogsRes,
        chatRes,
        mealsRes,
        dailyLogsRes,
        lessonsRes
      ] = await Promise.all([
        safeFetchJson(`${API_BASE}/school-name`, { name: 'Okul360', type: 'Okul', logoUrl: '' }),
        safeFetchJson(`${API_BASE}/classes`, []),
        safeFetchJson(`${API_BASE}/students`, []),
        safeFetchJson(`${API_BASE}/teachers`, []),
        safeFetchJson(`${API_BASE}/grades`, []),
        safeFetchJson(`${API_BASE}/attendance`, []),
        safeFetchJson(`${API_BASE}/homework`, []),
        safeFetchJson(`${API_BASE}/announcements`, []),
        safeFetchJson(`${API_BASE}/authorized`, []),
        safeFetchJson(`${API_BASE}/pickups`, []),
        safeFetchJson(`${API_BASE}/gatelogs`, []),
        safeFetchJson(`${API_BASE}/chat`, []),
        safeFetchJson(`${API_BASE}/meals`, { soup: '', main: '', side: '', dessert: '' }),
        safeFetchJson(`${API_BASE}/daily-logs`, {}),
        safeFetchJson(`${API_BASE}/lessons`, [])
      ]);

      const updatedState = {
        schoolName: schoolNameRes.name || 'Okul360',
        schoolType: schoolNameRes.type || 'Okul',
        schoolLogo: schoolNameRes.logoUrl || '',
        classes: classesRes,
        students: studentsRes,
        teachers: teachersRes,
        grades: gradesRes,
        attendance: attendanceRes,
        homework: homeworkRes,
        announcements: announcementsRes,
        authorizedPersons: authorizedRes,
        pickupRequests: pickupsRes,
        gateLogs: gatelogsRes,
        chat: chatRes,
        meals: mealsRes,
        dailyLogs: dailyLogsRes,
        lessons: lessonsRes
      };

      setDbState(updatedState);

      // Real-time audio/visual alert for staff roles
      if (user && user.role !== 'parent') {
        const currentRequested = pickupsRes.filter(r => r.status === 'REQUESTED');
        const newRequests = currentRequested.filter(req => !prevPickupsRef.current.some(prev => prev.id === req.id));
        if (newRequests.length > 0) {
          const newest = newRequests[newRequests.length - 1];
          const studObj = studentsRes.find(s => s.id === newest.studentId);
          setActiveNotification({
            id: newest.id,
            studentName: studObj ? studObj.name : 'Öğrenci',
            requesterName: newest.requesterName
          });
          playNotificationSound();

          // Auto dismiss banner after 7 seconds
          clearTimeout(window.__notifDismissTimeout);
          window.__notifDismissTimeout = setTimeout(() => {
            setActiveNotification(null);
          }, 7000);
        }
        prevPickupsRef.current = currentRequested;
      }
    } catch (e) {
      console.error('Error fetching data from API server', e);
    }
  };

  const showToast = (msg, isAlert = false) => {
    setToastMsg(msg);
    setToastAlert(isAlert);
    const toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.classList.add('show');
      clearTimeout(window.__toastTimeout);
      window.__toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
      }, 2500);
    }
  };

  const getActiveLessonInfo = (className) => {
    const classLessons = dbState.lessons.filter(l => l.className === className);
    if (classLessons.length === 0) {
      return { status: 'EMPTY', subject: 'Ders Programı Belirtilmemiş' };
    }

    const curTime = parseTime(simTime);
    const sorted = classLessons.slice().sort((a, b) => parseTime(a.start) - parseTime(b.start));

    for (let lesson of sorted) {
      const start = parseTime(lesson.start);
      const end = parseTime(lesson.end);
      if (curTime >= start && curTime < end) {
        const duration = end - start;
        const progress = curTime - start;
        const pct = Math.min(100, Math.max(0, Math.round((progress / duration) * 100)));
        return {
          status: lesson.subject.includes('Arası') || lesson.subject.includes('Yemek') ? 'LUNCH' : 'CLASS',
          subject: lesson.subject,
          teacher: lesson.teacher,
          start: lesson.start,
          end: lesson.end,
          pct: pct
        };
      }
    }

    const firstLesson = parseTime(sorted[0].start);
    if (curTime < firstLesson) {
      return { status: 'NOT_STARTED', subject: 'Eğitim Henüz Başlamadı', start: sorted[0].start };
    } else {
      return { status: 'ENDED', subject: 'Okul Dağıldı', end: sorted[sorted.length - 1].end };
    }
  };

  const logOut = () => {
    setUser(null);
    prevPickupsRef.current = [];
    setActiveNotification(null);
    showToast('Oturum kapatıldı.');
  };

  return (
    <div>
      <div className="topbar"></div>
      <header className="shell-header">
        <div className="brand-left">
          {dbState.schoolLogo ? (
            <img src={dbState.schoolLogo} alt="Logo" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', marginRight: '8px', border: '1px solid var(--border)' }} />
          ) : (
            <span className="flag">
              <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
                <rect width="30" height="20" fill="#E30A17"/>
                <circle cx="12" cy="10" r="5" fill="#fff"/>
                <circle cx="13.3" cy="10" r="4" fill="#E30A17"/>
                <path fill="#fff" d="M19.6 6.2l1.02 2.1 2.28.3-1.68 1.58.42 2.3-2.04-1.14-2.04 1.14.42-2.3-1.68-1.58 2.28-.3z"/>
              </svg>
            </span>
          )}
          <div>
            <span className="mark">{dbState.schoolName || 'Okul360'}</span>
            <span className="tag">{dbState.schoolType || 'Premium Takip'}</span>
          </div>
        </div>

        <div className="header-time-pill mono">
          <span>📅 </span><strong>{formattedDateStr} ({simDay})</strong>
          <span style={{ color: '#E2E8F0', padding: '0 4px' }}>|</span>
          <span>⏰ </span><strong>{now.toLocaleTimeString('tr-TR')}</strong>
        </div>
      </header>

      {/* Visual Notification Pop-up Banner for Staff */}
      {activeNotification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent)',
          color: '#fff',
          padding: '16px 24px',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(180, 83, 9, 0.45)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: '600',
          fontSize: '14px',
          borderTop: '2px solid var(--accent-light)',
          animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Yeni Öğrenci Çıkış Talebi!</div>
            <div style={{ fontSize: '12.5px', opacity: 0.9, marginTop: '2px' }}>
              <strong>{activeNotification.studentName}</strong> kapıya çağrılıyor ({activeNotification.requesterName} geldi).
            </div>
          </div>
          <button 
            onClick={() => setActiveNotification(null)}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#fff',
              fontWeight: '700',
              cursor: 'pointer',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              marginLeft: '12px'
            }}
          >
            ×
          </button>
        </div>
      )}

      <main className="app-container">
        {!user ? (
          <LoginScreen setUser={setUser} showToast={showToast} dbState={dbState} openPrivacyModal={() => setPrivacyModalOpen(true)} />
        ) : (
          <RoleRouter
            user={user}
            dbState={dbState}
            fetchData={fetchData}
            showToast={showToast}
            simTime={simTime}
            getActiveLessonInfo={getActiveLessonInfo}
            logOut={logOut}
            openPasswordModal={() => setPwdModalOpen(true)}
            openDeleteModal={() => setDeleteModalOpen(true)}
            openPrivacyModal={() => setPrivacyModalOpen(true)}
          />
        )}
      </main>

      <PasswordChangeModal 
        isOpen={pwdModalOpen} 
        onClose={() => setPwdModalOpen(false)} 
        userId={user?.userId} 
        showToast={showToast} 
      />

      <AccountDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        user={user}
        logOut={logOut}
        showToast={showToast}
      />

      <PrivacyPolicyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      {isOffline && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--error)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '99px',
          fontSize: '12.5px',
          fontWeight: '600',
          boxShadow: '0 10px 20px rgba(220, 38, 38, 0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📡</span> Çevrimdışı Mod (İnternet Bağlantınızı Kontrol Edin)
        </div>
      )}

      {/* Floating Role Switcher Drawer */}
      <button className="role-drawer-btn" onClick={() => setRoleDrawerOpen(!roleDrawerOpen)} title="Hızlı Rol Değiştirici">
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="white" strokeWidth="2" fill="none"/></svg>
      </button>

      <div className={`role-drawer ${roleDrawerOpen ? 'open' : ''}`}>
        <h2>Hızlı Rol Değiştirici</h2>
        <p style={{ fontSize: '11px', opacity: 0.7, lineHeight: 1.45, marginBottom: '20px' }}>
          Sistemi farklı rollerle anında test etmek için aşağıdaki seçenekleri kullanabilirsiniz.
        </p>

        <button className="role-opt" onClick={() => { setUser({ role: 'parent', parentPhone: '05349577969', studentId: 'st_alp', parentName: 'Engin Ekinci' }); setRoleDrawerOpen(false); }}>
          👨 Veli Girişi (Alp Ekinci)
        </button>
        <button className="role-opt" onClick={() => { setUser({ role: 'teacher', teacherId: 't_ahmet', name: 'Dr. Ahmet Yılmaz', subject: 'Matematik' }); setRoleDrawerOpen(false); }}>
          🧑‍🏫 Öğretmen (Dr. Ahmet Yılmaz)
        </button>
        <button className="role-opt" onClick={() => { setUser({ role: 'security', name: 'Kapı Güvenlik' }); setRoleDrawerOpen(false); }}>
          👮 Güvenlik (Ana Kapı)
        </button>
        <button className="role-opt" onClick={() => { setUser({ role: 'admin', name: 'Okul Yöneticisi' }); setRoleDrawerOpen(false); }}>
          🏛️ Yönetim Konsolu (Admin)
        </button>
      </div>

      <div className="toast" id="toast">
        <span style={{ fontSize: '16px' }}>{toastAlert ? '⚠️' : '✨'}</span>
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}

/* =========================================================
   ROLE ROUTER
========================================================= */
function RoleRouter({ user, dbState, fetchData, showToast, simTime, getActiveLessonInfo, logOut, openPasswordModal, openDeleteModal, openPrivacyModal }) {
  if (user.role === 'parent') {
    return (
      <div className="phone-container-wrapper">
        <div className="phone-bezel">
          <ParentApp
            user={user}
            dbState={dbState}
            fetchData={fetchData}
            showToast={showToast}
            simTime={simTime}
            getActiveLessonInfo={getActiveLessonInfo}
            logOut={logOut}
            openDeleteModal={openDeleteModal}
            openPrivacyModal={openPrivacyModal}
          />
        </div>
      </div>
    );
  }
  if (user.role === 'teacher') {
    return (
      <div className="phone-container-wrapper">
        <div className="phone-bezel">
          <TeacherApp
            user={user}
            dbState={dbState}
            fetchData={fetchData}
            showToast={showToast}
            logOut={logOut}
            openPasswordModal={openPasswordModal}
            openDeleteModal={openDeleteModal}
            openPrivacyModal={openPrivacyModal}
          />
        </div>
      </div>
    );
  }
  if (user.role === 'security') {
    return (
      <div className="phone-container-wrapper">
        <div className="phone-bezel">
          <SecurityApp
            user={user}
            dbState={dbState}
            fetchData={fetchData}
            showToast={showToast}
            simTime={simTime}
            logOut={logOut}
            openPasswordModal={openPasswordModal}
            openDeleteModal={openDeleteModal}
            openPrivacyModal={openPrivacyModal}
          />
        </div>
      </div>
    );
  }
  if (user.role === 'admin') {
    return (
      <AdminConsole
        user={user}
        dbState={dbState}
        fetchData={fetchData}
        showToast={showToast}
        simTime={simTime}
        logOut={logOut}
        openPasswordModal={openPasswordModal}
        openDeleteModal={openDeleteModal}
        openPrivacyModal={openPrivacyModal}
      />
    );
  }
  return null;
}

/* =========================================================
   LOGIN SCREEN COMPONENT
========================================================= */
function LoginScreen({ setUser, showToast, dbState, openPrivacyModal }) {
  const [activeTab, setActiveTab] = useState('parent'); // parent, staff, register
  const [phone, setPhone] = useState(''); // User phone
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [staffRole, setStaffRole] = useState('admin'); // teacher, security, admin

  // Institution Registration Form States
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('Okul');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const payload = activeTab === 'parent'
        ? { role: 'parent', phone }
        : { role: staffRole, username, password };

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (data.schoolId) {
          localStorage.setItem('okul360_schoolId', data.schoolId);
        }
        setUser(data);
        showToast(`Giriş Başarılı! Rol: ${data.role.toUpperCase()}`);
      } else {
        showToast(data.message || 'Hatalı bilgiler girdiniz!', true);
      }
    } catch (err) {
      showToast('API sunucusuna bağlanılamadı. Lütfen sunucunun açık olduğundan emin olun.', true);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/schools/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schoolName,
          type: schoolType,
          logoUrl,
          adminUsername,
          adminPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('okul360_schoolId', data.schoolId);
        showToast('Kurum ve yönetici kaydı başarıyla oluşturuldu!');
        setUser({
          success: true,
          role: 'admin',
          userId: data.userId,
          name: schoolName + ' Yöneticisi',
          schoolId: data.schoolId
        });
      } else {
        showToast(data.message || 'Kurum kaydı başarısız!', true);
      }
    } catch (err) {
      showToast('Kayıt sırasında bağlantı hatası oluştu!', true);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setLogoUploading(true);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setLogoUrl(data.fileUrl);
        showToast('Logo yüklendi.');
      } else {
        showToast('Yükleme başarısız!', true);
      }
    } catch (err) {
      showToast('Logo yüklenirken hata oluştu!', true);
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="phone-container-wrapper">
      <div className="phone-bezel">
        <div className="phone">
          <div className="phone-notch"></div>
          <div className="phone-status">
            <span className="mono">09:41</span>
            <span>LTE 🔋</span>
          </div>
          <div className="phone-body" style={{ justifyContent: 'center' }}>
            <div className="login-screen" style={{ maxHeight: '90%', overflowY: 'auto', padding: '10px 15px' }}>
              <h2 className="display" style={{ fontSize: '24px', color: 'var(--primary)', margin: '0 0 4px', textAlign: 'center' }}>Okul360 Portal</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>Premium Takip Sistemi</p>

              <div className="login-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                <button className={`login-tab ${activeTab === 'parent' ? 'active' : ''}`} onClick={() => setActiveTab('parent')} style={{ flex: 1, padding: '6px 4px', fontSize: '11px' }}>Veli Girişi</button>
                <button className={`login-tab ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')} style={{ flex: 1, padding: '6px 4px', fontSize: '11px' }}>Personel</button>
                <button className={`login-tab ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')} style={{ flex: 1, padding: '6px 4px', fontSize: '11px' }}>Yeni Kurum</button>
              </div>

              {activeTab === 'register' ? (
                <form onSubmit={handleRegister} className="card" style={{ padding: '12px', margin: 0 }}>
                  <div className="field">
                    <label>Kurum Türü</label>
                    <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} required>
                      <option value="Okul">Okul</option>
                      <option value="Dershane">Dershane</option>
                      <option value="Anaokulu">Anaokulu</option>
                      <option value="Sübyan Mektebi">Sübyan Mektebi</option>
                      <option value="Değerler Okulu">Değerler Okulu</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginTop: '8px' }}>
                    <label>Kurum Adı</label>
                    <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Örn: Yıldız Koleji" required />
                  </div>
                  <div className="field" style={{ marginTop: '8px' }}>
                    <label>Kurum Logosu</label>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} />
                    {logoUploading && <div style={{ fontSize: '10px', color: 'var(--accent)' }}>Logo yükleniyor...</div>}
                    {logoUrl && <div style={{ fontSize: '10px', color: 'var(--success)' }}>✓ Logo Yüklendi</div>}
                  </div>
                  <div className="field" style={{ marginTop: '8px' }}>
                    <label>Yönetici Kullanıcı Adı</label>
                    <input type="text" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Örn: admin_okul" required />
                  </div>
                  <div className="field" style={{ marginTop: '8px' }}>
                    <label>Yönetici Şifresi</label>
                    <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••" required />
                  </div>
                  <button type="submit" className="btn btn-accent" style={{ marginTop: '12px', width: '100%' }} disabled={logoUploading}>Kurumu Oluştur & Giriş Yap</button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="card" style={{ padding: '12px', margin: 0 }}>
                  {activeTab === 'parent' ? (
                    <div className="field">
                      <label>Kayıtlı Veli Telefonu</label>
                      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" required />
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label>Kullanıcı Rolü</label>
                        <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
                          <option value="admin">🏛️ Yönetim / Admin</option>
                          <option value="teacher">🧑‍🏫 Öğretmen</option>
                          <option value="security">👮 Güvenlik</option>
                        </select>
                      </div>
                      <div className="field" style={{ marginTop: '8px' }}>
                        <label>Kullanıcı Adı</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                      </div>
                      <div className="field" style={{ marginTop: '8px' }}>
                        <label>Şifre</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                    </>
                  )}
                  <button type="submit" className="btn btn-accent" style={{ marginTop: '12px', width: '100%' }}>Bağlan</button>
                </form>
              )}
              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={openPrivacyModal}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  🔒 Gizlilik Politikası ve Kullanım Koşulları
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   VELİ UYGULAMASI (PARENT APP)
========================================================= */
function ParentApp({ user, dbState, fetchData, showToast, simTime, getActiveLessonInfo, logOut, openDeleteModal, openPrivacyModal }) {
  const [activeTab, setActiveTab] = useState('home');
  const [chatMsg, setChatMsg] = useState('');
  const [typing, setTyping] = useState(false);
  const [pickupRequester, setPickupRequester] = useState('parent');
  const [pickupPlate, setPickupPlate] = useState('');
  const [trackingMode, setTrackingMode] = useState('gps'); // 'gps' (live GPS) or 'simulation' (fallback)

  // Advanced Modules States
  const [valuesProgress, setValuesProgress] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [finance, setFinance] = useState({ totalAmount: 0, paidAmount: 0, installments: 1, dueDate: '' });
  const [surveys, setSurveys] = useState([]);
  const [consents, setConsents] = useState([]);

  // States for adding a medicine request
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedTime, setNewMedTime] = useState('12:00');
  const [newMedNotes, setNewMedNotes] = useState('');

  const loadParentExtraData = async () => {
    try {
      const resVal = await fetch(`${API_BASE}/values/${student.id}`);
      const dataVal = await resVal.json();
      setValuesProgress(dataVal);

      const resMed = await fetch(`${API_BASE}/medicines`);
      const dataMed = await resMed.json();
      setMedicines(dataMed.filter(m => m.studentId === student.id));

      const resFin = await fetch(`${API_BASE}/finance/${student.id}`);
      const dataFin = await resFin.json();
      setFinance(dataFin);

      const resSurv = await fetch(`${API_BASE}/surveys`);
      const dataSurv = await resSurv.json();
      setSurveys(dataSurv);

      const resCons = await fetch(`${API_BASE}/consents/${student.id}`);
      const dataCons = await resCons.json();
      setConsents(dataCons);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMedName || !newMedDose) return;
    try {
      await fetch(`${API_BASE}/medicines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          medicineName: newMedName,
          dosage: newMedDose,
          scheduledTime: newMedTime,
          notes: newMedNotes
        })
      });
      setNewMedName('');
      setNewMedDose('');
      setNewMedTime('12:00');
      setNewMedNotes('');
      loadParentExtraData();
      showToast('İlaç talebi iletildi.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleVote = async (surveyId, option) => {
    try {
      await fetch(`${API_BASE}/surveys/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId, option })
      });
      loadParentExtraData();
      showToast('Oyunuz başarıyla kaydedildi.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleConsentResponse = async (consentId, status) => {
    const parentNamePrompt = prompt("Lütfen muvafakatnameyi imzalamak için Adınızı Soyadınızı girin:");
    if (!parentNamePrompt) return;
    try {
      await fetch(`${API_BASE}/consents/${consentId}/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, signedBy: parentNamePrompt })
      });
      loadParentExtraData();
      showToast(status === 'APPROVED' ? 'İzin onaylandı.' : 'İzin reddedildi.');
    } catch (err) {
      console.error(err);
    }
  };

  const chatContainerRef = useRef(null);

  const student = dbState.students.find(s => s.id === user.studentId) || { name: 'Öğrenci', className: '' };
  
  // Real-time variables calculated from state
  const logs = dbState.dailyLogs[student.id] || { mealStatus: 'Belirtilmedi', mood: 'Girilmedi', notes: 'Öğretmen notu bulunmamaktadır.' };
  
  const gateLogs = dbState.gateLogs.filter(l => l.studentId === student.id);
  const gateStatus = gateLogs.length === 0 ? 'Giriş Yapmadı' : gateLogs[gateLogs.length - 1].type === 'GİRİŞ' ? 'Okulda' : 'Çıkış Yaptı';
  
  const lessonInfo = getActiveLessonInfo(student.className);
  
  const grades = dbState.grades.filter(g => g.studentId === student.id).sort((a,b) => b.date.localeCompare(a.date));
  const homework = dbState.homework.filter(h => h.className === student.className);
  const announcements = dbState.announcements.filter(a => !a.className || a.className === student.className).sort((a,b) => b.date.localeCompare(a.date));
  
  const authorized = dbState.authorizedPersons.filter(a => a.studentId === student.id);
  const activePickup = dbState.pickupRequests.find(p => p.studentId === student.id && p.status !== 'DELIVERED' && p.status !== 'CANCELLED');

  const messages = dbState.chat.filter(m => m.from === 'st_alp_parent' || m.to === 'st_alp_parent');

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const activePickupRef = useRef(activePickup);
  useEffect(() => {
    activePickupRef.current = activePickup;
  }, [activePickup]);

  // Live GPS tracking or Route Simulation
  useEffect(() => {
    const activePickupId = activePickup?.id;
    if (!activePickupId) return;

    const updateLocationOnServer = async (lat, lng) => {
      try {
        await fetch(`${API_BASE}/pickups/${activePickupId}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng })
        });
      } catch (e) {
        console.error('Error updating location', e);
      }
    };

    if (trackingMode === 'gps') {
      let watchId = null;
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            updateLocationOnServer(pos.coords.latitude, pos.coords.longitude);
            fetchData();
          },
          (err) => {
            console.error('GPS tracking error:', err);
            showToast('GPS konumunuz alınamadı. Simülasyon moduna dönülüyor.', true);
            setTrackingMode('simulation');
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
          }
        );
      } else {
        showToast('Cihazınızda GPS desteği bulunmuyor.', true);
        setTrackingMode('simulation');
      }

      return () => {
        if (watchId !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    } else {
      const interval = setInterval(() => {
        const currentPickup = activePickupRef.current;
        if (!currentPickup) return;

        const schoolLat = 41.0583;
        const schoolLng = 28.6942;
        const currentLat = currentPickup.latitude || 41.0525;
        const currentLng = currentPickup.longitude || 28.6895;

        const dist = getDistance(currentLat, currentLng, schoolLat, schoolLng);
        if (dist < 15) {
          clearInterval(interval);
          return;
        }

        const nextLat = currentLat + (schoolLat - currentLat) * 0.12;
        const nextLng = currentLng + (schoolLng - currentLng) * 0.12;

        updateLocationOnServer(nextLat, nextLng);
        fetchData();
      }, 3500);

      return () => clearInterval(interval);
    }
  }, [activePickup?.id, trackingMode]);

  useEffect(() => {
    if (student.id) {
      loadParentExtraData();
    }
  }, [student.id, dbState]);

  const sendChatMessage = async () => {
    if (!chatMsg.trim()) return;
    const msgObj = {
      from: 'st_alp_parent',
      to: 't_ahmet',
      message: chatMsg.trim(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString().slice(0,10)
    };

    try {
      await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgObj)
      });
      setChatMsg('');
      fetchData();
      
      // Auto reply trigger
      setTyping(true);
      setTimeout(async () => {
        setTyping(false);
        let reply = "Sorunuzu aldım velim. İlgilenip en kısa sürede dönüş yapacağım.";
        const cleanMsg = msgObj.message.toLowerCase();
        if (cleanMsg.includes('not') || cleanMsg.includes('sınav') || cleanMsg.includes('puan')) {
          reply = "Alp son denemesinde oldukça başarılıydı. Özellikle matematik sorularında odaklanması gayet iyiydi.";
        } else if (cleanMsg.includes('ödev') || cleanMsg.includes('çözdü')) {
          reply = "Alp ödevlerini düzenli yapıyor. Ancak problem çözümlerinde işlem adımlarını atlamaması gerekiyor.";
        } else if (cleanMsg.includes('merhaba') || cleanMsg.includes('selam')) {
          reply = "Merhabalar Engin Bey. İyi günler dilerim. Alp ile ilgili sorularınızı buradan iletebilirsiniz.";
        }

        const replyObj = {
          from: 't_ahmet',
          to: 'st_alp_parent',
          message: reply,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toISOString().slice(0,10)
        };
        await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replyObj)
        });
        fetchData();
        showToast('Ahmet Öğretmen yeni bir mesaj yolladı.');
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePickup = async () => {
    let requesterName = student.parentName;
    let code = '';
    
    if (pickupRequester !== 'parent') {
      const auth = dbState.authorizedPersons.find(a => a.id === pickupRequester);
      if (auth) {
        requesterName = auth.name;
        code = auth.code;
      }
    } else {
      code = String(Math.floor(100000 + Math.random() * 900000));
    }

    const startLat = 41.0525;
    const startLng = 28.6895;

    const executePost = async (lat, lng) => {
      try {
        await fetch(`${API_BASE}/pickups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            requesterName,
            vehiclePlate: pickupPlate,
            code,
            latitude: lat,
            longitude: lng
          })
        });
        fetchData();
        showToast('Çağrı başlatıldı! Canlı konumunuz haritada aktarılıyor.');
      } catch (e) {
        console.error(e);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executePost(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          executePost(startLat, startLng);
        },
        { timeout: 3000 }
      );
    } else {
      executePost(startLat, startLng);
    }
  };

  const handleCancelPickup = async (pkId) => {
    try {
      await fetch(`${API_BASE}/pickups/${pkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      fetchData();
      showToast('Çağrı iptal edildi.', true);
    } catch (e) {
      console.error(e);
    }
  };

  const addAuthorizedPerson = async () => {
    const name = prompt("Yetkilinin Adı Soyadı:");
    if (!name) return;
    const relation = prompt("Yakınlık Derecesi (Amca, Teyze, Dayı, Bakıcı...):");
    if (!relation) return;
    const phone = prompt("Telefon Numarası:");
    if (!phone) return;

    try {
      await fetch(`${API_BASE}/authorized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, name, relation, phone })
      });
      fetchData();
      showToast('Yeni yetkili başarıyla eklendi.');
    } catch (e) {
      console.error(e);
    }
  };

  // SVG Chart builder
  const mathGrades = grades.filter(g => g.subject === 'Matematik').reverse();
  let svgChart = <div className="empty">Yetersiz sınav verisi</div>;
  if (mathGrades.length >= 2) {
    const w = 320;
    const h = 130;
    const pad = 20;
    const coords = mathGrades.map((g, i) => {
      const x = pad + (i / (mathGrades.length - 1)) * (w - pad * 2);
      const y = h - pad - ((g.score - 50) / 50) * (h - pad * 2);
      return { x, y, score: g.score, name: g.examName };
    });
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const fillPath = `${linePath} L ${coords[coords.length-1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`;
    
    svgChart = (
      <div className="graph-container">
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="parentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0"/>
            </linearGradient>
          </defs>
          <line x1={pad} y1={pad} x2={w-pad} y2={pad} stroke="var(--border)" strokeDasharray="3"/>
          <line x1={pad} y1={h/2} x2={w-pad} y2={h/2} stroke="var(--border)" strokeDasharray="3"/>
          <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="var(--primary)" strokeWidth="1"/>
          
          <path d={fillPath} fill="url(#parentGrad)"/>
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3"/>
          
          <line x1={pad} y1={h - pad - ((86 - 50) / 50) * (h - pad * 2)} x2={w-pad} y2={h - pad - ((86 - 50) / 50) * (h - pad * 2)} stroke="var(--text-muted)" strokeDasharray="3 3"/>
          <text x={w - pad} y={h - pad - ((86 - 50) / 50) * (h - pad * 2) - 4} fontSize="8" fill="var(--text-muted)" textAnchor="end">Ortalama: 86</text>

          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="5" fill="#fff" stroke="var(--accent)" strokeWidth="3" style={{ cursor: 'pointer' }} onClick={() => showToast(`${c.name}: ${c.score} Puan`)}/>
              <text x={c.x} y={c.y - 10} fontSize="9" fontWeight="700" textAnchor="middle">{c.score}</text>
              <text x={c.x} y={h - pad + 12} fontSize="8" fill="var(--text-muted)" textAnchor="middle">{c.name.split(' ')[0]}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="phone">
      <div className="phone-notch"></div>
      <div className="phone-status">
        <span className="mono">{simTime}</span>
        <span>LTE 🔋</span>
      </div>

      <div className="phone-top-hero">
        <span className="role-badge">Velisi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
          {student.photoUrl ? (
            <img src={student.photoUrl} alt={student.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.6)' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid rgba(255,255,255,0.6)' }}>👤</div>
          )}
          <div>
            <div className="title" style={{ margin: 0, fontSize: '18px', color: '#fff', textAlign: 'left' }}>{student.name} {student.surname || ''}</div>
            <div className="subtitle" style={{ margin: 0, fontSize: '11px', opacity: 0.9, textAlign: 'left' }}>{student.className} Öğrencisi</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '4px' }}>
          <button onClick={logOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>ÇIKIŞ</button>
          <button onClick={openPrivacyModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>GİZLİLİK</button>
          <button onClick={openDeleteModal} style={{ background: 'rgba(220,38,38,0.4)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>HESABIMI SİL</button>
        </div>
      </div>

      <div className="phone-body">
        {activeTab === 'home' && (
          <>
            {/* Gate tracking card */}
            <div className="card premium-glow">
              <h3>
                <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Güvenlik Turnike Durumu
              </h3>
              <div className="row">
                <span>Okul Durumu</span>
                <span className={`pill ${gateStatus === 'Okulda' ? 'green' : gateStatus === 'Çıkış Yaptı' ? 'red' : 'brass'}`}>{gateStatus}</span>
              </div>
              {gateLogs.length > 0 && (
                <div className="row">
                  <span>Geçiş Saati</span>
                  <span className="val mono">{gateLogs[gateLogs.length - 1].time}</span>
                </div>
              )}
            </div>

            {/* Lesson Tracker */}
            <div className="card">
              <h3>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Canlı Ders İzleme
              </h3>
              {lessonInfo.status === 'CLASS' ? (
                <>
                  <div className="row">
                    <span>Aktif Ders</span>
                    <span className="val">{lessonInfo.subject}</span>
                  </div>
                  <div className="row">
                    <span>Eğitmen</span>
                    <span className="val">{lessonInfo.teacher}</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Zamanlama ({lessonInfo.start} - {lessonInfo.end})</span>
                      <span>%{lessonInfo.pct}</span>
                    </div>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${lessonInfo.pct}%` }}></div>
                    </div>
                  </div>
                </>
              ) : lessonInfo.status === 'LUNCH' ? (
                <div className="empty" style={{ padding: '16px' }}>🍱 Yemek ve Dinlenme Arası</div>
              ) : lessonInfo.status === 'ENDED' ? (
                <div className="empty" style={{ padding: '16px' }}>🏫 Dersler Sona Erdi. Okul Dağıldı.</div>
              ) : lessonInfo.status === 'EMPTY' ? (
                <div className="empty" style={{ padding: '16px' }}>📭 Bu sınıf için ders programı eklenmemiş.</div>
              ) : (
                <div className="empty" style={{ padding: '16px' }}>🌅 Okul Başlama Saati: {lessonInfo.start}</div>
              )}
            </div>

            {/* Wellness logs */}
            <div className="card">
              <h3>
                <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Öğrenci Günlük Raporu
              </h3>
              <div className="row">
                <span>Ruh Hali</span>
                <span className="val" style={{ color: 'var(--accent)', fontWeight: 700 }}>😊 {logs.mood}</span>
              </div>
              <div className="row">
                <span>Yemek Seviyesi</span>
                <span className="val">{logs.mealStatus} yedi</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '10px', borderRadius: '10px', marginTop: '8px', lineHeight: '1.4' }}>
                <strong>Öğretmen Notu:</strong> {logs.notes}
              </div>
            </div>
          </>
        )}

        {activeTab === 'academic' && (
          <>
            <div className="card">
              <h3>Not Analizi</h3>
              {svgChart}
              <div style={{ marginTop: '15px' }}>
                {grades.length === 0 ? emptyBlock('Kayıt bulunamadı.') : grades.map((g, i) => (
                  <div className="row" key={i}>
                    <div>
                      <strong>{g.subject}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{g.examName}</div>
                    </div>
                    <strong style={{ fontSize: '15px', color: 'var(--accent)' }}>{g.score} Puan</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Ev Ödevleri</h3>
              {homework.length === 0 ? emptyBlock('Ödev kaydı yok.') : homework.map((h, i) => (
                <div className="row" key={i} style={{ display: 'block', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--primary)' }}>{h.subject} - {h.title}</strong>
                    <span className="pill brass" style={{ fontSize: '9px' }}>Son: {h.dueDate}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{h.description}</div>
                  
                  {h.mediaUrl && (
                    <div style={{ marginTop: '10px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                      {h.mediaType === 'video' ? (
                        <video src={h.mediaUrl} controls style={{ width: '100%', display: 'block' }} />
                      ) : (
                        <img src={h.mediaUrl} alt="Ödev Medyası" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '180px' }} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Duyurular</h3>
              {announcements.length === 0 ? emptyBlock('Duyuru yok.') : announcements.map((a, i) => (
                <div className="row" key={i} style={{ display: 'block', padding: '12px 0' }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>📢 {a.title}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '4px' }}>{a.message}</div>
                  
                  {a.mediaUrl && (
                    <div style={{ marginTop: '10px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                      {a.mediaType === 'video' ? (
                        <video src={a.mediaUrl} controls style={{ width: '100%', display: 'block' }} />
                      ) : (
                        <img src={a.mediaUrl} alt="Duyuru Medyası" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '180px' }} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="chat-header">
              <div className="status-dot"></div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Dr. Ahmet Yılmaz (Matematik)</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Danışman Sınıf Öğretmeni</div>
              </div>
            </div>
            <div className="chat-messages" ref={chatContainerRef}>
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.from === 'st_alp_parent' ? 'sent' : 'received'}`}>
                  {m.message}
                  <span className="time">{m.time}</span>
                </div>
              ))}
              {typing && <div className="chat-typing">Ahmet Öğretmen yazıyor...</div>}
            </div>
            <div className="chat-input-area">
              <input type="text" placeholder="Mesajınızı yazın..." value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} />
              <button onClick={sendChatMessage}>
                <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" fill="none" strokeWidth="2"/></svg>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pickup' && (
          <>
            {/* Informational Warning message */}
            <div style={{
              background: 'var(--accent-light)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-dark)',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '12px',
              lineHeight: '1.5',
              fontWeight: '600',
              textAlign: 'left',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '16px' }}>ℹ️</span>
              <span>Öğrencinizi çağırmak istediğiniz zaman ortalama 10 dk içerisinde öğrencimiz hazır olmaktadır. Okulumuza ulaşma sürenizi dikkate alarak öğrencimizi çağırmanızı rica ederiz.</span>
            </div>

            {activePickup ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div className="pass">
                  <div className="stub-title">
                    <span>Güvenli Geçiş Kartı</span>
                    <span style={{ color: 'var(--accent-light)' }}>#{activePickup.id.split('_')[1].toUpperCase()}</span>
                  </div>
                  <div className="stub-sub">{student.name} · {activePickup.requesterName}</div>
                  <div className="steps">
                    {['REQUESTED', 'PREPARING', 'READY', 'DELIVERED'].map((st, i) => {
                      const idx = ['REQUESTED', 'PREPARING', 'READY', 'DELIVERED'].indexOf(activePickup.status);
                      return (
                        <div key={i} className={`step ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>
                          <div className="dot">{i < idx ? '✓' : i + 1}</div>
                          <div className="lbl">{['Talep', 'Hazırla', 'Kapıda', 'Teslim'][i]}</div>
                        </div>
                      );
                    })}
                  </div>
                  {activePickup.code && (
                    <div className="code-box">
                      <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>Güvenlik Kodunuz</div>
                      <div className="code">{activePickup.code}</div>
                    </div>
                  )}
                </div>
                
                <div className="card">
                  <div className="row"><span>Araç Plakası</span><span className="val">{activePickup.vehiclePlate || 'Bilinmiyor'}</span></div>
                  <div className="row"><span>Çağrı Saati</span><span className="val">{activePickup.createdAt.slice(11,16)}</span></div>
                  
                  {/* Mode switcher and status (Lossless Dynamic Layout) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-2)',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    margin: '10px 0 6px',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}>
                    <span style={{ color: trackingMode === 'gps' ? 'var(--success)' : 'var(--accent)' }}>
                      {trackingMode === 'gps' ? '🛰️ Gerçek Canlı GPS Aktif' : '🚗 Demo Simülasyonu Aktif'}
                    </span>
                    <button 
                      onClick={() => setTrackingMode(trackingMode === 'gps' ? 'simulation' : 'gps')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        background: 'var(--primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '700'
                      }}
                    >
                      {trackingMode === 'gps' ? 'Simülasyona Geç' : 'Gerçek GPS\'e Geç'}
                    </button>
                  </div>

                  {trackingMode === 'gps' && (
                    <div style={{
                      fontSize: '10px',
                      color: '#B45309',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      margin: '2px 0 8px',
                      lineHeight: '1.4'
                    }}>
                      ⚠️ <b>Tarayıcı Güvenlik Kısıtlaması:</b> Telefon tarayıcıları güvenlik politikası gereği, gerçek GPS verisine <u>yalnızca secure (HTTPS) bağlantılarda</u> izin verir. Yerel IP (`http://...`) üzerinden bağlandığınız için tarayıcınız bu erişimi engellemiştir. Gerçekçi bir harita testi yapmak için sağdaki butondan <b>"Simülasyon Modu"</b>na geri dönebilirsiniz.
                    </div>
                  )}

                  {/* Live Distance display */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Okula Kalan Mesafe: <strong>{getDistance(activePickup.latitude, activePickup.longitude, 41.0583, 28.6942)} metre</strong></span>
                    <span>Tahmini Süre: <strong>{Math.ceil(getDistance(activePickup.latitude, activePickup.longitude, 41.0583, 28.6942) / 80)} dk</strong></span>
                  </div>
                  
                  {/* Interactive Leaflet Map for Parent */}
                  <PickupMap pickup={activePickup} />
                </div>
                
                <button className="btn btn-outline" onClick={() => handleCancelPickup(activePickup.id)}>İptal Et</button>
              </div>
            ) : (
              <div className="card premium-glow" style={{ marginTop: '12px' }}>
                <h3>Çocuk Teslim Alma Talebi</h3>
                <div className="field">
                  <label>Öğrenciyi Kim Alacak?</label>
                  <select value={pickupRequester} onChange={(e) => setPickupRequester(e.target.value)}>
                    <option value="parent">{student.parentName} (Veli / Kendisi)</option>
                    {authorized.map((a, i) => <option key={i} value={a.id}>{a.name} ({a.relation})</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Araç Plakası</label>
                  <input type="text" value={pickupPlate} onChange={(e) => setPickupPlate(e.target.value)} placeholder="34 PRSTG 360" className="mono" />
                </div>
                <button className="btn btn-accent" onClick={handleCreatePickup}>🚗 Geldim, Öğrenciyi Çağır</button>
              </div>
            )}

            <div className="card" style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Yetkili Akrabalar</h3>
                <button className="btn btn-outline btn-sm" onClick={addAuthorizedPerson}>+ Ekle</button>
              </div>
              {authorized.length === 0 ? emptyBlock('Kayıt yok.') : authorized.map((a, i) => (
                <div className="row" key={i}>
                  <div>
                    <strong>{a.name}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.relation}</div>
                  </div>
                  <span className="mono pill brass">Kod: {a.code}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'extra' && (
          <>
            {/* 1. Aidat & Finans */}
            <div className="card">
              <h3>💵 Ödeme ve Taksit Durumu</h3>
              {finance.totalAmount > 0 ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px' }}>Toplam Tutar: <strong>{finance.totalAmount.toLocaleString('tr-TR')} TL</strong></div>
                    <div style={{ fontSize: '12px', textAlign: 'right' }}>Ödenen: <strong>{finance.paidAmount.toLocaleString('tr-TR')} TL</strong></div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="progress-container" style={{ margin: '8px 0' }}>
                    <div className="progress-bar" style={{ width: `${Math.min(100, (finance.paidAmount / finance.totalAmount) * 100)}%`, background: 'var(--success)' }}></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Kalan Borç: <strong>{(finance.totalAmount - finance.paidAmount).toLocaleString('tr-TR')} TL</strong></span>
                    <span style={{ textAlign: 'right' }}>Sıradaki Vade: <strong>{finance.dueDate || 'Belirtilmedi'}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="empty" style={{ padding: '12px' }}>Kayıtlı finansal bilgi bulunmuyor.</div>
              )}
            </div>

            {/* 2. Değerler Eğitimi */}
            <div className="card">
              <h3>🏆 Değerler ve Ahlak Gelişimi</h3>
              {valuesProgress.length === 0 ? (
                <div className="empty" style={{ padding: '12px' }}>Henüz girilmiş ahlaki gelişim rozeti bulunmuyor.</div>
              ) : (
                valuesProgress.map((v, i) => (
                  <div key={i} style={{ borderBottom: i < valuesProgress.length - 1 ? '1px dashed var(--border)' : 'none', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{v.category}</strong>
                      {v.badgeName && <span className="pill brass" style={{ fontSize: '10px' }}>🏅 {v.badgeName}</span>}
                    </div>
                    
                    <div className="progress-container" style={{ margin: '6px 0' }}>
                      <div className="progress-bar" style={{ width: `${v.progress}%`, background: 'var(--accent)' }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>İlerleme Seviyesi: %{v.progress}</span>
                      {v.notes && <span>Not: {v.notes}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 3. Sağlık & İlaç */}
            <div className="card">
              <h3>💊 Günlük İlaç Takvimi</h3>
              
              {/* Add Medicine Request Form */}
              <form onSubmit={handleAddMedicine} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '15px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Yeni İlaç Verilme Talebi Oluştur:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="field">
                    <label>İlaç Adı *</label>
                    <input type="text" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} placeholder="Örn: Calpol" required />
                  </div>
                  <div className="field">
                    <label>Dozaj *</label>
                    <input type="text" value={newMedDose} onChange={(e) => setNewMedDose(e.target.value)} placeholder="Örn: 1 Ölçek" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  <div className="field">
                    <label>Verilme Saati *</label>
                    <input type="time" value={newMedTime} onChange={(e) => setNewMedTime(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Veli Notu</label>
                    <input type="text" value={newMedNotes} onChange={(e) => setNewMedNotes(e.target.value)} placeholder="Tok karnına verilecek vb." />
                  </div>
                </div>
                <button type="submit" className="btn btn-accent btn-sm" style={{ marginTop: '10px', width: '100%' }}>Talebi Gönder</button>
              </form>

              {/* Medicine List */}
              {medicines.length === 0 ? (
                <div className="empty" style={{ padding: '12px' }}>Bugün için tanımlanmış ilaç bulunmuyor.</div>
              ) : (
                medicines.map((m, i) => (
                  <div className="row" key={i} style={{ padding: '8px 0', borderBottom: i < medicines.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                    <div>
                      <strong>{m.medicineName} ({m.dosage})</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hedef Saat: {m.scheduledTime} | {m.notes || 'Not yok'}</div>
                    </div>
                    <div>
                      {m.status === 'GIVEN' ? (
                        <span className="pill green" style={{ fontSize: '10px' }}>✓ Verildi ({m.givenAt})</span>
                      ) : (
                        <span className="pill red" style={{ fontSize: '10px' }}>⌛ Bekliyor</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 4. Muvafakatnameler & Anketler */}
            <div className="card">
              <h3>📋 İzin Belgeleri & Muvafakatnameler</h3>
              {consents.length === 0 ? (
                <div className="empty" style={{ padding: '12px' }}>Bekleyen izin talebi bulunmuyor.</div>
              ) : (
                consents.map((c, i) => (
                  <div key={i} style={{ borderBottom: i < consents.length - 1 ? '1px dashed var(--border)' : 'none', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px' }}>{c.title}</strong>
                      <span className={`pill ${c.status === 'APPROVED' ? 'green' : c.status === 'REJECTED' ? 'red' : 'brass'}`}>
                        {c.status === 'APPROVED' ? 'Onaylandı' : c.status === 'REJECTED' ? 'Reddedildi' : 'Onay Bekliyor'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '6px 0 10px', lineHeight: 1.4 }}>{c.description}</p>
                    
                    {c.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={() => handleConsentResponse(c.id, 'APPROVED')}>Evet, Onaylıyorum</button>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleConsentResponse(c.id, 'REJECTED')}>Hayır, Onaylamıyorum</button>
                      </div>
                    )}
                    {c.status === 'APPROVED' && (
                      <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 'bold' }}>✓ Velisi {c.signedBy} tarafından dijital olarak imzalandı.</div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h3>📊 Güncel Anketler</h3>
              {surveys.length === 0 ? (
                <div className="empty" style={{ padding: '12px' }}>Aktif bir anket bulunmuyor.</div>
              ) : (
                surveys.map((s, i) => {
                  const opts = JSON.parse(s.options);
                  const res = JSON.parse(s.results);
                  const totalVotes = Object.values(res).reduce((a,b) => a + b, 0);
                  
                  return (
                    <div key={i} style={{ borderBottom: i < surveys.length - 1 ? '1px dashed var(--border)' : 'none', padding: '10px 0' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>{s.title}</strong>
                      <div style={{ fontSize: '12px', marginBottom: '8px' }}>{s.question}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {opts.map((opt, idx) => {
                          const votes = res[opt] || 0;
                          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleVote(s.id, opt)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontWeight: '600'
                              }}
                            >
                              <span>{opt}</span>
                              <span style={{ color: 'var(--accent)' }}>%{pct} ({votes} Oy)</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <div className="phone-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>
          <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Genel</span>
        </button>
        <button className={activeTab === 'academic' ? 'active' : ''} onClick={() => setActiveTab('academic')}>
          <svg viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Akademik</span>
        </button>
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Mesaj</span>
        </button>
        <button className={activeTab === 'pickup' ? 'active' : ''} onClick={() => setActiveTab('pickup')}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Teslim</span>
        </button>
        <button className={activeTab === 'extra' ? 'active' : ''} onClick={() => setActiveTab('extra')}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/></svg>
          <span>Diğer</span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ÖĞRETMEN UYGULAMASI (TEACHER APP)
========================================================= */
function TeacherApp({ user, dbState, fetchData, showToast, logOut, openPasswordModal, openDeleteModal, openPrivacyModal }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [activeClass, setActiveClass] = useState('8-LGS VIP');
  const [currentTeacherId, setCurrentTeacherId] = useState(user.teacherId);
  
  // Grade Form Hooks
  const [examName, setExamName] = useState('');
  const [examScore, setExamScore] = useState('');
  const [gradeStudent, setGradeStudent] = useState('');
  
  // Daily status hooks
  const [dailyStudent, setDailyStudent] = useState('');
  const [dailyMood, setDailyMood] = useState('Harika');
  const [dailyMeal, setDailyMeal] = useState('Hepsi');
  const [dailyNotes, setDailyNotes] = useState('');

  // Values and Medicines States
  const [valStudent, setValStudent] = useState('');
  const [valCategory, setValCategory] = useState('Kuran-ı Kerim');
  const [valProgress, setValProgress] = useState(50);
  const [valBadge, setValBadge] = useState('');
  const [valNotes, setValNotes] = useState('');
  const [teacherMedicines, setTeacherMedicines] = useState([]);

  const fetchTeacherMedicines = async () => {
    try {
      const res = await fetch(`${API_BASE}/medicines`);
      const data = await res.json();
      const classStudentIds = students.map(s => s.id);
      setTeacherMedicines(data.filter(m => classStudentIds.includes(m.studentId)));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeacherMedicines();
  }, [activeClass, dbState]);

  const submitValueProgress = async (e) => {
    e.preventDefault();
    if (!valStudent || !valCategory) return;
    try {
      await fetch(`${API_BASE}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: valStudent,
          category: valCategory,
          progress: valProgress,
          badgeName: valBadge,
          notes: valNotes
        })
      });
      setValBadge('');
      setValNotes('');
      fetchData();
      showToast('Değer gelişimi ve rozet başarıyla kaydedildi.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGiveMedicine = async (medId) => {
    try {
      await fetch(`${API_BASE}/medicines/${medId}/give`, {
        method: 'PUT'
      });
      fetchTeacherMedicines();
      fetchData();
      showToast('İlaç içirildi olarak işaretlendi.');
    } catch (err) {
      console.error(err);
    }
  };

  // Homework & Announcement upload hooks
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState('');
  const [hwMediaUrl, setHwMediaUrl] = useState('');
  const [hwMediaType, setHwMediaType] = useState('');
  const [hwUploading, setHwUploading] = useState(false);

  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annMediaUrl, setAnnMediaUrl] = useState('');
  const [annMediaType, setAnnMediaType] = useState('');
  const [annUploading, setAnnUploading] = useState(false);

  const teacher = dbState.teachers.find(t => t.id === currentTeacherId) || { name: 'Öğretmen', subject: '' };
  const students = dbState.students.filter(s => s.className === activeClass);

  // Set default student select when students load
  useEffect(() => {
    if (students.length > 0) {
      setGradeStudent(students[0].id);
      setDailyStudent(students[0].id);
      setValStudent(students[0].id);
    }
  }, [activeClass, dbState.students]);

  // Load teacher daily status text if pre-saved
  const loadDailyFields = (studentId) => {
    setDailyStudent(studentId);
    const log = dbState.dailyLogs[studentId] || { mealStatus: 'Hepsi', mood: 'Harika', notes: '' };
    setDailyMood(log.mood);
    setDailyMeal(log.mealStatus);
    setDailyNotes(log.notes || '');
  };

  const handleSetAttendance = async (studentId, status) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date: today, status })
      });
      fetchData();
      showToast('Yoklama durumu kaydedildi.');
    } catch (e) {
      console.error(e);
    }
  };

  const submitGrade = async () => {
    if (!examName || !examScore) return;
    try {
      await fetch(`${API_BASE}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: gradeStudent,
          subject: teacher.subject,
          examName,
          score: examScore
        })
      });
      setExamName('');
      setExamScore('');
      fetchData();
      showToast('Not kaydedildi, veliye grafik güncellemesi yollandı.');
    } catch (e) {
      console.error(e);
    }
  };

  const submitDailyStatus = async () => {
    try {
      await fetch(`${API_BASE}/daily-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: dailyStudent,
          mealStatus: dailyMeal,
          mood: dailyMood,
          notes: dailyNotes
        })
      });
      fetchData();
      showToast('Yemek ve günlük durum güncellendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTeacherPrepare = async (pkId) => {
    try {
      await fetch(`${API_BASE}/pickups/${pkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PREPARING' })
      });
      fetchData();
      showToast('Öğrenci kapıya yönlendirildi.');
    } catch (e) {
      console.error(e);
    }
  };

  // Lossless file uploader
  const handleMediaUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    if (type === 'homework') setHwUploading(true);
    if (type === 'announcement') setAnnUploading(true);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (type === 'homework') {
          setHwMediaUrl(data.fileUrl);
          setHwMediaType(data.mediaType);
        } else {
          setAnnMediaUrl(data.fileUrl);
          setAnnMediaType(data.mediaType);
        }
        showToast('Medya başarıyla yüklendi (Orijinal kalitede).');
      } else {
        showToast('Yükleme başarısız!', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Dosya yüklenirken sunucu hatası.', true);
    } finally {
      if (type === 'homework') setHwUploading(false);
      if (type === 'announcement') setAnnUploading(false);
    }
  };

  const submitHomework = async () => {
    if (!hwTitle || !hwDesc || !hwDue) return;
    try {
      await fetch(`${API_BASE}/homework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: activeClass,
          subject: teacher.subject,
          title: hwTitle,
          description: hwDesc,
          dueDate: hwDue,
          mediaUrl: hwMediaUrl,
          mediaType: hwMediaType
        })
      });
      setHwTitle('');
      setHwDesc('');
      setHwDue('');
      setHwMediaUrl('');
      setHwMediaType('');
      fetchData();
      showToast('Ödev tam kalitedeki medya ekiyle birlikte yayınlandı.');
    } catch (e) {
      console.error(e);
    }
  };

  const submitAnnouncement = async () => {
    if (!annTitle || !annMsg) return;
    try {
      await fetch(`${API_BASE}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle,
          message: annMsg,
          className: activeClass,
          mediaUrl: annMediaUrl,
          mediaType: annMediaType
        })
      });
      setAnnTitle('');
      setAnnMsg('');
      setAnnMediaUrl('');
      setAnnMediaType('');
      fetchData();
      showToast('Sınıf duyurusu tam kalitedeki görsel ekiyle paylaşıldı.');
    } catch (e) {
      console.error(e);
    }
  };

  const activePickupList = dbState.pickupRequests.filter(r => {
    const s = dbState.students.find(x => x.id === r.studentId);
    return s && s.className === activeClass && r.status === 'REQUESTED';
  });

  return (
    <div className="phone">
      <div className="phone-notch"></div>
      <div className="phone-status">
        <span className="mono">09:41</span>
        <span>LTE 🔋</span>
      </div>

      <div className="phone-top-hero">
        <span className="role-badge">Öğretmen</span>
        <div className="subtitle">{teacher.subject} Bölümü</div>
        <div className="title">{teacher.name}</div>
        <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '4px' }}>
          <button onClick={logOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>ÇIKIŞ</button>
          <button onClick={openPasswordModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>ŞİFRE</button>
          <button onClick={openPrivacyModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>GİZLİLİK</button>
          <button onClick={openDeleteModal} style={{ background: 'rgba(220,38,38,0.4)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>HESABIMI SİL</button>
        </div>
      </div>

      <div className="phone-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="field">
            <label>Öğretmen Seç</label>
            <select value={currentTeacherId} onChange={(e) => setCurrentTeacherId(e.target.value)}>
              {dbState.teachers.map((t, i) => <option key={i} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Aktif Sınıf</label>
            <select value={activeClass} onChange={(e) => setActiveClass(e.target.value)}>
              {dbState.classes.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Pickup notification alert with Interactive Leaflet Map for Teacher */}
        {activePickupList.length > 0 && (
          <div className="card premium-glow" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
            <h3 style={{ color: 'var(--accent-dark)', margin: 0 }}>🚗 Kapıda Bekleyen Veli!</h3>
            {activePickupList.map((req, i) => {
              const s = dbState.students.find(x => x.id === req.studentId);
              const distance = getDistance(req.latitude, req.longitude, 41.0583, 28.6942);
              return (
                <div key={i} style={{ marginTop: '12px', borderTop: '1px dashed rgba(180,83,9,0.2)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {s?.photoUrl ? (
                        <img src={s.photoUrl} alt={s?.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>👤</div>
                      )}
                      <span style={{ fontSize: '13px', color: 'var(--accent-dark)' }}><strong>{s?.name} {s?.surname || ''}</strong> çağrılıyor...</span>
                    </div>
                    <button className="btn btn-accent btn-sm" onClick={() => handleTeacherPrepare(req.id)}>Hazırla & Gönder</button>
                  </div>
                  
                  {/* Real-time Distance / Duration info for Teacher */}
                  <div style={{ fontSize: '11px', color: 'var(--accent-dark)', opacity: 0.8, display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                    <span>Mesafe: <strong>{distance} metre</strong></span>
                    <span>Tahmini Varış: <strong>{Math.ceil(distance / 80)} dk</strong></span>
                  </div>

                  {/* Leaflet Map */}
                  <PickupMap pickup={req} />
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="card">
            <h3>Yoklama Defteri</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>Tarih: {new Date().toISOString().slice(0, 10)}</p>
            {students.length === 0 ? emptyBlock('Kayıtlı öğrenci yok.') : students.map((s, i) => {
              const att = dbState.attendance.find(a => a.studentId === s.id && a.date === new Date().toISOString().slice(0, 10));
              const status = att ? att.status : 'yok';
              return (
                <div className="row" key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', border: '1px solid var(--border)' }}>👤</div>
                    )}
                    <span>{s.name} {s.surname || ''}</span>
                  </div>
                  <div className="btn-row" style={{ width: 'auto', gap: '4px' }}>
                    <button className={`btn btn-sm ${status === 'geldi' ? 'btn-accent' : 'btn-outline'}`} onClick={() => handleSetAttendance(s.id, 'geldi')}>Okulda</button>
                    <button className={`btn btn-sm ${status === 'gelmedi' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleSetAttendance(s.id, 'gelmedi')}>Yok</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'grades' && (
          <div className="card">
            <h3>Yeni Sınav Notu Girişi</h3>
            <div className="field">
              <label>Öğrenci</label>
              <select value={gradeStudent} onChange={(e) => setGradeStudent(e.target.value)}>
                {students.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Sınav Adı</label>
              <input type="text" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="Örn: Deneme Sınavı 3" />
            </div>
            <div className="field">
              <label>Puan (0-100)</label>
              <input type="number" value={examScore} onChange={(e) => setExamScore(e.target.value)} placeholder="85" />
            </div>
            <button className="btn btn-accent" onClick={submitGrade}>Notu Gönder</button>
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="card">
            <h3>Günlük Durum & Yemek</h3>
            <div className="field">
              <label>Öğrenci</label>
              <select value={dailyStudent} onChange={(e) => loadDailyFields(e.target.value)}>
                {students.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Ruh Hali</label>
              <select value={dailyMood} onChange={(e) => setDailyMood(e.target.value)}>
                <option value="Harika">😊 Harika & Mutlu</option>
                <option value="Uyumlu">🙂 Uyumlu & Sakin</option>
                <option value="Yorgun">😴 Yorgun & Uykulu</option>
                <option value="Gergin">🥺 Gergin / Hassas</option>
              </select>
            </div>
            <div className="field">
              <label>Öğle Yemeği</label>
              <select value={dailyMeal} onChange={(e) => setDailyMeal(e.target.value)}>
                <option value="Hepsi">🍱 Hepsini Yedi</option>
                <option value="Çoğu">🍲 Çoğunu Yedi</option>
                <option value="Az">🥣 Az Yedi</option>
                <option value="Hiç">❌ Hiç Yemedi</option>
              </select>
            </div>
            <div className="field">
              <label>Öğretmen Gözlem Notu</label>
              <textarea value={dailyNotes} onChange={(e) => setDailyNotes(e.target.value)} placeholder="Katılımı gayet iyiydi..."></textarea>
            </div>
            <button className="btn btn-accent" onClick={submitDailyStatus}>Raporu Kaydet</button>
          </div>
        )}

        {activeTab === 'homework' && (
          <>
            <div className="card">
              <h3>Yeni Ödev Tanımla</h3>
              <div className="field">
                <label>Ödev Başlığı</label>
                <input type="text" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="Örn: Kesirlerde Çarpma" />
              </div>
              <div className="field">
                <label>Açıklama</label>
                <textarea value={hwDesc} onChange={(e) => setHwDesc(e.target.value)} placeholder="Test 3 çözülecek..."></textarea>
              </div>
              <div className="field">
                <label>Son Teslim Tarihi</label>
                <input type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
              </div>

              {/* Lossless File/Video Uploader Input */}
              <div className="field">
                <label>Ödev Eki (Kayıpsız Resim veya Video)</label>
                <input type="file" accept="image/*,video/*" onChange={(e) => handleMediaUpload(e, 'homework')} />
                {hwUploading && <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>Medya yükleniyor, lütfen bekleyin...</div>}
                {hwMediaUrl && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--success)' }}>
                    ✓ Dosya yüklendi: {hwMediaUrl.split('/').pop()} ({hwMediaType})
                  </div>
                )}
              </div>

              <button className="btn btn-accent" onClick={submitHomework} disabled={hwUploading}>Ödevi Yayınla</button>
            </div>

            <div className="card">
              <h3>Sınıf Duyurusu Yap</h3>
              <div className="field">
                <label>Duyuru Başlığı</label>
                <input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Örn: Veli Toplantısı" />
              </div>
              <div className="field">
                <label>Mesaj</label>
                <textarea value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} placeholder="Duyuru detayları..."></textarea>
              </div>

              {/* Lossless File/Video Uploader Input */}
              <div className="field">
                <label>Duyuru Görseli/Ek Video (Kayıpsız)</label>
                <input type="file" accept="image/*,video/*" onChange={(e) => handleMediaUpload(e, 'announcement')} />
                {annUploading && <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>Medya yükleniyor, lütfen bekleyin...</div>}
                {annMediaUrl && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--success)' }}>
                    ✓ Dosya yüklendi: {annMediaUrl.split('/').pop()} ({annMediaType})
                  </div>
                )}
              </div>

              <button className="btn btn-accent" onClick={submitAnnouncement} disabled={annUploading}>Duyuru Yayınla</button>
            </div>
          </>
        )}

        {activeTab === 'extra' && (
          <>
            {/* 1. Günlük İlaç Takip */}
            <div className="card">
              <h3>💊 Sınıf İlaç Dağıtım Listesi</h3>
              {teacherMedicines.length === 0 ? (
                <div className="empty" style={{ padding: '12px' }}>Sınıfta bugün ilaç alacak öğrenci bulunmuyor.</div>
              ) : (
                teacherMedicines.map((m, i) => {
                  const stud = dbState.students.find(x => x.id === m.studentId);
                  return (
                    <div className="row" key={i} style={{ padding: '8px 0', borderBottom: i < teacherMedicines.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {stud?.photoUrl ? (
                          <img src={stud.photoUrl} alt={stud.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '18px' }}>👤</span>
                        )}
                        <div>
                          <strong>{stud?.name} {stud?.surname || ''}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.medicineName} ({m.dosage}) - Saat: {m.scheduledTime}</div>
                          {m.notes && <div style={{ fontSize: '10px', color: 'var(--accent)', fontStyle: 'italic' }}>Not: {m.notes}</div>}
                        </div>
                      </div>
                      <div>
                        {m.status === 'GIVEN' ? (
                          <span className="pill green">✓ İçirildi ({m.givenAt})</span>
                        ) : (
                          <button className="btn btn-accent btn-sm" onClick={() => handleGiveMedicine(m.id)}>💊 İçirildi İşaretle</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. Değerler Gelişim Giriş Formu */}
            <form onSubmit={submitValueProgress} className="card">
              <h3>🏆 Değerler ve Karakter Gelişimi Girişi</h3>
              
              <div className="field">
                <label>Öğrenci Seç</label>
                <select value={valStudent} onChange={(e) => setValStudent(e.target.value)} required>
                  {students.map((s, i) => <option key={i} value={s.id}>{s.name} {s.surname || ''}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Gelişim Kategorisi</label>
                <select value={valCategory} onChange={(e) => setValCategory(e.target.value)} required>
                  <option value="Kuran-ı Kerim">📖 Kuran-ı Kerim Okuma</option>
                  <option value="Namaz Takibi">🕌 Namaz Takibi</option>
                  <option value="Temizlik">✨ Temizlik ve Düzen</option>
                  <option value="Saygı">🤝 Saygı ve Nezaket</option>
                  <option value="Sure Ezberi">🗣️ Sure ve Dua Ezberi</option>
                  <option value="Yardımlaşma">❤️ Yardımlaşma ve Paylaşım</option>
                </select>
              </div>

              <div className="field">
                <label>İlerleme Yüzdesi (%{valProgress})</label>
                <input type="range" min="0" max="100" value={valProgress} onChange={(e) => setValProgress(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div className="field">
                <label>Kazanılan Rozet (İsteğe Bağlı)</label>
                <input type="text" value={valBadge} onChange={(e) => setValBadge(e.target.value)} placeholder="Örn: Elif-Ba Fatihi, Namaz Gönüllüsü" />
              </div>

              <div className="field">
                <label>Öğretmen Değerlendirme Notu</label>
                <textarea value={valNotes} onChange={(e) => setValNotes(e.target.value)} placeholder="Öğrencinin bu haftaki gelişimi hakkında not..."></textarea>
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', padding: '10px' }}>Gelişimi ve Rozeti Kaydet</button>
            </form>
          </>
        )}
      </div>

      <div className="phone-nav">
        <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}>
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Yoklama</span>
        </button>
        <button className={activeTab === 'grades' ? 'active' : ''} onClick={() => setActiveTab('grades')}>
          <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Not Ekle</span>
        </button>
        <button className={activeTab === 'daily' ? 'active' : ''} onClick={() => setActiveTab('daily')}>
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Günlük</span>
        </button>
        <button className={activeTab === 'homework' ? 'active' : ''} onClick={() => setActiveTab('homework')}>
          <svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Ödev</span>
        </button>
        <button className={activeTab === 'extra' ? 'active' : ''} onClick={() => setActiveTab('extra')}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/></svg>
          <span>İlaç/Değerler</span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   GÜVENLİK UYGULAMASI (SECURITY APP)
========================================================= */
function SecurityApp({ user, dbState, fetchData, showToast, simTime, logOut, openPasswordModal, openDeleteModal, openPrivacyModal }) {
  const [filterTab, setFilterTab] = useState('active'); // active, history
  const [securityCodes, setSecurityCodes] = useState({}); // Stores inputs for code matching per pickupId

  const activeRequests = dbState.pickupRequests.filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED');
  const finishedRequests = dbState.pickupRequests.filter(r => r.status === 'DELIVERED' || r.status === 'CANCELLED');

  const advanceStatus = async (id, status) => {
    try {
      await fetch(`${API_BASE}/pickups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
      showToast('Çağrı durumu güncellendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSecurityVerify = async (id, correctCode, studentId, requesterName) => {
    const entered = securityCodes[id] || '';
    if (entered.trim() !== correctCode) {
      showToast('Hatalı güvenlik kodu! Eşleşme sağlanamadı.', true);
      return;
    }

    try {
      // 1. Deliver the pickup request
      await fetch(`${API_BASE}/pickups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED', deliveredAt: new Date().toISOString() })
      });

      // 2. Automatically write turnstile exit log
      await fetch(`${API_BASE}/gatelogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          type: 'ÇIKIŞ',
          time: simTime,
          gate: 'Ana Kapı Veli Teslimat Noktası'
        })
      });

      fetchData();
      showToast('Öğrenci teslim edildi. Turnike çıkış kaydı başarıyla oluşturuldu.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="phone">
      <div className="phone-notch"></div>
      <div className="phone-status">
        <span className="mono">{simTime}</span>
        <span>LTE 🔋</span>
      </div>

      <div className="phone-top-hero" style={{ background: '#78350F' }}>
        <span className="role-badge">Güvenlik</span>
        <div className="subtitle">Okul Çıkış Noktası</div>
        <div className="title">Teslimat Kontrol</div>
        <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '4px' }}>
          <button onClick={logOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>ÇIKIŞ</button>
          <button onClick={openPasswordModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>ŞİFRE</button>
          <button onClick={openPrivacyModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>GİZLİLİK</button>
          <button onClick={openDeleteModal} style={{ background: 'rgba(220,38,38,0.4)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '9px', padding: '4px 6px', cursor: 'pointer', fontWeight: '700' }}>HESABIMI SİL</button>
        </div>
      </div>

      <div className="phone-body">
        {filterTab === 'active' ? (
          <>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>BEKLEYEN ÇAĞRILAR ({activeRequests.length})</h4>
            {activeRequests.length === 0 ? emptyBlock('Kuyrukta teslimat talebi yok.') : activeRequests.map((r, i) => {
              const s = dbState.students.find(x => x.id === r.studentId);
              const distance = getDistance(r.latitude, r.longitude, 41.0583, 28.6942);
              return (
                <div className="card premium-glow" key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {s?.photoUrl ? (
                        <img src={s.photoUrl} alt={s?.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', border: '1px solid var(--border)' }}>👤</div>
                      )}
                      <strong>{s?.name} {s?.surname || ''}</strong>
                    </div>
                    <span className={`pill ${r.status === 'REQUESTED' ? 'red' : 'brass'}`}>{r.status === 'REQUESTED' ? 'Talep Edildi' : 'Hazırlanıyor'}</span>
                  </div>
                  <div className="row"><span>Sınıf</span><span className="val">{s?.className}</span></div>
                  <div className="row"><span>Teslim Alan</span><span className="val">{r.requesterName}</span></div>
                  {r.vehiclePlate && <div className="row"><span>Araç Plakası</span><span className="val mono">{r.vehiclePlate}</span></div>}
                  
                  {/* Distance display for security */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Okula Mesafe: <strong>{distance} metre</strong></span>
                    <span>Tahmini Varış: <strong>{Math.ceil(distance / 80)} dk</strong></span>
                  </div>

                  {/* Leaflet Map for Security Guard */}
                  <PickupMap pickup={r} />

                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    {r.status === 'REQUESTED' && (
                      <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={() => advanceStatus(r.id, 'PREPARING')}>Çağrıyı Sınıfa İlet</button>
                    )}
                    {r.status === 'PREPARING' && (
                      <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={() => advanceStatus(r.id, 'READY')}>Öğrenci Kapıya Geldi</button>
                    )}
                    {r.status === 'READY' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                        <div className="field" style={{ margin: 0 }}>
                          <label>Güvenlik Kodu Eşleştir</label>
                          <input
                            type="text"
                            placeholder="6 Haneli Veli Kodu"
                            className="mono"
                            value={securityCodes[r.id] || ''}
                            onChange={(e) => setSecurityCodes({ ...securityCodes, [r.id]: e.target.value })}
                            style={{ padding: '8px 12px', fontSize: '13px' }}
                          />
                        </div>
                        <button className="btn btn-accent btn-sm" onClick={() => handleSecurityVerify(r.id, r.code, r.studentId, r.requesterName)}>Kodu Doğrula ve Teslim Et</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>TESLİM EDİLENLER / ARŞİV</h4>
            {finishedRequests.length === 0 ? emptyBlock('Kayıt bulunamadı.') : finishedRequests.map((r, i) => {
              const s = dbState.students.find(x => x.id === r.studentId);
              return (
                <div className="card" key={i} style={{ marginBottom: '8px', opacity: 0.8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{s?.name}</strong>
                    <span className={`pill ${r.status === 'DELIVERED' ? 'green' : 'red'}`}>{r.status === 'DELIVERED' ? 'Teslim Edildi' : 'İptal'}</span>
                  </div>
                  <div className="row"><span>Alan</span><span className="val">{r.requesterName}</span></div>
                  {r.deliveredAt && <div className="row"><span>Saat</span><span className="val">{r.deliveredAt.slice(11,16)}</span></div>}
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="phone-nav">
        <button className={filterTab === 'active' ? 'active' : ''} onClick={() => setFilterTab('active')}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Aktif</span>
        </button>
        <button className={filterTab === 'history' ? 'active' : ''} onClick={() => setFilterTab('history')}>
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
          <span>Geçmiş</span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   YÖNETİCİ KONSOLU (ADMIN CONSOLE)
========================================================= */
function AdminConsole({ user, dbState, fetchData, showToast, simTime, logOut, openPasswordModal, openDeleteModal, openPrivacyModal }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newSchoolName, setNewSchoolName] = useState(dbState.schoolName);
  
  // Student form (visual field mappings)
  const [stName, setStName] = useState('');
  const [stSurname, setStSurname] = useState('');
  const [stPhotoUrl, setStPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [stBirthDate, setStBirthDate] = useState('');
  const [stTcNo, setStTcNo] = useState('');
  const [stClass, setStClass] = useState('');
  
  const [stMotherName, setStMotherName] = useState('');
  const [stMotherSurname, setStMotherSurname] = useState('');
  const [stMotherJob, setStMotherJob] = useState('');
  const [stMotherPhone, setStMotherPhone] = useState('');

  const [stFatherName, setStFatherName] = useState('');
  const [stFatherSurname, setStFatherSurname] = useState('');
  const [stFatherJob, setStFatherJob] = useState('');
  const [stFatherPhone, setStFatherPhone] = useState('');

  const [stEmergencyContact, setStEmergencyContact] = useState('');
  const [stPrevReligiousEdu, setStPrevReligiousEdu] = useState('Hayır');
  const [stPrevReligiousEduDetail, setStPrevReligiousEduDetail] = useState('');
  const [stHealthAllergyInfo, setStHealthAllergyInfo] = useState('');
  const [stAdditionalNotes, setStAdditionalNotes] = useState('');
  const [stReferralSource, setStReferralSource] = useState('');

  // Teacher form
  const [tName, setTName] = useState('');
  const [tSubject, setTSubject] = useState('');

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annClass, setAnnClass] = useState('');

  // Lessons Dynamic CRUD Form
  const [lesClass, setLesClass] = useState('');
  const [lesSubject, setLesSubject] = useState('');
  const [lesTeacher, setLesTeacher] = useState('');
  const [lesStart, setLesStart] = useState('09:00');
  const [lesEnd, setLesEnd] = useState('09:40');

  // Advanced Operations states
  const [finStudent, setFinStudent] = useState('');
  const [finTotalAmount, setFinTotalAmount] = useState('');
  const [finPaidAmount, setFinPaidAmount] = useState('');
  const [finInstallments, setFinInstallments] = useState(1);
  const [finDueDate, setFinDueDate] = useState('');

  const [conStudent, setConStudent] = useState('');
  const [conTitle, setConTitle] = useState('');
  const [conDesc, setConDesc] = useState('');

  const [survTitle, setSurvTitle] = useState('');
  const [survQuestion, setSurvQuestion] = useState('');
  const [survOptions, setSurvOptions] = useState('Evet, Hayır, Kararsızım');

  // Auto set select options when dbState loads
  useEffect(() => {
    if (dbState.classes.length > 0) {
      setStClass(dbState.classes[0]);
      setLesClass(dbState.classes[0]);
    }
    if (dbState.teachers.length > 0) {
      setLesTeacher(dbState.teachers[0].name);
    }
    if (dbState.students.length > 0) {
      setFinStudent(dbState.students[0].id);
      setConStudent(dbState.students[0].id);
    }
  }, [dbState.classes, dbState.teachers, dbState.students]);

  const handleSaveFinance = async (e) => {
    e.preventDefault();
    if (!finStudent) return;
    try {
      await fetch(`${API_BASE}/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: finStudent,
          totalAmount: Number(finTotalAmount),
          paidAmount: Number(finPaidAmount),
          installments: Number(finInstallments),
          dueDate: finDueDate
        })
      });
      setFinTotalAmount('');
      setFinPaidAmount('');
      setFinInstallments(1);
      setFinDueDate('');
      fetchData();
      showToast('Finansal kayıt başarıyla güncellendi.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateConsent = async (e) => {
    e.preventDefault();
    if (!conStudent || !conTitle || !conDesc) return;
    try {
      await fetch(`${API_BASE}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: conStudent,
          title: conTitle,
          description: conDesc
        })
      });
      setConTitle('');
      setConDesc('');
      fetchData();
      showToast('İzin belgesi başarıyla veliye gönderildi.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    if (!survTitle || !survQuestion || !survOptions) return;
    try {
      const optsArray = survOptions.split(',').map(s => s.trim()).filter(Boolean);
      await fetch(`${API_BASE}/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: survTitle,
          question: survQuestion,
          options: optsArray
        })
      });
      setSurvTitle('');
      setSurvQuestion('');
      setSurvOptions('Evet, Hayır, Kararsızım');
      fetchData();
      showToast('Anket başarıyla yayına alındı.');
    } catch (err) {
      console.error(err);
    }
  };

  const saveSchoolName = async () => {
    if (!newSchoolName.trim()) return;
    try {
      await fetch(`${API_BASE}/school-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSchoolName.trim() })
      });
      fetchData();
      showToast('Okul adı güncellendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setPhotoUploading(true);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setStPhotoUrl(data.fileUrl);
        showToast('Öğrenci fotoğrafı başarıyla yüklendi.');
      } else {
        showToast('Fotoğraf yüklenemedi!', true);
      }
    } catch (err) {
      showToast('Fotoğraf yüklenirken hata oluştu!', true);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!stName || !stSurname || !stClass) {
      showToast('Öğrenci adı, soyadı ve sınıfı zorunludur!', true);
      return;
    }
    try {
      await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: stName,
          surname: stSurname,
          photoUrl: stPhotoUrl,
          birthDate: stBirthDate,
          tcNo: stTcNo,
          className: stClass,
          motherName: stMotherName,
          motherSurname: stMotherSurname,
          motherJob: stMotherJob,
          motherPhone: stMotherPhone,
          fatherName: stFatherName,
          fatherSurname: stFatherSurname,
          fatherJob: stFatherJob,
          fatherPhone: stFatherPhone,
          emergencyContact: stEmergencyContact,
          prevReligiousEdu: stPrevReligiousEdu,
          prevReligiousEduDetail: stPrevReligiousEduDetail,
          healthAllergyInfo: stHealthAllergyInfo,
          additionalNotes: stAdditionalNotes,
          referralSource: stReferralSource
        })
      });
      
      // Reset
      setStName('');
      setStSurname('');
      setStPhotoUrl('');
      setStBirthDate('');
      setStTcNo('');
      setStMotherName('');
      setStMotherSurname('');
      setStMotherJob('');
      setStMotherPhone('');
      setStFatherName('');
      setStFatherSurname('');
      setStFatherJob('');
      setStFatherPhone('');
      setStEmergencyContact('');
      setStPrevReligiousEdu('Hayır');
      setStPrevReligiousEduDetail('');
      setStHealthAllergyInfo('');
      setStAdditionalNotes('');
      setStReferralSource('');
      
      fetchData();
      showToast('Öğrenci ve veli bilgileri başarıyla kaydedildi.');
    } catch (e) {
      console.error(e);
      showToast('Kayıt oluşturulamadı!', true);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!tName || !tSubject) return;
    try {
      await fetch(`${API_BASE}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tName, subject: tSubject })
      });
      setTName('');
      setTSubject('');
      fetchData();
      showToast('Öğretmen eklendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle || !annMsg) return;
    try {
      await fetch(`${API_BASE}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: annTitle, message: annMsg, className: annClass })
      });
      setAnnTitle('');
      setAnnMsg('');
      fetchData();
      showToast('Kurumsal duyuru yayınlandı.');
    } catch (e) {
      console.error(e);
    }
  };

  // Lessons CRUD Handlers
  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!lesSubject || !lesStart || !lesEnd) return;
    try {
      await fetch(`${API_BASE}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: lesClass,
          subject: lesSubject,
          teacher: lesTeacher,
          start: lesStart,
          end: lesEnd
        })
      });
      setLesSubject('');
      fetchData();
      showToast('Ders programına yeni ders başarıyla eklendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    try {
      await fetch(`${API_BASE}/lessons/${lessonId}`, {
        method: 'DELETE'
      });
      fetchData();
      showToast('Ders programından kaldırıldı.');
    } catch (e) {
      console.error(e);
    }
  };

  const totalStudents = dbState.students.length;
  const totalTeachers = dbState.teachers.length;
  const activePickups = dbState.pickupRequests.filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED').length;
  
  const today = new Date().toISOString().slice(0, 10);
  const presentCount = dbState.attendance.filter(a => a.date === today && a.status === 'geldi').length;

  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="display" style={{ margin: 0, fontSize: '24px', color: 'var(--primary)' }}>Okul Yönetim Konsolu</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Okul: <strong>{dbState.schoolName}</strong></span>
          <button className="btn btn-outline btn-sm" onClick={openPasswordModal}>🔑 Şifre Değiştir</button>
          <button className="btn btn-outline btn-sm" onClick={openPrivacyModal}>📄 Gizlilik</button>
          <button className="btn btn-outline btn-sm" onClick={openDeleteModal} style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.3)' }}>⚠️ Hesabımı Sil</button>
          <button className="btn btn-outline btn-sm" onClick={logOut}>ÇIKIŞ</button>
        </div>
      </div>

      <div className="admin-tabs">
        <div className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Genel Panel</div>
        <div className={`admin-tab ${activeTab === 'attendance_report' ? 'active' : ''}`} onClick={() => setActiveTab('attendance_report')}>📋 Toplu Yoklama Raporu</div>
        <div className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>Öğrenciler</div>
        <div className={`admin-tab ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => setActiveTab('teachers')}>Öğretmenler</div>
        <div className={`admin-tab ${activeTab === 'lessons' ? 'active' : ''}`} onClick={() => setActiveTab('lessons')}>Ders Programları</div>
        <div className={`admin-tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>Duyurular</div>
        <div className={`admin-tab ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>Gelişmiş Modüller</div>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="stats-row">
            <div className="stat-card"><div className="num">{totalStudents}</div><div className="lbl">Kayıtlı Öğrenci</div></div>
            <div className="stat-card"><div className="num">{totalTeachers}</div><div className="lbl">Öğretmen Kadrosu</div></div>
            <div className="stat-card"><div className="num">{presentCount}/{totalStudents}</div><div className="lbl">Okuldaki Öğrenci</div></div>
            <div className="stat-card"><div className="num" style={{ color: 'var(--accent)' }}>{activePickups}</div><div className="lbl">Bekleyen Teslim</div></div>
          </div>

          <div className="grid2">
            <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: 'var(--error)', fontSize: '16px' }}>🚨 Bugün Gelmeyen Öğrenciler (Toplu Liste)</h3>
                <button className="btn btn-sm btn-outline" onClick={() => setActiveTab('attendance_report')}>Tüm Raporu Aç ➔</button>
              </div>
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {(() => {
                  const absents = dbState.students.filter(s => {
                    const att = dbState.attendance.find(a => a.studentId === s.id && a.date === today);
                    return att && att.status === 'gelmedi';
                  });
                  if (absents.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '15px', color: 'var(--success)', fontSize: '13px' }}>🎉 Bugün tüm öğrenciler derste veya gelmeyen işaretlenmedi.</div>;
                  }
                  return absents.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px', marginBottom: '6px' }}>
                      <div>
                        <strong style={{ fontSize: '13px' }}>{s.name} {s.surname}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Sınıf: {s.className}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="pill red" style={{ fontSize: '10px' }}>GELMEDİ</span>
                        <a href={`tel:${s.parentPhone || s.fatherPhone || s.motherPhone}`} className="btn btn-sm btn-outline" style={{ fontSize: '10px', padding: '2px 6px' }}>📞 Veli Ara</a>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="card">
              <h3>Okul Giriş / Turnike Akışı</h3>
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {dbState.gateLogs.length === 0 ? emptyBlock('Turnike kaydı bulunamadı.') : dbState.gateLogs.slice().reverse().map((l, i) => {
                  const s = dbState.students.find(x => x.id === l.studentId);
                  return (
                    <div className="gate-log-item" key={i}>
                      <div className="gate-details">
                        <strong>{s ? s.name : 'Bilinmeyen'}</strong>
                        <span className="gate-time">{l.gate}</span>
                      </div>
                      <span className={`pill ${l.type === 'GİRİŞ' ? 'green' : 'red'}`}>{l.type} - {l.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'attendance_report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>📋 Tüm Sınıflar İçin Toplu Gelmeyen Öğrenciler Raporu ({today})</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>Öğretmenler tarafından yoklaması alınan ve "Gelmedi" olarak işaretlenen öğrenciler tüm sınıflar düzeyinde listelenir.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
              {(() => {
                const uniqueClasses = Array.from(new Set(dbState.students.map(s => s.className)));
                if (uniqueClasses.length === 0) {
                  return emptyBlock('Henüz kayıtlı sınıf veya öğrenci yok.');
                }
                return uniqueClasses.map((cls, idx) => {
                  const classStudents = dbState.students.filter(s => s.className === cls);
                  const absentStudents = classStudents.filter(s => {
                    const att = dbState.attendance.find(a => a.studentId === s.id && a.date === today);
                    return att && att.status === 'gelmedi';
                  });
                  const presentStudents = classStudents.filter(s => {
                    const att = dbState.attendance.find(a => a.studentId === s.id && a.date === today);
                    return att && att.status === 'geldi';
                  });

                  return (
                    <div key={idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--primary)' }}>🏫 Sınıf: {cls}</h4>
                        <span className="pill blue" style={{ fontSize: '11px' }}>Mevcut: {classStudents.length}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Geldi: {presentStudents.length}</span>
                        <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>✗ Gelmedi: {absentStudents.length}</span>
                      </div>

                      {absentStudents.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--success)', fontStyle: 'italic' }}>Bu sınıfta bugün devamsız öğrenci yok.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {absentStudents.map((st, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(220,38,38,0.2)' }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>{st.name} {st.surname}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Veli: {st.parentName || st.fatherName || st.motherName}</div>
                              </div>
                              <a href={`tel:${st.parentPhone || st.fatherPhone || st.motherPhone}`} className="btn btn-sm btn-accent" style={{ fontSize: '10px', padding: '2px 6px' }}>📞 Ara ({st.parentPhone || st.fatherPhone})</a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="grid2">
          <form onSubmit={handleAddStudent} className="card" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary)' }}>Yeni Öğrenci / Veli Kayıt Formu</h3>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>* Tüm Alanlar Zorunludur</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Öğrenci Bilgileri */}
              <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 10px', color: 'var(--primary)', fontSize: '14px', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>Öğrenci Bilgileri</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="field">
                    <label>Adı *</label>
                    <input type="text" value={stName} onChange={(e) => setStName(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Soyadı *</label>
                    <input type="text" value={stSurname} onChange={(e) => setStSurname(e.target.value)} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div className="field">
                    <label>Doğum Tarihi</label>
                    <input type="date" value={stBirthDate} onChange={(e) => setStBirthDate(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>T.C. Kimlik No</label>
                    <input type="text" value={stTcNo} onChange={(e) => setStTcNo(e.target.value)} maxLength="11" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div className="field">
                    <label>Sınıfı / Grubu *</label>
                    <select value={stClass} onChange={(e) => setStClass(e.target.value)} required>
                      {dbState.classes.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Öğrenci Fotoğrafı</label>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                    {photoUploading && <div style={{ fontSize: '10px', color: 'var(--accent)' }}>Yükleniyor...</div>}
                    {stPhotoUrl && <div style={{ fontSize: '10px', color: 'var(--success)' }}>✓ Yüklendi</div>}
                  </div>
                </div>
              </div>

              {/* Veli Bilgileri */}
              <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 10px', color: '#B45309', fontSize: '14px', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>Anne Bilgileri</h4>
                    <div className="field"><label>Adı</label><input type="text" value={stMotherName} onChange={(e) => setStMotherName(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Soyadı</label><input type="text" value={stMotherSurname} onChange={(e) => setStMotherSurname(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Mesleği</label><input type="text" value={stMotherJob} onChange={(e) => setStMotherJob(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Telefon Numarası</label><input type="text" value={stMotherPhone} onChange={(e) => setStMotherPhone(e.target.value)} placeholder="05xx xxx xx xx" /></div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 10px', color: '#B45309', fontSize: '14px', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>Baba Bilgileri</h4>
                    <div className="field"><label>Adı</label><input type="text" value={stFatherName} onChange={(e) => setStFatherName(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Soyadı</label><input type="text" value={stFatherSurname} onChange={(e) => setStFatherSurname(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Mesleği</label><input type="text" value={stFatherJob} onChange={(e) => setStFatherJob(e.target.value)} /></div>
                    <div className="field" style={{ marginTop: '6px' }}><label>Telefon Numarası</label><input type="text" value={stFatherPhone} onChange={(e) => setStFatherPhone(e.target.value)} placeholder="05xx xxx xx xx" /></div>
                  </div>
                </div>
              </div>

              {/* Acil Durum ve Ek Sorular */}
              <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 10px', color: 'var(--primary)', fontSize: '14px', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>Acil Durum & Detaylar</h4>
                
                <div className="field">
                  <label>Anne-Babaya ulaşılamadığı zaman aranacak kişi ve tel no.</label>
                  <input type="text" value={stEmergencyContact} onChange={(e) => setStEmergencyContact(e.target.value)} placeholder="İsim - Derece - Telefon" />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginTop: '8px' }}>
                  <div className="field">
                    <label>Dini Eğitim Aldı mı?</label>
                    <select value={stPrevReligiousEdu} onChange={(e) => setStPrevReligiousEdu(e.target.value)}>
                      <option value="Hayır">Hayır</option>
                      <option value="Evet">Evet</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Aldı ise Nereden?</label>
                    <input type="text" value={stPrevReligiousEduDetail} onChange={(e) => setStPrevReligiousEduDetail(e.target.value)} placeholder="Örn: Kurs, Camii vb." disabled={stPrevReligiousEdu === 'Hayır'} />
                  </div>
                </div>

                <div className="field" style={{ marginTop: '8px' }}>
                  <label>Rahatsızlık veya Herhangi Bir Ürüne Alerjisi Var mı?</label>
                  <input type="text" value={stHealthAllergyInfo} onChange={(e) => setStHealthAllergyInfo(e.target.value)} placeholder="Açıklama giriniz" />
                </div>

                <div className="field" style={{ marginTop: '8px' }}>
                  <label>Eklemek İstedikleriniz (Notlar)</label>
                  <textarea value={stAdditionalNotes} onChange={(e) => setStAdditionalNotes(e.target.value)} placeholder="Ekstra belirtmek istediğiniz hususlar..."></textarea>
                </div>

                <div className="field" style={{ marginTop: '8px' }}>
                  <label>Bize Nasıl Ulaştınız?</label>
                  <input type="text" value={stReferralSource} onChange={(e) => setStReferralSource(e.target.value)} placeholder="Broşür, İnternet, Arkadaş vb." />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-accent" style={{ marginTop: '16px', width: '100%', padding: '12px' }}>Öğrenci Kaydını Tamamla</button>
          </form>

          <div className="card">
            <h3>Kayıtlı Öğrenci Listesi</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fotoğraf</th>
                    <th>Öğrenci Ad Soyad</th>
                    <th>Sınıf</th>
                    <th>Veli İletişim</th>
                    <th>Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {dbState.students.map((s, i) => (
                    <tr key={i}>
                      <td>
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', border: '1px solid var(--border)' }}>👤</div>
                        )}
                      </td>
                      <td><strong>{s.name} {s.surname || ''}</strong></td>
                      <td><span className="pill brass">{s.className}</span></td>
                      <td>{s.parentName}</td>
                      <td className="mono">{s.parentPhone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="grid2">
          <form onSubmit={handleAddTeacher} className="card">
            <h3>Öğretmen Tanımlama</h3>
            <div className="field"><label>Ad Soyad</label><input type="text" value={tName} onChange={(e) => setTName(e.target.value)} required /></div>
            <div className="field"><label>Branş</label><input type="text" value={tSubject} onChange={(e) => setTSubject(e.target.value)} required /></div>
            <button type="submit" className="btn btn-accent">Kaydet</button>
          </form>

          <div className="card">
            <h3>Öğretmen Kadrosu</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Öğretmen</th><th>Branş</th><th>Username (Login)</th></tr>
                </thead>
                <tbody>
                  {dbState.teachers.map((t, i) => (
                    <tr key={i}>
                      <td><strong>{t.name}</strong></td>
                      <td><span className="pill green">{t.subject}</span></td>
                      <td className="mono">{t.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lessons' && (
        <div className="grid2">
          <form onSubmit={handleAddLesson} className="card">
            <h3>Yeni Ders Ekle</h3>
            <div className="field">
              <label>Sınıf</label>
              <select value={lesClass} onChange={(e) => setLesClass(e.target.value)}>
                {dbState.classes.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Ders Adı</label>
              <input type="text" value={lesSubject} onChange={(e) => setLesSubject(e.target.value)} placeholder="Matematik, Kimya..." required />
            </div>
            <div className="field">
              <label>Öğretmen</label>
              <select value={lesTeacher} onChange={(e) => setLesTeacher(e.target.value)}>
                {dbState.teachers.map((t, i) => <option key={i} value={t.name}>{t.name}</option>)}
                <option value="-">- Boş / Yemek -</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="field">
                <label>Başlangıç Saat</label>
                <input type="text" value={lesStart} onChange={(e) => setLesStart(e.target.value)} placeholder="09:00" required />
              </div>
              <div className="field">
                <label>Bitiş Saat</label>
                <input type="text" value={lesEnd} onChange={(e) => setLesEnd(e.target.value)} placeholder="09:40" required />
              </div>
            </div>
            <button type="submit" className="btn btn-accent">Programı Güncelle (Ders Ekle)</button>
          </form>

          <div className="card">
            <h3>Ders Programları & Canlı Çizelge</h3>
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              {dbState.lessons.length === 0 ? emptyBlock('Kayıtlı ders programı bulunmamaktadır.') : (
                <table>
                  <thead>
                    <tr><th>Sınıf</th><th>Saat</th><th>Ders</th><th>Öğretmen</th><th>İşlem</th></tr>
                  </thead>
                  <tbody>
                    {dbState.lessons.slice().sort((a,b) => a.className.localeCompare(b.className) || parseTime(a.start) - parseTime(b.start)).map((l, i) => (
                      <tr key={i}>
                        <td><strong>{l.className}</strong></td>
                        <td className="mono">{l.start} - {l.end}</td>
                        <td>{l.subject}</td>
                        <td>{l.teacher}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDeleteLesson(l.id)} style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.2)' }}>
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="grid2">
          <form onSubmit={handleAddAnnouncement} className="card">
            <h3>Kurumsal Duyuru Oluştur</h3>
            <div className="field"><label>Başlık</label><input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} required /></div>
            <div className="field">
              <label>Kitle</label>
              <select value={annClass} onChange={(e) => setAnnClass(e.target.value)}>
                <option value="">Tüm Okul / Herkes</option>
                {dbState.classes.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Duyuru Metni</label><textarea value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} required></textarea></div>
            <button type="submit" className="btn btn-accent">Yayınla</button>
          </form>

          <div className="card">
            <h3>Duyuru Arşivi</h3>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {dbState.announcements.slice().reverse().map((a, i) => (
                <div className="row" key={i} style={{ display: 'block', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong>📢 {a.title}</strong>
                    <span className="pill brass">{a.className || 'Herkes'}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{a.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'operations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Finans Modülü */}
            <form onSubmit={handleSaveFinance} className="card">
              <h3>💵 Veli Ödeme ve Taksit Tanımlama</h3>
              <div className="field">
                <label>Öğrenci Seç</label>
                <select value={finStudent} onChange={(e) => setFinStudent(e.target.value)} required>
                  {dbState.students.map((s, i) => <option key={i} value={s.id}>{s.name} {s.surname || ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="field">
                  <label>Toplam Borç (TL)</label>
                  <input type="number" value={finTotalAmount} onChange={(e) => setFinTotalAmount(e.target.value)} placeholder="45000" required />
                </div>
                <div className="field">
                  <label>Ödenen Tutar (TL)</label>
                  <input type="number" value={finPaidAmount} onChange={(e) => setFinPaidAmount(e.target.value)} placeholder="15000" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <div className="field">
                  <label>Taksit Sayısı</label>
                  <input type="number" value={finInstallments} onChange={(e) => setFinInstallments(Number(e.target.value))} min="1" required />
                </div>
                <div className="field">
                  <label>Sıradaki Vade Tarihi</label>
                  <input type="date" value={finDueDate} onChange={(e) => setFinDueDate(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn btn-accent" style={{ marginTop: '12px', width: '100%' }}>Finansal Durumu Güncelle</button>
            </form>

            {/* İzin Muvafakatnamesi Modülü */}
            <form onSubmit={handleCreateConsent} className="card">
              <h3>📋 Yeni Muvafakatname (Veli İzni) Yayınla</h3>
              <div className="field">
                <label>Öğrenci Seç</label>
                <select value={conStudent} onChange={(e) => setConStudent(e.target.value)} required>
                  {dbState.students.map((s, i) => <option key={i} value={s.id}>{s.name} {s.surname || ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Muvafakatname Başlığı</label>
                <input type="text" value={conTitle} onChange={(e) => setConTitle(e.target.value)} placeholder="Örn: Piknik Gezisi Muvafakatnamesi" required />
              </div>
              <div className="field">
                <label>Muvafakatname Detaylı Açıklaması</label>
                <textarea value={conDesc} onChange={(e) => setConDesc(e.target.value)} placeholder="Etkinlik kuralları ve detayları..." required></textarea>
              </div>
              <button type="submit" className="btn btn-accent" style={{ width: '100%' }}>Muvafakatname Gönder</button>
            </form>
          </div>

          <div>
            {/* Anket Modülü */}
            <form onSubmit={handleCreateSurvey} className="card">
              <h3>📊 Yeni Anket Yayınla (Tüm Okul)</h3>
              <div className="field">
                <label>Anket Başlığı</label>
                <input type="text" value={survTitle} onChange={(e) => setSurvTitle(e.target.value)} placeholder="Örn: Kulüp Faaliyetleri" required />
              </div>
              <div className="field">
                <label>Anket Sorusu</label>
                <input type="text" value={survQuestion} onChange={(e) => setSurvQuestion(e.target.value)} placeholder="Örn: Hangi kulübe katılmak istersiniz?" required />
              </div>
              <div className="field">
                <label>Seçenekler (Virgülle Ayırın)</label>
                <input type="text" value={survOptions} onChange={(e) => setSurvOptions(e.target.value)} placeholder="Örn: Evet, Hayır, Kararsızım" required />
              </div>
              <button type="submit" className="btn btn-accent" style={{ width: '100%' }}>Anketi Yayınla</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyBlock(msg) {
  return <div className="empty">{msg}</div>;
}
