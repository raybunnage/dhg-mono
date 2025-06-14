// Mock fs module for tests
module.exports = {
  existsSync: jest.fn(),
  readFileSync: jest.fn()
};