// Jest setup for the jest-expo preset. AsyncStorage is a native module with no
// JS implementation under Jest, so swap in its official in-memory mock. Any test
// that imports the Supabase client (which persists sessions to AsyncStorage) needs this.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
