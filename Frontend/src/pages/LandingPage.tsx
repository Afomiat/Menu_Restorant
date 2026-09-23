import { useState, useEffect } from 'react';
import { fetchActiveRestaurants, type ActiveTenantInfo } from '../services/menuService';

export default function LandingPage() {
  const [activeRestaurants, setActiveRestaurants] = useState<ActiveTenantInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchActiveRestaurants()
      .then((data) => {
        if (isMounted) {
          setActiveRestaurants(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fallback if backend returned empty list or hasn't responded yet
  const liveTenants: ActiveTenantInfo[] =
    activeRestaurants.length > 0
      ? activeRestaurants
      : [
          {
            id: '11e9c86e-58ee-48ed-a251-b76211f8ea24',
            slug: 'azai-burger',
            name: 'Azai Burger & Bistro',
            plan: 'vip',
            currency: 'ETB',
            is_active: true,
          },
        ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d0f14',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201, 168, 118, 0.12), transparent)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '56px 20px 80px 20px',
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        color: '#f3f4f6',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Background Decorative Rings */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Brand Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '32px',
          textAlign: 'center',
        }}
      >
        <img
          src="/images/aura_logo.svg"
          alt="Aura Logo"
          style={{
            width: '64px',
            height: '64px',
            objectFit: 'contain',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 12px rgba(201, 168, 118, 0.3))',
          }}
        />
        <h1
          style={{
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontSize: 'clamp(32px, 6vw, 46px)',
            fontWeight: 700,
            letterSpacing: '3px',
            color: '#c9a876',
            margin: '0 0 8px 0',
          }}
        >
          AURA DIGITAL MENUS
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: '#9ca3af',
            letterSpacing: '1px',
            margin: '0 0 16px 0',
            maxWidth: '520px',
          }}
        >
          Multi-Tenant Smart Dining Platform & Real-Time Kitchen Display System
        </p>

        {/* Database Status Indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '999px',
            fontSize: '12px',
            color: '#34d399',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
          />
          <span>
            {loading
              ? 'Checking PostgreSQL Tenants...'
              : `Connected to Database: ${liveTenants.length} Registered Tenant (${liveTenants.map((t) => t.name).join(', ')})`}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {/* SECTION 1: LIVE ACTIVE RESTAURANTS (DATABASE CONNECTED) */}
        <div
          style={{
            backgroundColor: '#161922',
            border: '1px solid rgba(201, 168, 118, 0.25)',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #c9a876, #f59e0b, #ef4444)',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '11px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: '#c9a876',
                  fontWeight: 700,
                }}
              >
                LIVE PRODUCTION DATABASE
              </span>
              <h2
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                Registered PostgreSQL Tenants
              </h2>
            </div>
            <span
              style={{
                fontSize: '12px',
                backgroundColor: 'rgba(201, 168, 118, 0.15)',
                color: '#f6d89b',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              1 Tenant Active
            </span>
          </div>

          <p
            style={{
              fontSize: '13px',
              color: '#9ca3af',
              lineHeight: 1.6,
              margin: '0 0 20px 0',
            }}
          >
            This restaurant is persisted in your Supabase PostgreSQL database. All category items, menu prices,
            orders, and staff logins run live against the Go REST & WebSocket backend.
          </p>

          {/* Restaurant Card */}
          {liveTenants.map((tenant) => (
            <div
              key={tenant.id || tenant.slug}
              style={{
                backgroundColor: '#1c202d',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f3f4f6' }}>
                      {tenant.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: tenant.plan === 'vip' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: tenant.plan === 'vip' ? '#f87171' : '#60a5fa',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {tenant.plan.toUpperCase()} TIER
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Slug: <code style={{ color: '#fbbf24' }}>/{tenant.slug}</code> &bull; Currency: {tenant.currency} &bull; Tables & KDS Enabled
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                {/* 1. Browse Customer Menu */}
                <a
                  href={`/${tenant.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#c9a876',
                    color: '#0d0f14',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'opacity 0.2s',
                  }}
                >
                  <span>🍔</span>
                  <span>Browse Live Menu</span>
                </a>

                {/* 2. Dine-In Table QR Simulation */}
                <a
                  href={`/${tenant.slug}?table=1&token=f44ed9e941b7ba1ed0ea22448c8fad4d916ae3be272e3f5f7361412f5ba8e665`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#f3f4f6',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>📱</span>
                  <span>Dine-In Order (Table 1)</span>
                </a>

                {/* 3. Kitchen & Admin Portal */}
                <a
                  href={`/${tenant.slug}/admin`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>👨‍🍳</span>
                  <span>Staff / Kitchen KDS</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* SECTION 2: EXPLANATION BANNER FOR USER */}
        <div
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.07)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#93c5fd',
          }}
        >
          <strong style={{ color: '#bfdbfe', display: 'block', marginBottom: '4px' }}>
            💡 Why do you see multiple restaurants below, but only 1 in the PostgreSQL tenant table?
          </strong>
          In your database, <strong style={{ color: '#ffffff' }}>Azai Burger & Bistro</strong> (<code>azai-burger</code>) is currently the only registered tenant row.
          The options below (<em>Aura</em>, <em>Breath</em>, and <em>Luna</em>) are <strong>offline showcase prototypes</strong> powered by static JSON files (<code>/public/menus/*.json</code>) to demonstrate different theme styles before adding new tenants to PostgreSQL.
        </div>

        {/* SECTION 3: OFFLINE DEMO PROTOTYPES (Aura, Breath, Luna) */}
        <div
          style={{
            backgroundColor: '#161922',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px 28px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#6b7280',
                fontWeight: 700,
              }}
            >
              OFFLINE THEME PROTOTYPES
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 600, color: '#d1d5db' }}>
              Design Templates & Mock Showcases
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '6px 0 0 0' }}>
              These demo templates load instantly from local JSON mocks without hitting PostgreSQL:
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {/* Aura Card */}
            <div
              style={{
                backgroundColor: '#1c202d',
                border: '1px solid rgba(201, 168, 118, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c9a876' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#c9a876' }}>Aura</span>
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Fine Dining & Classic Gold</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="/aura"
                  style={{
                    fontSize: '12px',
                    color: '#c9a876',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  View Menu &rarr;
                </a>
                <a
                  href="/aura/admin"
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    textDecoration: 'none',
                  }}
                >
                  Admin
                </a>
              </div>
            </div>

            {/* Breath Card */}
            <div
              style={{
                backgroundColor: '#1c202d',
                border: '1px solid rgba(255, 90, 54, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff5a36' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#ff7a59' }}>Breath</span>
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Fast-Casual & Modern Coral</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="/breath"
                  style={{
                    fontSize: '12px',
                    color: '#ff7a59',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  View Menu &rarr;
                </a>
                <a
                  href="/breath/admin"
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    textDecoration: 'none',
                  }}
                >
                  Admin
                </a>
              </div>
            </div>

            {/* Luna Card */}
            <div
              style={{
                backgroundColor: '#1c202d',
                border: '1px solid rgba(13, 148, 136, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d9488' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#2dd4bf' }}>Luna</span>
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Lounge / Cafe & Modern Teal</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="/luna"
                  style={{
                    fontSize: '12px',
                    color: '#2dd4bf',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  View Menu &rarr;
                </a>
                <a
                  href="/luna/admin"
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    textDecoration: 'none',
                  }}
                >
                  Admin
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#6b7280',
          }}
        >
          Azai Multi-Tenant Restaurant System
        </span>
      </div>
    </div>
  );
}
