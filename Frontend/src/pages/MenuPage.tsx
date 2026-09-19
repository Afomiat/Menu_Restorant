import { useParams, useSearchParams } from 'react-router-dom';
import useRestaurantMenu from '../hooks/useRestaurantMenu';
import SkeletonLoader from '../components/common/SkeletonLoader';
import NotFoundPage from './NotFoundPage';
import ModernMenuPage from '../templates/modern/ModernMenuPage';
import ClassicMenuPage from '../templates/classic/ClassicMenuPage';

export default function MenuPage() {
  const { restaurantName } = useParams<{ restaurantName: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const { meta, categories, items, loading, error } = useRestaurantMenu(restaurantName);
  const slug = restaurantName?.toLowerCase().trim() ?? 'unknown';

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
      <ModernMenuPage
        meta={meta}
        categories={categories}
        items={items}
        restaurantSlug={slug}
        tableNumber={tableNumber}
      />
    );
  }

  // Default: Classic Template
  return (
    <ClassicMenuPage
      meta={meta}
      categories={categories}
      items={items}
      restaurantSlug={slug}
      tableNumber={tableNumber}
    />
  );
}
