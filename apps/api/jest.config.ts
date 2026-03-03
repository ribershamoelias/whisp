import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      lines: 0,
      branches: 0
    },
    './src/modules/auth/**/*.ts': {
      lines: 90,
      branches: 90
    },
    './src/modules/identity/**/*.ts': {
      lines: 90,
      branches: 90
    },
    './src/modules/relay/**/*.ts': {
      lines: 90,
      branches: 90
    }
  },
  coverageDirectory: 'coverage',
  testEnvironment: 'node'
};

export default config;
