import React, { useState } from 'react';

export default function UpgradeModal({ isOpen, onClose, subscription }) {
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const schoolName = subscription?.schoolName || 'Kurumunuz';
  const currentCount = subscription?.currentStudentCount || 0;
  const quota = subscription?.studentQuota || 15;
  const daysLeft = subscription?.daysLeft ?? 0;
  const isTrial = subscription?.subscriptionStatus === 'TRIAL';
  const isExpired = subscription?.isExpired;

  const phone = subscription?.supportWhatsApp || '05349577969';
  const cleanPhone = phone.replace(/\D/g, '');
  const internationalPhone = cleanPhone.startsWith('90') ? cleanPhone : '90' + cleanPhone.replace(/^0/, '');
  
  const defaultMessage = `Merhaba, ${schoolName} için Okul360 yıllık kurumsal lisans ve öğrenci kotası teklifi almak istiyoruz.`;
  const whatsappUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(defaultMessage)}`;

  const iban = subscription?.bankInfo?.iban || 'TR12 0001 0000 0000 0000 0000 00';
  const accountHolder = subscription?.bankInfo?.accountHolder || 'Engin Ekinci / Okul360 Yazılım Hizmetleri';
  const bankName = subscription?.bankInfo?.bankName || 'Ziraat Bankası / Garanti BBVA';

  const handleCopyIban = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header Background */}
        <div style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#FFFFFF',
          padding: '24px 24px 20px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '26px' }}>👑</span>
            <span style={{
              background: '#3B82F6',
              fontSize: '11px',
              fontWeight: '700',
              padding: '4px 10px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Kurumsal Lisans
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>
            {schoolName}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94A3B8' }}>
            Okulunuzu sınırsız öğrenci ve veliyle buluşturun
          </p>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Status Box */}
          <div style={{
            background: isExpired ? '#FEF2F2' : '#F8FAFC',
            border: `1px solid ${isExpired ? '#FCA5A5' : '#E2E8F0'}`,
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                ÖĞRENCİ KULLANIMI
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: currentCount >= quota ? '#DC2626' : '#0F172A' }}>
                {currentCount} / {quota} Öğrenci
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                LİSANS DURUMU
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: isExpired ? '#DC2626' : (isTrial ? '#D97706' : '#16A34A')
              }}>
                {isExpired ? '⚠️ Süre Doldu' : (isTrial ? `🎁 Deneme (${daysLeft} Gün)` : '✅ Aktif Lisans')}
              </div>
            </div>
          </div>

          {/* Value Highlights */}
          <div style={{ marginBottom: '22px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>
              Yıllık Kurumsal Lisans Avantajları:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontSize: '16px' }}>✓</span>
                <span><b>Sınırsız Bildirim & Veli İletişimi:</b> Aylık binlerce liralık SMS masrafını sıfırlayın.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontSize: '16px' }}>✓</span>
                <span><b>Güvenli Teslimat (Pickup):</b> Dinamik kodlu öğrenci çıkış ve nöbetçi güvenliği.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontSize: '16px' }}>✓</span>
                <span><b>Akademik Takip:</b> Yoklama, ödev, gelişim karneleri ve çoklu öğretmen yetkilendirme.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontSize: '16px' }}>✓</span>
                <span><b>Kalıcı Bulut Veritabanı:</b> Yıl boyu hiçbir veriniz ve geçmiş kayıtlarınız silinmez.</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: '#22C55E',
                color: '#FFFFFF',
                padding: '14px 20px',
                borderRadius: '14px',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)',
                transition: 'transform 0.1s ease',
                textAlign: 'center'
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              WhatsApp İle Hemen Teklif Al
            </a>

            <a
              href={`tel:${phone}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#F1F5F9',
                color: '#0F172A',
                padding: '12px 18px',
                borderRadius: '14px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '14px',
                border: '1px solid #CBD5E1'
              }}
            >
              <span>📞</span>
              Müşteri Temsilcisini Ara ({phone})
            </a>
          </div>

          {/* Bank Wire / EFT Collapse Toggle */}
          <div style={{ marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
            <button
              onClick={() => setShowBankInfo(!showBankInfo)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0,
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <span>🏦</span>
              {showBankInfo ? 'Banka & Fatura Bilgilerini Gizle ▲' : 'Banka Havale / EFT & Fatura Bilgilerini Göster ▼'}
            </button>

            {showBankInfo && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                padding: '14px',
                marginTop: '12px',
                fontSize: '12px'
              }}>
                <div style={{ marginBottom: '6px', color: '#64748B' }}>
                  <b>Banka:</b> {bankName}
                </div>
                <div style={{ marginBottom: '6px', color: '#64748B' }}>
                  <b>Hesap Sahibi:</b> {accountHolder}
                </div>
                <div style={{
                  background: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px dashed #94A3B8',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span>{iban}</span>
                  <button
                    onClick={handleCopyIban}
                    style={{
                      background: copied ? '#16A34A' : '#E2E8F0',
                      color: copied ? '#FFFFFF' : '#1E293B',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    {copied ? 'Kopyalandı ✓' : 'Kopyala'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                  * Açıklama kısmına okul adınızı yazmayı unutmayınız. Havale/EFT sonrası dekontu WhatsApp hattımıza ilettiğinizde lisansınız dakikalar içinde aktif edilecektir.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
