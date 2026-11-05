package config

import (
	"fmt"
	"log"
	"net/url"

	"github.com/spf13/viper"
)

type Config struct {
	DBUrl       string `mapstructure:"DB_URL"`
	ServerPort  string `mapstructure:"PORT"`
	Environment string `mapstructure:"ENVIRONMENT"`
	QRSecretKey string `mapstructure:"QR_SECRET_KEY"`
	JWTSecret   string `mapstructure:"JWT_SECRET"`
	FrontendURL string `mapstructure:"FRONTEND_URL"`

	// Cloudinary Media Storage
	CloudinaryCloudName string `mapstructure:"CLOUDINARY_CLOUD_NAME"`
	CloudinaryAPIKey    string `mapstructure:"CLOUDINARY_API_KEY"`
	CloudinaryAPISecret string `mapstructure:"CLOUDINARY_API_SECRET"`

	// Web push for staff phones (make vapid); empty keys turn push off
	VAPIDPublicKey  string `mapstructure:"VAPID_PUBLIC_KEY"`
	VAPIDPrivateKey string `mapstructure:"VAPID_PRIVATE_KEY"`
	VAPIDSubject    string `mapstructure:"VAPID_SUBJECT"`
}

// LoadConfig reads configuration from .env, then .env.local, then environment variables.
// .env.local is never committed; developers use it to point at a local database.
func LoadConfig(path string) (*Config, error) {
	v := viper.New()
	v.AddConfigPath(path)
	v.SetConfigName(".env")
	v.SetConfigType("env")

	v.AutomaticEnv()

	// Explicitly bind environment variables for containerized / 12-factor deployment
	_ = v.BindEnv("DB_URL")
	_ = v.BindEnv("PORT")
	_ = v.BindEnv("ENVIRONMENT")
	_ = v.BindEnv("QR_SECRET_KEY")
	_ = v.BindEnv("JWT_SECRET")
	_ = v.BindEnv("FRONTEND_URL")
	_ = v.BindEnv("CLOUDINARY_CLOUD_NAME")
	_ = v.BindEnv("CLOUDINARY_API_KEY")
	_ = v.BindEnv("CLOUDINARY_API_SECRET")
	_ = v.BindEnv("VAPID_PUBLIC_KEY")
	_ = v.BindEnv("VAPID_PRIVATE_KEY")
	_ = v.BindEnv("VAPID_SUBJECT")

	// Default fallback values
	v.SetDefault("PORT", "8080")
	v.SetDefault("ENVIRONMENT", "development")
	v.SetDefault("QR_SECRET_KEY", "azai-restaurant-menu-qr-secret-key-32-chars")
	v.SetDefault("JWT_SECRET", "azai-restaurant-jwt-secret-key-32-chars")
	v.SetDefault("FRONTEND_URL", "http://localhost:5173")
	v.SetDefault("VAPID_SUBJECT", "mailto:support@azai.et")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			log.Printf("Notice: error reading .env file: %v. Using defaults and environment variables.", err)
		}
	}

	v.SetConfigName(".env.local")
	if err := v.MergeInConfig(); err == nil {
		log.Printf("Using .env.local overrides (DB host: %s)", dbHost(v.GetString("DB_URL")))
	} else if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
		log.Printf("Notice: error reading .env.local file: %v. Ignoring it.", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// Production Hardening: Fail fast on missing or insecure secrets
	if cfg.Environment == "production" {
		if cfg.DBUrl == "" {
			return nil, logFatalOrErr("FATAL: DB_URL environment variable is required in production")
		}
		if cfg.JWTSecret == "" || cfg.JWTSecret == "azai-restaurant-jwt-secret-key-32-chars" {
			return nil, logFatalOrErr("FATAL: secure non-default JWT_SECRET environment variable is required in production")
		}
		if cfg.QRSecretKey == "" || cfg.QRSecretKey == "azai-restaurant-menu-qr-secret-key-32-chars" {
			return nil, logFatalOrErr("FATAL: secure non-default QR_SECRET_KEY environment variable is required in production")
		}
	}

	return &cfg, nil
}

// dbHost returns the host of a database URL without its password, for logs
func dbHost(dbURL string) string {
	u, err := url.Parse(dbURL)
	if err != nil {
		return "unknown"
	}
	return u.Host
}

func logFatalOrErr(msg string) error {
	log.Printf("[SECURITY] %s", msg)
	return fmt.Errorf("%s", msg)
}
