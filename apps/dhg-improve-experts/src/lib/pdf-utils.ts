import * as pdfjs from 'pdfjs-dist';

// We need to initialize PDF.js only once
let isInitialized = false;

export async function initPdfJs() {
  if (!isInitialized) {
    // Set worker source to a blob URL
    const workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString();
    
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    isInitialized = true;
  }
  return pdfjs;
} 