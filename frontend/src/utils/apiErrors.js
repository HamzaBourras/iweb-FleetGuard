export const extractErrorMessage = (data, fallback) => {
  const detail = data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const text = detail
      .map((error) => String(error?.msg || '').replace(/^Value error,\s*/i, ''))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }
  return fallback;
};
