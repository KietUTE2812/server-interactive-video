module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test directories
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.js'],

    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'controllers/**/*.js',
        'models/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/tests/**'
    ],

    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        },
        './controllers/': {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85
        }
    },

    // Test timeout
    testTimeout: 30000,

    // Clear mocks between tests
    clearMocks: true,

    // Verbose output
    verbose: true,

    // Module file extensions
    moduleFileExtensions: ['js', 'json'],

    // Transform files
    transform: {
        '^.+\\.js$': 'babel-jest'
    },

    // Module name mapping for absolute imports
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@controllers/(.*)$': '<rootDir>/controllers/$1',
        '^@models/(.*)$': '<rootDir>/models/$1',
        '^@utils/(.*)$': '<rootDir>/utils/$1'
    },

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/'
    ]
}; 