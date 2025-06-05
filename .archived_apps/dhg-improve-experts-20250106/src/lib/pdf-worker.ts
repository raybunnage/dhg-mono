import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

console.log('PDF Worker Configuration:', {
  version: pdfjs.version,
  workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
}); 