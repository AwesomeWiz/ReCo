const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .tflite model files
const { assetExts, sourceExts } = config.resolver;
config.resolver.assetExts = [...assetExts, "tflite"];

module.exports = config;
