package usecase

import (
	"context"
	"log"
	"time"

	"menu-backend/domain"
)

// How often the server looks for orders that need an alert. It runs on the server, so alerts
// go out even when nobody has a screen open.
const watchInterval = 30 * time.Second

// KitchenWatcher alerts managers about Pro orders that have cooked for twice their target
type KitchenWatcher struct {
	orderRepo domain.OrderRepository
	notifier  domain.Notifier
}

func NewKitchenWatcher(orderRepo domain.OrderRepository, notifier domain.Notifier) *KitchenWatcher {
	return &KitchenWatcher{orderRepo: orderRepo, notifier: notifier}
}

// Run checks every 30 seconds until ctx is cancelled
func (w *KitchenWatcher) Run(ctx context.Context) {
	ticker := time.NewTicker(watchInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := w.CheckOnce(ctx, now); err != nil {
				log.Printf("kitchen watcher: %v", err)
			}
		}
	}
}

// CheckOnce sends one "order:very_late" alert to the managers for each order cooking for twice
// its target. Each order is alerted about once, even after a restart.
func (w *KitchenWatcher) CheckOnce(ctx context.Context, now time.Time) error {
	late, err := w.orderRepo.ListVeryLate(ctx, now)
	if err != nil {
		return err
	}
	for _, o := range late {
		if err := w.orderRepo.MarkVeryLateAlerted(ctx, o.ID); err != nil {
			return err
		}
		w.notifier.NotifyStaff(o.TenantID, domain.Audience{Roles: []domain.Role{domain.RoleManager}}, "order:very_late", map[string]interface{}{
			"order_id":        o.ID,
			"table_number":    o.TableNumber,
			"target_minutes":  o.TargetMinutes,
			"cooking_minutes": int(now.Sub(o.StartedAt).Minutes()),
		})
	}
	return nil
}
