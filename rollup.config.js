import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  // Main JavaScript bundle
  {
    input: 'src/dynamoblobs.js',
    output: [
      {
        file: 'dist/dynamoblobs.js',
        format: 'umd',
        name: 'Dynamoblobs',
      },
      {
        file: 'dist/dynamoblobs.min.js',
        format: 'umd',
        name: 'Dynamoblobs',
        plugins: [terser()],
      },
      { file: 'dist/dynamoblobs.esm.js', format: 'es' },
      { file: 'dist/dynamoblobs.cjs', format: 'cjs', exports: 'named' },
    ],
  },
  // Types bundle
  {
    input: './src/dynamoblobs.d.ts',
    output: [
      {
        file: 'dist/dynamoblobs.d.ts',
        format: 'es',
      },
      {
        file: 'dist/dynamoblobs.d.mts',
        format: 'es',
      },
      {
        file: 'dist/dynamoblobs.d.cts',
        format: 'es',
      },
    ],
    plugins: [dts()],
  },
];
