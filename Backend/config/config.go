package config

import (
	"fmt"
	"log"

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
}

// LoadConfig reads configuration from .env file or environment variables
func LoadConfig(path string) (*Config, error) {
	viper.AddConfigPath(path)
	viper.SetConfigName(".env")
	viper.SetConfigType("env")

	viper.AutomaticEnv()

	// Explicitly bind environment variables for containerized / 12-factor deployment
	_ = viper.BindEnv("DB_URL")
	_ = viper.BindEnv("PORT")
	_ = viper.BindEnv("ENVIRONMENT")
	_ = viper.BindEnv("QR_SECRET_KEY")
	_ = viper.BindEnv("JWT_SECRET")
	_ = viper.BindEnv("FRONTEND_URL")
	_ = viper.BindEnv("CLOUDINARY_CLOUD_NAME")
	_ = viper.BindEnv("CLOUDINARY_API_KEY")
	_ = viper.BindEnv("CLOUDINARY_API_SECRET")

	// Default fallback values
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("ENVIRONMENT", "development")
	viper.SetDefault("QR_SECRET_KEY", "azai-restaurant-menu-qr-secret-key-32-chars")
	viper.SetDefault("JWT_SECRET", "azai-restaurant-jwt-secret-key-32-chars")
	viper.SetDefault("FRONTEND_URL", "http://localhost:5173")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			log.Printf("Notice: error reading .env file: %v. Using defaults and environment variables.", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
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

func logFatalOrErr(msg string) error {
	log.Printf("[SECURITY] %s", msg)
	return fmt.Errorf("%s", msg)
}
