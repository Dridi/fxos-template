{
  appDir: 'src',
  baseUrl: 'js',
  dir: 'dist',
  insertRequire: ['app'],
  name: 'app',
  include: [
    'libs/alameda',
    'config/require',
  ],
  fileExclusionRegExp: /\.swp$/,
  normalizeDirDefines: 'all',
  optimize: 'none',
  keepBuildDir: true,
  removeCombined: true
}
