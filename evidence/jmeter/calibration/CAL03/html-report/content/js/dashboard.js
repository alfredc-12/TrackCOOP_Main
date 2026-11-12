/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7243460764587525, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.125, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.6666666666666666, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.9, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.2, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9239130434782609, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.5151515151515151, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.8333333333333334, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.5, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9222222222222223, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.2, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.9, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.95, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.2777777777777778, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.9, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.859375, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.8939393939393939, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 287, 0, 0.0, 690.5644599303135, 40, 9092, 323.0, 2019.5999999999997, 2448.6, 4803.560000000021, 2.908744476425994, 19.816227541477478, 0.8169263812735639], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 4, 0, 0.0, 1853.5, 961, 2300, 2076.5, 2300.0, 2300.0, 2300.0, 0.05356831969573194, 3.1865303297130074, 0.015327653975438924], "isController": false}, {"data": ["TX_J09", 9, 0, 0.0, 525.4444444444445, 404, 612, 523.0, 612.0, 612.0, 612.0, 0.11058005381562619, 3.1351173070070897, 0.059933525261398966], "isController": true}, {"data": ["J02 01 /api/auth/me", 45, 0, 0.0, 75.75555555555559, 40, 187, 62.0, 129.39999999999998, 155.4999999999999, 187.0, 0.4895614617217332, 0.6486264401266333, 0.1314740253647233], "isController": false}, {"data": ["TX_J04", 10, 0, 0.0, 330.6, 201, 702, 267.0, 686.9000000000001, 702.0, 702.0, 0.12294225402328525, 1.247671781064434, 0.034937691328882824], "isController": true}, {"data": ["TX_J03", 35, 0, 0.0, 1902.7714285714285, 1107, 3147, 1855.0, 2794.3999999999996, 2937.3999999999987, 3147.0, 0.3726972633372378, 1.0776919890054308, 0.10482110531359813], "isController": true}, {"data": ["TX_J02", 45, 0, 0.0, 75.75555555555559, 40, 187, 62.0, 129.39999999999998, 155.4999999999999, 187.0, 0.4895667877891164, 0.6486334967035836, 0.13147545570508495], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 9, 0, 0.0, 180.88888888888889, 136, 271, 168.0, 271.0, 271.0, 271.0, 0.1110302372346069, 0.8006321013089231, 0.030793542358035508], "isController": false}, {"data": ["TX_J01", 46, 0, 0.0, 673.304347826087, 0, 9092, 288.0, 512.4000000000002, 5992.899999999988, 9092.0, 0.4758604280674894, 5.067937804524812, 0.1281986419874414], "isController": true}, {"data": ["TX_J08", 9, 0, 0.0, 180.88888888888889, 136, 271, 168.0, 271.0, 271.0, 271.0, 0.11102338892726735, 0.8005827185927169, 0.030791643022796807], "isController": true}, {"data": ["TX_J07", 4, 0, 0.0, 5775.75, 4642, 6544, 5958.5, 6544.0, 6544.0, 6544.0, 0.05072537283149031, 5.480420798670996, 0.029176996677488083], "isController": true}, {"data": ["TX_J06", 10, 0, 0.0, 2357.0, 2097, 2540, 2328.5, 2539.8, 2540.0, 2540.0, 0.11957145590204707, 1.5750970397096804, 0.06749248194471015], "isController": true}, {"data": ["TX_J05", 33, 0, 0.0, 796.2121212121211, 375, 1640, 768.0, 1157.8000000000002, 1400.599999999999, 1640.0, 0.36565502110826714, 0.9809232650777294, 0.21309316792983857], "isController": true}, {"data": ["J10 01 /api/documents", 9, 0, 0.0, 459.55555555555554, 209, 733, 426.0, 733.0, 733.0, 733.0, 0.11067388096409247, 1.2742627505533695, 0.029938149440482047], "isController": false}, {"data": ["J10 02 /api/announcements", 9, 0, 0.0, 754.1111111111111, 534, 1235, 614.0, 1235.0, 1235.0, 1235.0, 0.11014968117786725, 1.3274614246637375, 0.030226621495098343], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 10, 0, 0.0, 2056.4, 1898, 2317, 1999.0, 2310.0, 2317.0, 2317.0, 0.1200249651927601, 0.15671228365500023, 0.034343080860819046], "isController": false}, {"data": ["J09 01 /api/inventory", 9, 0, 0.0, 306.8888888888889, 189, 419, 319.0, 419.0, 419.0, 419.0, 0.11080741670975844, 0.8569179032466574, 0.029974271902932705], "isController": false}, {"data": ["J09 02 /api/pos/orders", 9, 0, 0.0, 218.55555555555554, 124, 334, 193.0, 334.0, 334.0, 334.0, 0.11095084877399312, 2.287602802895817, 0.030121421835127036], "isController": false}, {"data": ["J01 01 /api/public/landing", 45, 0, 0.0, 688.2666666666668, 164, 9092, 295.0, 516.1999999999999, 6409.199999999964, 9092.0, 0.48810117795084274, 5.313820245894527, 0.1344184884591188], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 4, 0, 0.0, 3922.25, 3586, 4244, 3929.5, 4244.0, 4244.0, 4244.0, 0.05135645229627537, 2.4936466451397536, 0.0148452244918921], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 35, 0, 0.0, 1902.7714285714285, 1107, 3147, 1855.0, 2794.3999999999996, 2937.3999999999987, 3147.0, 0.37270916971045825, 1.0777264174928387, 0.10482445398106638], "isController": false}, {"data": ["J04 01 /api/membership-applications", 10, 0, 0.0, 330.6, 201, 702, 267.0, 686.9000000000001, 702.0, 702.0, 0.12294527705718183, 1.247702460134994, 0.034938550413710856], "isController": false}, {"data": ["J06 01 /api/financial-records", 10, 0, 0.0, 300.6, 187, 526, 305.0, 508.80000000000007, 526.0, 526.0, 0.12288031457360529, 1.4582437331039568, 0.03420008755222414], "isController": false}, {"data": ["J10 03 /api/activities", 9, 0, 0.0, 145.77777777777777, 89, 266, 150.0, 266.0, 266.0, 266.0, 0.11073107113856148, 0.12846534425059672, 0.0300617556411329], "isController": false}, {"data": ["TX_J10", 9, 0, 0.0, 1359.4444444444443, 832, 1978, 1297.0, 1978.0, 1978.0, 1978.0, 0.10969188767550703, 2.71216048837266, 0.0895531426725819], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 473.6, 383, 738, 410.0, 738.0, 738.0, 738.0, 1.4318442153493698, 2.2920693728522337, 0.44185817583046966], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 32, 0, 0.0, 417.99999999999994, 196, 1196, 367.5, 601.0, 935.9999999999991, 1196.0, 0.38318764219853907, 0.4565321518381032, 0.1141330379595258], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 33, 0, 0.0, 390.8787878787878, 213, 733, 370.0, 557.6, 625.8999999999995, 733.0, 0.3656712283228988, 0.5585056651338024, 0.10748734348163333], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 287, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
