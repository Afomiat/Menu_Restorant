import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

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
      }}
    >
      {/* Decorative emoji */}
      <div
        style={{
          fontSize: '64px',
          marginBottom: '24px',
          opacity: 0.6,
          animation: 'float 3s ease-in-out infinite',
        }}
      >
        🍽️
      </div>

      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-serif, Georgia, serif)',
          fontSize: 'clamp(28px, 6vw, 42px)',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'var(--accent-gold, #c9a876)',
          marginBottom: '12px',
          letterSpacing: '1px',
        }}
      >
        Restaurant Not Found
      </h1>

      {/* Description */}
      <p
        style={{
          color: 'var(--text-secondary, #8a8d9b)',
          fontSize: '15px',
          lineHeight: 1.6,
          maxWidth: '400px',
          marginBottom: '32px',
        }}
      >
        We couldn't find a menu for this restaurant. 
        Please check the URL or scan the QR code at your table.
      </p>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid var(--accent-gold, #c9a876)',
          color: 'var(--accent-gold, #c9a876)',
          padding: '12px 32px',
          borderRadius: '4px',
          fontFamily: 'var(--font-sans, system-ui)',
          fontSize: '13px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-gold, #c9a876)';
          e.currentTarget.style.color = 'var(--bg-dark, #121316)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--accent-gold, #c9a876)';
        }}
      >
        Go Home
      </button>

      {/* Floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
