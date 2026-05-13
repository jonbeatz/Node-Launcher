/**
 * Next config — static export for Electron production (file://) loads.
 * assetPrefix './' only during production build so dev server HMR stays correct.
 * @param {string} phase
 */
export default function msc_createNextConfig(phase) {
  const isProdBuild = phase === 'phase-production-build';
  return {
    output: 'export',
    images: {
      unoptimized: true,
    },
    ...(isProdBuild ? { assetPrefix: './' } : {}),
  };
}
