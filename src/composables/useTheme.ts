import { ref, watchEffect } from 'vue';

export function useTheme() {
  const isDarkMode = ref(false);

  // Check for saved theme in localStorage or user's OS preference
  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark';
    } else {
      isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  };

  // Watch for changes in isDarkMode and apply/remove the 'dark' class
  watchEffect(() => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  });

  initializeTheme();

  return {
    isDarkMode,
  };
}
