// Package phone turns the ways Ethiopian staff write a mobile number into one stored form.
package phone

import (
	"errors"
	"strings"
)

var ErrInvalid = errors.New("enter an Ethiopian mobile number, for example 0911 234 567")

// Normalize returns the number as +2519XXXXXXXX or +2517XXXXXXXX.
// It accepts 0911234567, 911234567, 251911234567 and +251 91 123 4567 (spaces, dashes and
// brackets are ignored). Mobile numbers start with 9 (Ethio telecom) or 7 (Safaricom).
func Normalize(raw string) (string, error) {
	var b strings.Builder
	for i, r := range strings.TrimSpace(raw) {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '+' && i == 0:
		case r == ' ' || r == '-' || r == '(' || r == ')' || r == '.':
		default:
			return "", ErrInvalid
		}
	}
	digits := b.String()

	switch {
	case len(digits) == 12 && strings.HasPrefix(digits, "251"):
		digits = digits[3:]
	case len(digits) == 10 && strings.HasPrefix(digits, "0"):
		digits = digits[1:]
	}

	if len(digits) != 9 || (digits[0] != '9' && digits[0] != '7') {
		return "", ErrInvalid
	}
	return "+251" + digits, nil
}
