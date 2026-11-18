package controller

import (
    "bytes"
    "errors"
    "log"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
)

func TestWriteBillError_LogsUnderlyingError(t *testing.T) {
    // Capture log output
    var logBuf bytes.Buffer
    log.SetOutput(&logBuf)
    defer log.SetOutput(nil) // reset after test

    // Create a Gin context with a recorder
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

    // Call the helper with a generic error
    writeBillError(c, errors.New("simulated db error"))

    // Verify HTTP status code and body
    if w.Code != http.StatusInternalServerError {
        t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, w.Code)
    }
    expectedBody := `{"error":"failed to update the bill"}`
    if body := w.Body.String(); body != expectedBody {
        t.Fatalf("unexpected response body: %s", body)
    }

    // Verify log contains the expected message
    if !bytes.Contains(logBuf.Bytes(), []byte("bill/problem error: simulated db error")) {
        t.Fatalf("log does not contain expected error message, got: %s", logBuf.String())
    }
}
