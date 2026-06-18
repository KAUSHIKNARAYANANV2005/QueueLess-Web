const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

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

const wb = xlsx.utils.book_new();
const wsData = xlsx.utils.json_to_sheet(rows);
xlsx.utils.book_append_sheet(wb, wsData, "Test Results");

const summaryRows = [
  {"Metric": "Total Test Cases", "Value": testCases.length},
  {"Metric": "Passed", "Value": passedCount},
  {"Metric": "Failed", "Value": failedCount},
  {"Metric": "Pass Percentage", "Value": passPercentage + "%"},
  {"Metric": "Overall Average RPS", "Value": overallAvgRPS},
  {"Metric": "Overall Average Response Time (ms)", "Value": overallAvgResponse},
  {"Metric": "Overall Status", "Value": overallStatus}
];
const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
xlsx.utils.book_append_sheet(wb, wsSummary, "Summary");

xlsx.writeFile(wb, excelFile);

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 10px; border: 1px solid #ddd; } .pass { color: green; } .fail { color: red; }</style></head>
<body>
    <h1>QueueLess Load Test Report (100 VUs / 1 min)</h1>
    <p>Total: ${testCases.length} | Passed: ${passedCount} | Failed: ${failedCount} | Pass Rate: ${passPercentage}% | Avg RPS: ${overallAvgRPS} | Avg Time: ${overallAvgResponse}ms</p>
    <table>
        <tr><th>Test Case</th><th>Category</th><th>RPS</th><th>Avg (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Result</th></tr>
        ${rows.map(r => `<tr><td>${r["Test Case"]}</td><td>${r["Category"]}</td><td>${r["Requests Per Second (RPS)"]}</td><td>${r["Average Response Time (ms)"]}</td><td>${r["Min Response Time (ms)"]}</td><td>${r["Max Response Time (ms)"]}</td><td class="${r["Result"] === 'PASS' ? 'pass' : 'fail'}">${r["Result"]}</td></tr>`).join('')}
    </table>
</body>
</html>`;
fs.writeFileSync(htmlFile, htmlContent);
fs.copyFileSync(summaryFile, path.join(outputDir, 'metrics.json'));
