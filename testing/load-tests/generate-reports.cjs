const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const summaryFile = path.join(__dirname, 'summary.json');
const outputDir = path.join(__dirname, '../../load-test-reports');
const excelFile = path.join(outputDir, 'Load_Test_Report.xlsx');
const htmlFile = path.join(outputDir, 'Load_Test_Report.html');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(summaryFile)) {
  console.error("Error: summary.json not found. Did k6 run successfully?");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));

// Test Cases Mapping
const testCases = [
  // Category 1
  { id: 'auth_pages_load', name: 'Auth Pages Load (Login/Signup)', category: 'Page Load Performance', threshold: 1500 },
  { id: 'customer_queue_page_load', name: 'Customer Queue Status Page Load', category: 'Page Load Performance', threshold: 1500 },
  { id: 'business_dashboard_load', name: 'Business Dashboard Load', category: 'Page Load Performance', threshold: 2000 },
  { id: 'admin_dashboard_load', name: 'Admin Dashboard Load', category: 'Page Load Performance', threshold: 2000 },
  { id: 'shared_components_load', name: 'Shared Components Load', category: 'Page Load Performance', threshold: 1000 },
  
  // Category 2
  { id: 'first_contentful_paint_proxy', name: 'First Contentful Paint', category: 'Web Vitals', threshold: 1800 },
  { id: 'largest_contentful_paint_proxy', name: 'Largest Contentful Paint', category: 'Web Vitals', threshold: 2500 },
  { id: 'speed_index_proxy', name: 'Speed Index', category: 'Web Vitals', threshold: 3400 },
  { id: 'total_blocking_time_proxy', name: 'Total Blocking Time', category: 'Web Vitals', threshold: 200 },
  { id: 'cumulative_layout_shift_proxy', name: 'Cumulative Layout Shift', category: 'Web Vitals', threshold: 100 }, // Scaled for proxy (ms/score)
  
  // Category 3
  { id: 'css_load_performance', name: 'CSS Load Performance', category: 'Asset Performance', threshold: 500 },
  { id: 'js_bundle_load', name: 'JavaScript Bundle Load', category: 'Asset Performance', threshold: 1500 },
  { id: 'image_load_performance', name: 'Image Load Performance', category: 'Asset Performance', threshold: 2000 },
  { id: 'font_load_performance', name: 'Font Load Performance', category: 'Asset Performance', threshold: 800 },
  { id: 'manifest_load_performance', name: 'Vite App Manifest Load Performance', category: 'Asset Performance', threshold: 300 },
  
  // Category 4
  { id: 'route_navigation_performance', name: 'Route Navigation Performance', category: 'Application Performance', threshold: 1000 },
  { id: 'component_render_performance', name: 'Component Render Performance', category: 'Application Performance', threshold: 500 },
  { id: 'dashboard_refresh_performance', name: 'Dashboard Refresh Performance', category: 'Application Performance', threshold: 1500 },
  { id: 'local_storage_performance', name: 'Local Storage Performance', category: 'Application Performance', threshold: 100 },
  { id: 'session_initialization_performance', name: 'Session Initialization Performance', category: 'Application Performance', threshold: 1000 },
  
  // Category 5
  { id: 'firebase_authentication_response_time', name: 'Authentication Response Time', category: 'Firebase Performance', threshold: 2500 },
  { id: 'firestore_read_performance', name: 'Firestore Read Performance', category: 'Firebase Performance', threshold: 1500 },
  { id: 'firestore_write_performance', name: 'Firestore Write Performance', category: 'Firebase Performance', threshold: 2000 },
  { id: 'realtime_listener_performance', name: 'Realtime Listener Performance', category: 'Firebase Performance', threshold: 1000 },
  { id: 'data_refresh_performance', name: 'Data Refresh Performance', category: 'Firebase Performance', threshold: 2000 },
];

