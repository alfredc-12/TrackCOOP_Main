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

    var data = {"OkPercent": 99.96319470003681, "KoPercent": 0.0368052999631947};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8268536222647122, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.3375, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.9606741573033708, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.9946808510638298, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.45858895705521474, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.9835164835164835, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9894366197183099, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.9836956521739131, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.010638297872340425, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.709375, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.9715909090909091, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.9770114942528736, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9893617021276596, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.45524691358024694, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.9946808510638298, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.925, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9858934169278997, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.98125, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 2717, 1, 0.0368052999631947, 462.6584468163421, 38, 19354, 232.0, 1227.0, 1883.0, 2383.360000000008, 7.481942275865298, 51.96910374947334, 2.104027344061948], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 40, 0, 0.0, 1443.0500000000002, 1062, 2617, 1322.5, 1983.0, 2241.449999999999, 2617.0, 0.1177540764989358, 7.004631139035182, 0.03374792734426288], "isController": false}, {"data": ["TX_J09", 89, 0, 0.0, 348.3033707865168, 221, 636, 328.0, 455.0, 555.5, 636.0, 0.2603663852369334, 7.3214304161693375, 0.1405651650986174], "isController": true}, {"data": ["J02 01 /api/auth/me", 420, 0, 0.0, 55.973809523809535, 38, 185, 51.0, 73.0, 90.89999999999998, 136.69000000000023, 1.1794870354716684, 1.5638624654929836, 0.3173848008000854], "isController": false}, {"data": ["TX_J04", 94, 0, 0.0, 177.59574468085108, 123, 613, 157.0, 241.5, 303.0, 613.0, 0.26759280346162606, 2.7156321613100665, 0.07616953979019586], "isController": true}, {"data": ["TX_J03", 326, 0, 0.0, 1256.3435582822078, 0, 5534, 1176.0, 1467.3000000000002, 1961.6, 2815.160000000007, 0.9274089162117337, 2.6661728397915323, 0.25973917157633913], "isController": true}, {"data": ["TX_J02", 422, 0, 0.0, 55.710900473933634, 0, 185, 51.0, 73.0, 90.69999999999993, 136.4699999999998, 1.1766116373024924, 1.5526564203403252, 0.3151105417223141], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 91, 1, 1.098901098901099, 389.43956043956047, 80, 19354, 153.0, 262.4, 340.59999999999957, 19354.0, 0.2639356577073563, 1.8857616999994198, 0.07332553127927582], "isController": false}, {"data": ["TX_J01", 426, 0, 0.0, 283.18309859154914, 0, 9851, 204.5, 279.6, 332.65, 3984.740000000068, 1.181944548488859, 12.776781444129536, 0.323830111598039], "isController": true}, {"data": ["TX_J08", 92, 1, 1.0869565217391304, 385.20652173913044, 0, 19354, 152.5, 262.1, 338.14999999999975, 19354.0, 0.2658229676822838, 1.8786021314595702, 0.07304714023606235], "isController": true}, {"data": ["TX_J07", 40, 0, 0.0, 3936.875, 3202, 8473, 3599.5, 4827.4, 6033.499999999995, 8473.0, 0.11694846373574325, 12.635207956296359, 0.06737670525478684], "isController": true}, {"data": ["TX_J06", 94, 0, 0.0, 2107.4468085106378, 220, 2677, 2075.5, 2347.5, 2443.0, 2677.0, 0.26754938990200294, 3.5206332123787134, 0.15045483841013044], "isController": true}, {"data": ["TX_J05", 320, 0, 0.0, 596.8812500000001, 336, 10100, 510.0, 700.7, 831.9, 1314.1400000000035, 0.9272997032640949, 2.518498225452638, 0.5489258808622728], "isController": true}, {"data": ["J10 01 /api/documents", 88, 0, 0.0, 283.8522727272727, 211, 787, 256.0, 345.00000000000017, 521.3499999999999, 787.0, 0.2610857607386354, 3.003540882914904, 0.07074742659929864], "isController": false}, {"data": ["J10 02 /api/announcements", 87, 0, 0.0, 347.1034482758621, 258, 956, 305.0, 478.40000000000003, 541.5999999999996, 956.0, 0.2633857481063473, 3.310143435488656, 0.07240092476401241], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 93, 0, 0.0, 1955.236559139785, 1849, 2441, 1900.0, 2177.6, 2269.0, 2441.0, 0.2654435333103092, 0.3465605707178677, 0.07607753484303154], "isController": false}, {"data": ["J09 01 /api/inventory", 89, 0, 0.0, 185.03370786516848, 115, 487, 158.0, 286.0, 366.5, 487.0, 0.2603656235464138, 2.0134882511840786, 0.07055378159127278], "isController": false}, {"data": ["J09 02 /api/pos/orders", 88, 0, 0.0, 165.12500000000009, 127, 402, 152.0, 211.20000000000002, 223.84999999999997, 402.0, 0.2612020041317408, 5.385482585543657, 0.07103400560693847], "isController": false}, {"data": ["J01 01 /api/public/landing", 423, 0, 0.0, 285.191489361702, 153, 9851, 205.0, 280.20000000000005, 332.79999999999995, 4096.8799999999665, 1.1771613991245036, 12.815324522073864, 0.3248069937092829], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 40, 0, 0.0, 2493.8250000000003, 2047, 5856, 2231.5, 3266.5, 4256.049999999997, 5856.0, 0.11738535852423128, 5.699712570944777, 0.03398615641452292], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 324, 0, 0.0, 1264.098765432098, 940, 5534, 1176.0, 1469.5, 1962.0, 2823.0, 0.9222256378727328, 2.6676375030598534, 0.2598818594089786], "isController": false}, {"data": ["J04 01 /api/membership-applications", 94, 0, 0.0, 177.59574468085108, 123, 613, 157.0, 241.5, 303.0, 613.0, 0.26759280346162606, 2.7156321613100665, 0.07616953979019586], "isController": false}, {"data": ["J06 01 /api/financial-records", 94, 0, 0.0, 173.01063829787233, 120, 333, 159.0, 234.5, 266.75, 333.0, 0.26755091294633326, 3.1750573926950065, 0.07458993464215066], "isController": false}, {"data": ["J10 03 /api/activities", 87, 0, 0.0, 118.2758620689655, 76, 242, 102.0, 170.00000000000003, 219.6, 242.0, 0.2635445223634188, 0.30572620052860366, 0.07167246641321963], "isController": false}, {"data": ["TX_J10", 87, 0, 0.0, 749.1954022988508, 577, 1415, 696.0, 921.6, 1175.9999999999995, 1415.0, 0.2630576368353259, 6.637283038867522, 0.215133949628998], "isController": true}, {"data": ["SETUP login", 20, 0, 0.0, 407.7, 337, 609, 376.5, 558.9000000000001, 606.8, 609.0, 0.35423935953523794, 0.5646727603216493, 0.1095063176375777], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 319, 0, 0.0, 318.4357366771158, 205, 9861, 255.0, 358.0, 415.0, 639.8000000000002, 0.9278245568110757, 1.1053336051001266, 0.27686242056047583], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 320, 0, 0.0, 279.4406250000002, 201, 770, 253.0, 368.7000000000001, 444.69999999999993, 723.8600000000007, 0.9272889548294369, 1.4172256736971591, 0.27308161664135944], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["500/Internal Server Error", 1, 100.0, 0.0368052999631947], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 2717, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["J08 01 /api/rental/schedules", 91, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
