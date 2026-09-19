package config

import (
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
}

// LoadConfig reads configuration from .env file or environment variables
func LoadConfig(path string) (*Config, error) {
	viper.AddConfigPath(path)
	viper.SetConfigName(".env")
	viper.SetConfigType("env")

	viper.AutomaticEnv()

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

	return &cfg, nil
}
