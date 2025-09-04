import fs from 'fs';
import { generateCalibrationPdf } from './pdfRenderer';
import layout from './invoiceLayout.mendoza';

(async () => {
  const outputDir = 'test-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  await generateCalibrationPdf('templates/MiFondo-pagado.jpg', `${outputDir}/calibration.pdf`, {
    rectWidthMM: 40,
    rectHeightMM: 6,
    config: layout,
  });

  console.log('Calibration PDF generado en test-output/calibration.pdf');
})();


