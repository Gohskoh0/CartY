const { withAppBuildGradle } = require('@expo/config-plugins');

// Renames the output APK from the default random hash name to "CartY-v<version>.apk"
const apkRenameBlock = [
  '',
  '    applicationVariants.all { variant ->',
  '        variant.outputs.all { output ->',
  '            outputFileName = "CartY-v${variant.versionName}.apk"',
  '        }',
  '    }',
  '',
].join('\n');

module.exports = function withApkName(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('outputFileName = "CartY')) {
      return config; // already applied
    }
    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      'android {' + apkRenameBlock
    );
    return config;
  });
};
