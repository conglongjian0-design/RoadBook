// Browser preview shares the exact mini program demo repository, never real WeChat identity.
window.wx = {
  getStorageSync(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || undefined;
    } catch {
      return undefined;
    }
  },
  setStorageSync(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeStorageSync(key) {
    localStorage.removeItem(key);
  },
  showToast({ title }) {
    window.toast(title);
  },
  navigateTo() {
    location.hash = '#profile';
  },
};
