export function formatFileSize(bytes: number | string): string {
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  
  if (isNaN(size)) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let filesize = size;
  
  while (filesize >= 1024 && i < units.length - 1) {
    filesize /= 1024;
    i++;
  }
  
  return `${Math.round(filesize * 10) / 10} ${units[i]}`;
} 