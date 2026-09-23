import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useRestaurantMenu from '../hooks/useRestaurantMenu';
import { PlanProvider } from '../context/PlanContext';
import SkeletonLoader from '../components/common/SkeletonLoader';
import NotFoundPage from './NotFoundPage';
import ModernMenuPage from '../templates/modern/ModernMenuPage';
import ClassicMenuPage from '../templates/classic/ClassicMenuPage';

export default function MenuPage() {
  const { restaurantName } = useParams<{ restaurantName: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const { meta, categories, items, loading, error, plan } = useRestaurantMenu(restaurantName);
  const slug = restaurantName?.toLowerCase().trim() ?? 'unknown';

  // Dynamic Browser Tab Title
  useEffect(() => {
    if (meta?.name) {
      document.title = `${meta.name} — Menu`;
    } else if (restaurantName) {
      document.title = `${restaurantName} — Menu`;
    } else {
      document.title = 'Azai Digital Menu';
    }
  }, [meta?.name, restaurantName]);

  // Error States
  if (error === 'not-found') {
    return <NotFoundPage />;
  }

  if (error === 'network') {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#121316',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>📡</div>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#c9a876',
            marginBottom: '12px',
            fontStyle: 'italic',
          }}
        >
          Connection Error
        </h2>
        <p
          style={{
            color: '#8a8d9b',
            fontSize: '14px',
            lineHeight: 1.6,
            maxWidth: '320px',
            marginBottom: '24px',
          }}
        >
          We couldn't load the menu. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #c9a876',
            color: '#c9a876',
            padding: '10px 28px',
            borderRadius: '4px',
            fontSize: '13px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading State
  if (loading || !meta) {
    return <SkeletonLoader />;
  }

  // Template Dispatcher
  if (meta.template === 'modern') {
    return (
      <PlanProvider plan={plan}>
        <ModernMenuPage
          meta={meta}
          categories={categories}
          items={items}
          restaurantSlug={slug}
          tableNumber={tableNumber}
        />
      </PlanProvider>
    );
  }

  // Default: Classic Template
  return (
    <PlanProvider plan={plan}>
      <ClassicMenuPage
        meta={meta}
        categories={categories}
        items={items}
        restaurantSlug={slug}
        tableNumber={tableNumber}
      />
    </PlanProvider>
  );
}
