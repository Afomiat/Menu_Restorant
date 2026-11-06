// Package push sends staff alerts as web push notifications, so a waiter whose phone is locked
// still hears that food is ready or a table asks for the bill.
package push

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"reflect"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"

	"menu-backend/domain"
)

// Message is what the browser shows
type Message struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Event string `json:"event"`
}

// Sender delivers one message to one browser and returns the push service's status code
type Sender func(sub domain.PushSubscription, payload []byte) (int, error)

// Notifier sends every event to the live screens (next), and the alerts below as web push too
type Notifier struct {
	next domain.Notifier
	repo domain.PushRepository
	send Sender
	// sync is for tests: push before returning instead of in the background
	sync bool
}

func NewNotifier(next domain.Notifier, repo domain.PushRepository, send Sender) *Notifier {
	return &Notifier{next: next, repo: repo, send: send}
}

// NewSyncNotifier pushes before returning (tests)
func NewSyncNotifier(next domain.Notifier, repo domain.PushRepository, send Sender) *Notifier {
	return &Notifier{next: next, repo: repo, send: send, sync: true}
}

// messages are the alerts worth waking a locked phone for
var messages = map[string]func(table string) (string, string){
	"order:ready": func(t string) (string, string) { return "Food ready", fmt.Sprintf("Table %s: food is ready", t) },
	"order:very_late": func(t string) (string, string) {
		return "Order very late", fmt.Sprintf("Table %s: cooking for twice its time", t)
	},
	"bill:requested": func(t string) (string, string) { return "Bill asked", fmt.Sprintf("Table %s asks for the bill", t) },
	"bill:reminder": func(t string) (string, string) {
		return "Bill still unpaid", fmt.Sprintf("Table %s: the bill is still unpaid", t)
	},
	"bill:escalated": func(t string) (string, string) {
		return "Unpaid bill", fmt.Sprintf("Table %s: the bill is unpaid for a long time", t)
	},
	"bill:collected": func(t string) (string, string) {
		return "Money to confirm", fmt.Sprintf("Table %s: money collected, please confirm", t)
	},
	"bill:unconfirmed": func(t string) (string, string) {
		return "Not confirmed", fmt.Sprintf("Table %s: collected money not confirmed yet", t)
	},
	"bill:handed_over": func(t string) (string, string) {
		return "Bill handed to you", fmt.Sprintf("Table %s's bill is now yours", t)
	},
	"table:long_open": func(t string) (string, string) {
		return "Table open long", fmt.Sprintf("Table %s has been open a long time", t)
	},
	"table:open_bill_rescanned": func(t string) (string, string) {
		return "Unpaid table", fmt.Sprintf("New customers at table %s, but its bill is unpaid", t)
	},
	"shift:open_bills": func(string) (string, string) {
		return "Unpaid bills", "A waiter tried to end their shift with unpaid bills"
	},
	"problem:reported": func(t string) (string, string) {
		return "Problem with a dish", fmt.Sprintf("Table %s reported a problem", t)
	},
	"walkout:marked": func(t string) (string, string) { return "Walkout", fmt.Sprintf("Table %s left without paying", t) },
}

// MessageFor returns the push message for an event, or false when the event is not pushed
func MessageFor(event string, data interface{}) (Message, bool) {
	build, ok := messages[event]
	if !ok {
		return Message{}, false
	}
	title, body := build(tableNumber(data))
	return Message{Title: title, Body: body, Event: event}, true
}

func (n *Notifier) NotifyStaff(tenantID uuid.UUID, to domain.Audience, event string, data interface{}) {
	n.next.NotifyStaff(tenantID, to, event, data)
	msg, ok := MessageFor(event, data)
	if !ok {
		return
	}
	if n.sync {
		n.push(tenantID, to, msg)
		return
	}
	go n.push(tenantID, to, msg)
}

func (n *Notifier) push(tenantID uuid.UUID, to domain.Audience, msg Message) {
	ctx := context.Background()
	subs, err := n.repo.For(ctx, tenantID, to)
	if err != nil {
		log.Printf("push: %v", err)
		return
	}
	payload, _ := json.Marshal(msg)
	for _, sub := range subs {
		status, err := n.send(sub, payload)
		if err != nil {
			log.Printf("push: %v", err)
			continue
		}
		// The browser unsubscribed or the subscription expired: forget it
		if status == http.StatusNotFound || status == http.StatusGone {
			_ = n.repo.Delete(ctx, sub.Endpoint)
		}
	}
}

// WebPushSender sends with the restaurant platform's VAPID keys
func WebPushSender(publicKey, privateKey, subject string) Sender {
	return func(sub domain.PushSubscription, payload []byte) (int, error) {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      subject,
			VAPIDPublicKey:  publicKey,
			VAPIDPrivateKey: privateKey,
			TTL:             300,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			return 0, err
		}
		defer resp.Body.Close()
		return resp.StatusCode, nil
	}
}

// tableNumber reads "table_number" from an event's data (any map type)
func tableNumber(data interface{}) string {
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	switch v.Kind() {
	case reflect.Map:
		if t := v.MapIndex(reflect.ValueOf("table_number")); t.IsValid() {
			return fmt.Sprint(t.Interface())
		}
	case reflect.Struct:
		if f := v.FieldByName("TableNumber"); f.IsValid() {
			return fmt.Sprint(f.Interface())
		}
	}
	return ""
}
