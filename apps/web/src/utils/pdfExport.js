const baseURL = import.meta.env.VITE_API_URL || '/api';

export async function downloadPdf(path, params = {}, filename = 'rapport.pdf') {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== ''),
    ),
  ).toString();

  const url = `${baseURL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    credentials: 'include',
  });

  if (!res.ok) {
    let message = 'Erreur export PDF';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
