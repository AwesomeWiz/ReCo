module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',      // enables:  import { X } from "@env"
          path: '.env',            // path to your .env file
          safe: false,             // set true to enforce .env.example checking
          allowUndefined: false,   // set false so missing vars throw errors early
        },
      ],
    ],
  };
};