import XLSX from 'xlsx';

const reportPath = './reports/web-test-report.xlsx';
const workbook = XLSX.readFile(reportPath);
const sheetName = workbook.SheetNames[1]; // 'Test Cases'
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('--- Test Cases Remarks & Status ---');
data.forEach(row => {
  if (row['Test Case ID'] && (row['Test Case ID'].includes('CUST') || row['Test Case ID'].includes('BIZ') || row['Test Case ID'].includes('AUTH'))) {
    console.log(`${row['Test Case ID']}: Status=${row['Status']}, Remarks="${row['Remarks']}", ActualResult="${row['Expected Result'] || ''} | ${row['Actual Result'] || ''}", ExecutionTime=${row['Execution Time (ms)']}`);
  }
});
