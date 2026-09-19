export default function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-12 py-10 px-4 max-w-full overflow-hidden">
      {[1, 2, 3].map((item, idx) => {
        const isLeft = idx % 2 === 0;
        return (
          <div
            key={item}
            className={`flex items-center gap-4 w-full animate-pulse ${
              isLeft ? 'flex-row' : 'flex-row-reverse'
            }`}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: '16px',
              flexDirection: isLeft ? 'row' : 'row-reverse',
            }}
          >
            {/* Circular Plate Skeleton */}
            <div
              style={{
                width: '100px',
                height: '100px',
                minWidth: '100px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(201, 168, 118, 0.1)',
                position: 'relative'
              }}
            >
              {/* Offset Orbit Circle */}
              <div
                style={{
                  position: 'absolute',
                  top: '-4px',
                  left: '-4px',
                  right: '-4px',
                  bottom: '-4px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(201, 168, 118, 0.05)'
                }}
              />
            </div>

            {/* Description Card Skeleton */}
            <div
              style={{
                flexGrow: 1,
                backgroundColor: 'var(--bg-card)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                padding: '16px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Title */}
              <div
                style={{
                  width: '60%',
                  height: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '2px'
                }}
              />
              {/* Subtitle */}
              <div
                style={{
                  width: '35%',
                  height: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '2px'
                }}
              />
              {/* Description */}
              <div
                style={{
                  width: '100%',
                  height: '32px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '2px'
                }}
              />
              {/* Bottom Catalog/Line */}
              <div
                style={{
                  width: '40%',
                  height: '12px',
                  backgroundColor: 'rgba(201, 168, 118, 0.1)',
                  borderRadius: '2px',
                  alignSelf: 'flex-start'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
