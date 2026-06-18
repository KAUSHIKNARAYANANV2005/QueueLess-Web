const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const summaryFile = path.join(__dirname, 'summary.json');
const outputDir = path.join(__dirname, '../../load-test-reports');
const excelFile = path.join(outputDir, 'Load_Test_Report.xlsx');
const htmlFile = path.join(outputDir, 'Load_Test_Report.html');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));

const testCases = [];
for (let i = 1; i <= 100; i++) {
  let category, name, threshold;
  if (i <= 20) { category = 'Page Load Performance'; name = 'Page Load Simulation ' + i; threshold = 1500; }
  else if (i <= 40) { category = 'Web Vitals'; name = 'Web Vital Proxy ' + i; threshold = 2000; }
  else if (i <= 60) { category = 'Asset Performance'; name = 'Asset Load ' + i; threshold = 1000; }
  else if (i <= 80) { category = 'Application Performance'; name = 'App Interaction ' + i; threshold = 1200; }
  else { category = 'Firebase Performance'; name = 'Firebase API Call ' + i; threshold = 2500; }
  
  testCases.push({ id: 'tc_' + i, name, category, threshold });
}

let passedCount = 0, failedCount = 0, totalAvgResponseTime = 0, totalRps = 0;
const testDurationSec = 60;

const rows = testCases.map(tc => {
  const metric = summary.metrics[tc.id];
  let avg = 0, min = 0, max = 0, count = 0, rps = 0;
  if (metric && metric.values) {
    avg = metric.values.avg || 0;
    min = metric.values.min || 0;
    max = metric.values.max || 0;
    count = metric.values.count || 0;
    rps = count / testDurationSec;
  }
  
  const passed = avg <= tc.threshold && count > 0;
  if (passed) passedCount++; else failedCount++;
  
  totalAvgResponseTime += avg;
  totalRps += rps;
  
  return {
    "Test Case": tc.name,
    "Category": tc.category,
    "Requests Per Second (RPS)": parseFloat(rps.toFixed(2)),
    "Average Response Time (ms)": parseFloat(avg.toFixed(2)),
    "Min Response Time (ms)": parseFloat(min.toFixed(2)),
    "Max Response Time (ms)": parseFloat(max.toFixed(2)),
    "Threshold": tc.threshold,
    "Result": passed ? "PASS" : "FAIL",
    "Status": passed ? "Healthy" : "Needs Optimization"
  };
});

const passPercentage = ((passedCount / testCases.length) * 100).toFixed(2);
const overallAvgResponse = (totalAvgResponseTime / testCases.length).toFixed(2);
const overallAvgRPS = (totalRps / testCases.length).toFixed(2);
const overallStatus = passPercentage >= 90 ? "PASS" : "FAIL";

async function generateReports() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Load Testing Pipeline';

  // 1. SUMMARY SHEET (First Sheet)
  const wsSummary = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF00B0F0' } } });
  wsSummary.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 25 }
  ];

  // Style Summary Header
  wsSummary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsSummary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };

  const summaryRows = [
    { metric: "Total Test Cases", value: testCases.length },
    { metric: "Passed", value: passedCount },
    { metric: "Failed", value: failedCount },
    { metric: "Pass Percentage", value: passPercentage + "%" },
    { metric: "Overall Average RPS", value: overallAvgRPS },
    { metric: "Overall Average Response Time (ms)", value: overallAvgResponse },
    { metric: "Overall Status", value: overallStatus }
  ];

  summaryRows.forEach(row => {
    const r = wsSummary.addRow(row);
    r.font = { size: 12 };
    // Highlight Final Status Row
    if (row.metric === "Overall Status") {
      r.font = { bold: true, color: { argb: row.value === 'PASS' ? 'FF008000' : 'FFFF0000' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.value === 'PASS' ? 'FFD4EDDA' : 'FFF8D7DA' } };
    }
  });


  // 2. TEST CASES SHEET (Second Sheet)
  const wsData = workbook.addWorksheet('Test Cases', { properties: { tabColor: { argb: 'FF92D050' } } });
  wsData.columns = [
    { header: 'Test Case', key: 'test_case', width: 35 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Requests Per Second (RPS)', key: 'rps', width: 25 },
    { header: 'Average Response Time (ms)', key: 'avg', width: 28 },
    { header: 'Min Response Time (ms)', key: 'min', width: 25 },
    { header: 'Max Response Time (ms)', key: 'max', width: 25 },
    { header: 'Threshold', key: 'threshold', width: 15 },
    { header: 'Result', key: 'result', width: 15 },
    { header: 'Status', key: 'status', width: 20 }
  ];

  // Style Data Header
  wsData.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsData.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

  rows.forEach(rowData => {
    const r = wsData.addRow({
      test_case: rowData["Test Case"],
      category: rowData["Category"],
      rps: rowData["Requests Per Second (RPS)"],
      avg: rowData["Average Response Time (ms)"],
      min: rowData["Min Response Time (ms)"],
      max: rowData["Max Response Time (ms)"],
      threshold: rowData["Threshold"],
      result: rowData["Result"],
      status: rowData["Status"]
    });

    // Style the Result Column (PASS = Green, FAIL = Red)
    const resultCell = r.getCell('result');
    if (resultCell.value === 'PASS') {
      resultCell.font = { bold: true, color: { argb: 'FF008000' } }; // Dark Green text
      resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }; // Light Green BG
    } else {
      resultCell.font = { bold: true, color: { argb: 'FFFF0000' } }; // Red text
      resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }; // Light Red BG
    }
    
    // Formatting numbers with 2 decimals
    r.getCell('rps').numFmt = '0.00';
    r.getCell('avg').numFmt = '0.00';
    r.getCell('min').numFmt = '0.00';
    r.getCell('max').numFmt = '0.00';
  });

  // Borders for all populated cells in Test Cases
  wsData.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });
  });

  wsSummary.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });
  });

  await workbook.xlsx.writeFile(excelFile);

  // 3. HTML REPORT
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 10px; border: 1px solid #ddd; } .pass { color: green; font-weight: bold; background-color: #d4edda; } .fail { color: red; font-weight: bold; background-color: #f8d7da; } th { background-color: #2c3e50; color: white; }</style></head>
<body>
    <h1>QueueLess Load Test Report (100 VUs / 1 min)</h1>
    <p>Total: ${testCases.length} | Passed: ${passedCount} | Failed: ${failedCount} | Pass Rate: ${passPercentage}% | Avg RPS: ${overallAvgRPS} | Avg Time: ${overallAvgResponse}ms</p>
    <table>
        <tr><th>Test Case</th><th>Category</th><th>RPS</th><th>Avg (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Threshold</th><th>Result</th></tr>
        ${rows.map(r => `<tr><td>${r["Test Case"]}</td><td>${r["Category"]}</td><td>${r["Requests Per Second (RPS)"]}</td><td>${r["Average Response Time (ms)"]}</td><td>${r["Min Response Time (ms)"]}</td><td>${r["Max Response Time (ms)"]}</td><td>${r["Threshold"]}</td><td class="${r["Result"] === 'PASS' ? 'pass' : 'fail'}">${r["Result"]}</td></tr>`).join('')}
    </table>
</body>
</html>`;
  fs.writeFileSync(htmlFile, htmlContent);
  fs.copyFileSync(summaryFile, path.join(outputDir, 'metrics.json'));
}

generateReports().catch(err => {
  console.error(err);
  process.exit(1);
});
