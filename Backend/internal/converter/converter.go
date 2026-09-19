package converter

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func UUIDToPg(id uuid.UUID) pgtype.UUID {
	if id == uuid.Nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: id, Valid: true}
}

func PgToUUID(p pgtype.UUID) uuid.UUID {
	if !p.Valid {
		return uuid.Nil
	}
	return uuid.UUID(p.Bytes)
}

func FloatToNumeric(val float64) pgtype.Numeric {
	var num pgtype.Numeric
	_ = num.Scan(fmt.Sprintf("%.2f", val))
	return num
}

func NumericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func TimeToPg(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: !t.IsZero()}
}

func PgToTime(t pgtype.Timestamptz) time.Time {
	if !t.Valid {
		return time.Time{}
	}
	return t.Time
}

func StringToText(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}

func TextToString(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}
