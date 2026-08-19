export const initializeApp = () => ({});
export const cert = () => ({});
export const getApps = () => [{}];
export const getAuth = () => ({
  verifyIdToken: async () => ({ email: "test@example.com", name: "Test User" }),
});

export default {
  initializeApp,
  cert,
  getApps,
  getAuth,
};
