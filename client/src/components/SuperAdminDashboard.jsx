import React, { useState, useEffect } from 'react';

export default function SuperAdminDashboard({ user, onLogout }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editQuota, setEditQuota] = useState(50);
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editDurationYears, setEditDurationYears] = useState(1);
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/superadmin/schools');
      const data = await res.json();
      if (data.success) {
        setSchools(data.schools);
      }
    } catch (err) {
      console.error('Okullar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const openEditModal = (school) => {
    setSelectedSchool(school);
    setEditQuota(school.studentQuota || 50);
    setEditStatus(school.subscriptionStatus || 'ACTIVE');
    setEditDurationYears(1);
    setEditContactPhone(school.contactPhone || '');
    setEditNotes(school.notes || '');
  };

  const handleSaveLicense = async () => {
    if (!selectedSchool) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/superadmin/schools/${selectedSchool.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentQuota: editQuota,
          subscriptionStatus: editStatus,
          durationYears: editDurationYears,
          contactPhone: editContactPhone,
          notes: editNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Lisans başarıyla güncellendi!');
        setSelectedSchool(null);
        fetchSchools();
      } else {
        alert('Hata: ' + (data.message || 'Güncellenemedi'));
      }
    } catch (err) {
      alert('İstek hatası: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSchools = schools.filter(s => {
    const q = searchTerm.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.type && s.type.toLowerCase().includes(q)) ||
      (s.adminUsername && s.adminUsername.toLowerCase().includes(q)) ||
      (s.contactPhone && s.contactPhone.includes(q))
    );
  });

  const totalSchools = schools.length;
  const totalStudents = schools.reduce((acc, s) => acc + (s.studentCount || 0), 0);
  const activeSchools = schools.filter(s => s.subscriptionStatus === 'ACTIVE').length;
  const trialSchools = schools.filter(s => s.subscriptionStatus === 'TRIAL').length;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F172A',
      color: '#F8FAFC',
      fontFamily: 'Inter, system-ui, sans-serif',
      paddingBottom: '40px'
    }}>
      {/* Top Header */}
      <header style={{
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            👑
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#FFFFFF' }}>
              Okul360 Süper Yönetici Paneli
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
              Hoş geldin, {user?.name || 'Süper Admin'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchSchools}
            style={{
              background: '#334155',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🔄 Yenile
          </button>
          <button
            onClick={onLogout}
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {/* KPI Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>
              Toplam Kayıtlı Okul
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#60A5FA', marginTop: '6px' }}>
              {totalSchools}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Tüm kurumsal müşteriler
            </div>
          </div>

          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>
              Toplam Öğrenci
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#34D399', marginTop: '6px' }}>
              {totalStudents}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Sistemdeki aktif veli/öğrenci
            </div>
          </div>

          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>
              Aktif Lisanslı Okul
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#A78BFA', marginTop: '6px' }}>
              {activeSchools}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Yıllık lisans ödeyen kurumlar
            </div>
          </div>

          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>
              Deneme Aşamasında
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#FBBF24', marginTop: '6px' }}>
              {trialSchools}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              14 günlük denemedeki okullar
            </div>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div style={{
          background: '#1E293B',
          borderRadius: '16px',
          border: '1px solid #334155',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              placeholder="🔍 Okul adı, türü, yönetici veya telefon ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#0F172A',
                border: '1px solid #334155',
                color: '#F8FAFC',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>
            Listelenen: <b>{filteredSchools.length}</b> okul
          </div>
        </div>

        {/* Schools Table */}
        <div style={{
          background: '#1E293B',
          borderRadius: '16px',
          border: '1px solid #334155',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
              Yükleniyor...
            </div>
          ) : filteredSchools.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
              Aramanıza uygun okul bulunamadı.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                    <th style={{ padding: '14px 16px' }}>Okul Adı & Türü</th>
                    <th style={{ padding: '14px 16px' }}>Öğrenci / Kota</th>
                    <th style={{ padding: '14px 16px' }}>Lisans Durumu</th>
                    <th style={{ padding: '14px 16px' }}>Kalan Süre</th>
                    <th style={{ padding: '14px 16px' }}>Yönetici & İletişim</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map((school) => {
                    const isTrial = school.subscriptionStatus === 'TRIAL';
                    const isActive = school.subscriptionStatus === 'ACTIVE';
                    const isExpired = school.isExpired;

                    const cleanPhone = (school.contactPhone || '').replace(/\D/g, '');
                    const waUrl = cleanPhone ? `https://wa.me/90${cleanPhone.slice(-10)}` : null;

                    return (
                      <tr key={school.id} style={{ borderBottom: '1px solid #334155', transition: 'background 0.15s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#FFFFFF' }}>
                            {school.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                            {school.type} • ID: {school.id}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{
                            fontWeight: '700',
                            color: school.studentCount >= school.studentQuota ? '#F87171' : '#34D399'
                          }}>
                            {school.studentCount} / {school.studentQuota} Öğrenci
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {school.teacherCount} Öğretmen
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: isExpired ? '#7F1D1D' : (isActive ? '#065F46' : '#78350F'),
                            color: isExpired ? '#FCA5A5' : (isActive ? '#6EE7B7' : '#FDE68A')
                          }}>
                            {isExpired ? '⚠️ SÜRESİ BİTTİ' : (isActive ? '✅ LİSANSLI' : '🎁 DENEME')}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '600' }}>
                            {isExpired ? '0 Gün' : `${school.daysLeft} Gün`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {school.subscriptionEndsAt ? new Date(school.subscriptionEndsAt).toLocaleDateString('tr-TR') : '14 Gün Deneme'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: '#E2E8F0', fontWeight: '500' }}>
                            {school.adminName || school.adminUsername || '-'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                              {school.contactPhone || '-'}
                            </span>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: '#22C55E',
                                  color: '#FFFFFF',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  fontWeight: '700'
                                }}
                              >
                                WA
                              </a>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => openEditModal(school)}
                            style={{
                              background: '#3B82F6',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '700'
                            }}
                          >
                            ⚙️ Lisans & Kota
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit License Modal */}
      {selectedSchool && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#1E293B',
            border: '1px solid #475569',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            color: '#F8FAFC'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                ⚙️ {selectedSchool.name} - Lisans Yönetimi
              </h3>
              <button
                onClick={() => setSelectedSchool(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Quota Setting */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                ÖĞRENCİ KOTASI (Max Öğrenci Sayısı):
              </label>
              <input
                type="number"
                value={editQuota}
                onChange={(e) => setEditQuota(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #475569',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '16px',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              />
              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[25, 50, 100, 200, 500, 1000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEditQuota(val)}
                    style={{
                      background: editQuota === val ? '#3B82F6' : '#334155',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Status & Duration Setting */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                  LİSANS DURUMU:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #475569',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '13px'
                  }}
                >
                  <option value="ACTIVE">✅ AKTİF (Lisanslı)</option>
                  <option value="TRIAL">🎁 DENEME (Trial)</option>
                  <option value="EXPIRED">⚠️ SÜRESİ BİTTİ</option>
                  <option value="SUSPENDED">🚫 ASKIYA ALINDI</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                  SÜRE UZATMA:
                </label>
                <select
                  value={editDurationYears}
                  onChange={(e) => setEditDurationYears(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #475569',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '13px'
                  }}
                >
                  <option value={1}>+1 Yıl Ekle</option>
                  <option value={2}>+2 Yıl Ekle</option>
                  <option value={3}>+3 Yıl Ekle</option>
                  <option value={0}>Tarihi Değiştirme</option>
                </select>
              </div>
            </div>

            {/* Contact Phone */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                KURUCU / YÖNETİCİ TELEFONU:
              </label>
              <input
                type="text"
                placeholder="Örn: 0532 123 45 67"
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #475569',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Admin Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                SATIŞ / ANLAŞMA NOTLARI:
              </label>
              <textarea
                rows={2}
                placeholder="Örn: 100 öğrenci için yıllık 40.000 TL havale alındı."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #475569',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedSchool(null)}
                style={{
                  flex: 1,
                  background: '#334155',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                İptal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveLicense}
                style={{
                  flex: 1,
                  background: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                {saving ? 'Kaydediliyor...' : '💾 Lisansı Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
