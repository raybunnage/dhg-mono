import * as pdfjs from 'pdfjs-dist';

// We need to initialize PDF.js only once
let isInitialized = false;

export async function initPdfJs() {
  if (!isInitialized) {
    // Use CDN worker
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    isInitialized = true;
  }
  return pdfjs;
}

export async function processGoogleDrivePDF(pdfBuffer: ArrayBuffer) {
  try {
    const pdfjs = await initPdfJs();
    const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    let content = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      content += textContent.items
        .map((item: any) => item.str)
        .join(' ') + '\n\n';
    }
    
    return content.trim();
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF document: ' + error.message);
  }
} 