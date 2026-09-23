package middleware

import (
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientBucket struct {
	tokens     float64
	lastRefill time.Time
}

// MemoryRateLimiter implements a thread-safe token bucket rate limiter with automatic stale key eviction
type MemoryRateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*clientBucket
	capacity float64
	rate     float64 // tokens added per second
	ttl      time.Duration
}

// NewRateLimiter initializes a rate limiter with a given burst capacity and replenishment window
func NewRateLimiter(limit int, window time.Duration) *MemoryRateLimiter {
	capacity := float64(limit)
	rate := capacity / window.Seconds()
	if rate <= 0 {
		rate = 1.0
	}

	limiter := &MemoryRateLimiter{
		buckets:  make(map[string]*clientBucket),
		capacity: capacity,
		rate:     rate,
		ttl:      window * 2,
	}

	// Background sweeper to prune stale IPs and prevent memory growth
	go func() {
		ticker := time.NewTicker(3 * time.Minute)
		for range ticker.C {
			limiter.mu.Lock()
			now := time.Now()
			for ip, b := range limiter.buckets {
				if now.Sub(b.lastRefill) > limiter.ttl {
					delete(limiter.buckets, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

// Limit returns a Gin middleware that enforces the rate limit per client IP
func (l *MemoryRateLimiter) Limit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if ip == "" {
			ip = "unknown"
		}

		l.mu.Lock()
		now := time.Now()
		bucket, exists := l.buckets[ip]
		if !exists {
			bucket = &clientBucket{
				tokens:     l.capacity,
				lastRefill: now,
			}
			l.buckets[ip] = bucket
		}

		// Calculate replenishment
		elapsed := now.Sub(bucket.lastRefill).Seconds()
		bucket.tokens = math.Min(l.capacity, bucket.tokens+(elapsed*l.rate))
		bucket.lastRefill = now

		if bucket.tokens >= 1.0 {
			bucket.tokens -= 1.0
			l.mu.Unlock()
			c.Next()
			return
		}

		l.mu.Unlock()
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
			"error":       "Rate limit exceeded. Please wait a moment before trying again.",
			"retry_after": 2,
		})
	}
}
