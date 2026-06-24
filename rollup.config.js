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
      {
        file: 'www/dynamoblobs.min.js',
        format: 'umd',
        name: 'Dynamoblobs',
        plugins: [terser()],
      },
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
    ],
    plugins: [dts()],
  },
];
