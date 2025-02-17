import { pdfjs } from 'react-pdf';

// Use the exact version that matches pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js`; 