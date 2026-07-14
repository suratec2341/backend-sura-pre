module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^@blansole/shared$': '<rootDir>/libs/shared/src',
    '^@blansole/shared/(.*)$': '<rootDir>/libs/shared/src/$1',
  },
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.e2e-spec\\.ts$'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
