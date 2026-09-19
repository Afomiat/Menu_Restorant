export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-dark, #121316)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        fontFamily: 'var(--font-sans, system-ui)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201, 168, 118, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <img
        src="/images/aura_logo.svg"
        alt="Logo"
        style={{
          width: '80px',
          height: '80px',
          objectFit: 'contain',
          marginBottom: '24px',
          opacity: 0.9,
        }}
      />

      {/* Brand name */}
      <h1
        style={{
          fontFamily: 'var(--font-serif, Georgia, serif)',
          fontSize: 'clamp(36px, 8vw, 56px)',
          fontWeight: 500,
          fontStyle: 'italic',
          color: 'var(--accent-gold, #c9a876)',
          letterSpacing: '4px',
          marginBottom: '8px',
          lineHeight: 1.1,
        }}
      >
        AURA
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontFamily: 'var(--font-serif, Georgia, serif)',
          fontSize: 'clamp(14px, 3vw, 18px)',
          fontStyle: 'italic',
          color: 'var(--text-secondary, #8a8d9b)',
          letterSpacing: '3px',
          marginBottom: '40px',
        }}
      >
        Digital Menus, Elevated
      </p>

      {/* Divider */}
      <div
        style={{
          width: '60px',
          height: '1px',
          backgroundColor: 'var(--accent-gold, #c9a876)',
          opacity: 0.3,
          marginBottom: '40px',
        }}
      />

      {/* Instructions */}
      <p
        style={{
          color: 'var(--text-secondary, #8a8d9b)',
          fontSize: '15px',
          lineHeight: 1.8,
          maxWidth: '360px',
          marginBottom: '16px',
        }}
      >
        Scan the <strong style={{ color: 'var(--text-primary, #f2efe9)' }}>QR code</strong> at your table
        to browse the menu and place your order.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'center',
          maxWidth: '440px',
          margin: '20px 0 28px 0',
        }}
      >
        <a
          href="/aura"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            backgroundColor: '#1b1d26',
            border: '1px solid #c9a876',
            borderRadius: '999px',
            color: '#f2efe9',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c9a876' }} />
          Aura (Classic Gold)
        </a>

        <a
          href="/breath"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            backgroundColor: '#1b1d26',
            border: '1px solid #ff5a36',
            borderRadius: '999px',
            color: '#f2efe9',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff5a36' }} />
          Breath (Modern Coral)
        </a>

        <a
          href="/luna"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            backgroundColor: '#1b1d26',
            border: '1px solid #0d9488',
            borderRadius: '999px',
            color: '#f2efe9',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d9488' }} />
          Luna (Modern Teal)
        </a>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <a
          href="/breath/admin"
          style={{
            fontSize: '12px',
            color: '#ff7a59',
            backgroundColor: 'rgba(255, 90, 54, 0.1)',
            border: '1px solid rgba(255, 90, 54, 0.25)',
            padding: '5px 12px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ⚙️ Breath Admin
        </a>
        <a
          href="/luna/admin"
          style={{
            fontSize: '12px',
            color: '#2dd4bf',
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            border: '1px solid rgba(13, 148, 136, 0.25)',
            padding: '5px 12px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ⚙️ Luna Admin
        </a>
        <a
          href="/aura/admin"
          style={{
            fontSize: '12px',
            color: '#dec093',
            backgroundColor: 'rgba(201, 168, 118, 0.1)',
            border: '1px solid rgba(201, 168, 118, 0.25)',
            padding: '5px 12px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ⚙️ Aura Admin
        </a>
      </div>

      <p
        style={{
          color: 'var(--text-secondary, #8a8d9b)',
          fontSize: '13px',
          lineHeight: 1.6,
          maxWidth: '360px',
          opacity: 0.6,
        }}
      >
        If you're a restaurant owner, access your management portal or contact us to get your own digital menu.
      </p>

      {/* Footer branding */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: '10px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--text-secondary, #8a8d9b)',
            opacity: 0.4,
          }}
        >
          Powered by AURA
        </span>
      </div>
    </div>
  );
}