let passedCount = 0;
let failedCount = 0;
let totalAvgResponseTime = 0;
let totalRps = 0;
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
  
  const passed = avg <= tc.threshold;
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
const overallStatus = passedCount === testCases.length ? "PASS" : "FAIL";

// 1. Generate Excel Report
const wb = xlsx.utils.book_new();

// Details Sheet
const wsData = xlsx.utils.json_to_sheet(rows);
xlsx.utils.book_append_sheet(wb, wsData, "Test Results");

// Summary Sheet
const summaryRows = [
  {"Metric": "Total Test Cases", "Value": testCases.length},
  {"Metric": "Passed", "Value": passedCount},
  {"Metric": "Failed", "Value": failedCount},
  {"Metric": "Pass Percentage", "Value": `${passPercentage}%`},
  {"Metric": "Overall Average RPS", "Value": overallAvgRPS},
  {"Metric": "Overall Average Response Time (ms)", "Value": overallAvgResponse},
  {"Metric": "Overall Status", "Value": overallStatus}
];
const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
xlsx.utils.book_append_sheet(wb, wsSummary, "Summary");

xlsx.writeFile(wb, excelFile);
console.log(`Excel report saved to ${excelFile}`);

// 2. Generate HTML Report
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - QueueLess</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1, h2 { color: #2c3e50; }
        .executive-summary { display: flex; gap: 20px; margin-bottom: 30px; }
        .card { flex: 1; background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
        .card.pass { background: #d4edda; color: #155724; }
        .card.fail { background: #f8d7da; color: #721c24; }
        .card h3 { margin: 0 0 10px 0; font-size: 1.2em; }
        .card p { margin: 0; font-size: 2em; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px 15px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background-color: #34495e; color: #fff; }
        tr:hover { background-color: #f5f5f5; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>QueueLess Load Test Report (100 VUs / 1 min)</h1>
        
        <h2>Executive Summary</h2>
        <div class="executive-summary">
            <div class="card"><h3>Total Test Cases</h3><p>${testCases.length}</p></div>
            <div class="card ${passedCount === testCases.length ? 'pass' : 'fail'}"><h3>Passed</h3><p>${passedCount}</p></div>
            <div class="card ${failedCount === 0 ? 'pass' : 'fail'}"><h3>Failed</h3><p>${failedCount}</p></div>
            <div class="card"><h3>Pass Percentage</h3><p>${passPercentage}%</p></div>
            <div class="card"><h3>Avg RPS (Per Case)</h3><p>${overallAvgRPS}</p></div>
            <div class="card"><h3>Avg Response Time</h3><p>${overallAvgResponse} ms</p></div>
            <div class="card ${overallStatus === 'PASS' ? 'pass' : 'fail'}"><h3>Overall Status</h3><p>${overallStatus}</p></div>
        </div>

        <h2>Performance Metrics & Test Cases</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Case</th>
                    <th>Category</th>
                    <th>RPS</th>
                    <th>Avg (ms)</th>
                    <th>Min (ms)</th>
                    <th>Max (ms)</th>
                    <th>Threshold</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td>${r["Test Case"]}</td>
                    <td>${r["Category"]}</td>
                    <td>${r["Requests Per Second (RPS)"]}</td>
                    <td>${r["Average Response Time (ms)"]}</td>
                    <td>${r["Min Response Time (ms)"]}</td>
                    <td>${r["Max Response Time (ms)"]}</td>
                    <td>${r["Threshold"]}</td>
                    <td class="${r["Result"] === 'PASS' ? 'status-pass' : 'status-fail'}">${r["Result"]}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
`;

fs.writeFileSync(htmlFile, htmlContent);
console.log(`HTML report saved to ${htmlFile}`);

// 3. Move summary.json to reports directory
fs.copyFileSync(summaryFile, path.join(outputDir, 'metrics.json'));
console.log(`Metrics JSON saved to ${path.join(outputDir, 'metrics.json')}`);
