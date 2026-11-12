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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8478987583572111, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.3888888888888889, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.9878048780487805, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.4895833333333333, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9973118279569892, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.916083916083916, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.9878048780487805, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.9125, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9973118279569892, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.486013986013986, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.9880952380952381, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.8, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9964539007092199, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.993006993006993, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 1210, 0, 0.0, 396.86611570247976, 38, 4492, 211.0, 1073.9, 1848.45, 2198.680000000001, 3.338492822240432, 23.396596026331327, 0.9366608501706494], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 18, 0, 0.0, 1227.9999999999998, 936, 1998, 1047.0, 1818.0000000000002, 1998.0, 1998.0, 0.05152027752256159, 3.0646850501034697, 0.014741641908311079], "isController": false}, {"data": ["TX_J09", 41, 0, 0.0, 302.41463414634137, 250, 572, 274.0, 384.0, 401.79999999999995, 572.0, 0.12039454172258161, 3.413304551207322, 0.06525290103128202], "isController": true}, {"data": ["J02 01 /api/auth/me", 186, 0, 0.0, 50.06451612903226, 38, 179, 45.5, 59.0, 77.25000000000003, 132.01999999999975, 0.5188313463394496, 0.6873240488789338, 0.13933459008139515], "isController": false}, {"data": ["TX_J04", 42, 0, 0.0, 144.64285714285717, 116, 271, 133.0, 183.00000000000003, 208.55000000000004, 271.0, 0.12046499488023771, 1.2224922576143915, 0.034233704599755055], "isController": true}, {"data": ["TX_J03", 144, 0, 0.0, 1092.659722222222, 0, 2719, 1032.0, 1320.5, 1420.75, 2470.1500000000065, 0.42755598311153864, 1.2276866901674, 0.11941504997060552], "isController": true}, {"data": ["TX_J02", 186, 0, 0.0, 50.06451612903226, 38, 179, 45.5, 59.0, 77.25000000000003, 132.01999999999975, 0.5188327935798627, 0.6873259661168712, 0.139334978744592], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 41, 0, 0.0, 157.97560975609755, 122, 417, 137.0, 189.20000000000002, 346.9999999999998, 417.0, 0.12033235208659233, 0.8676804086457327, 0.03337342577401584], "isController": false}, {"data": ["TX_J01", 186, 0, 0.0, 192.72580645161298, 157, 591, 178.5, 221.7000000000001, 280.35000000000014, 465.71999999999935, 0.5183816459453358, 5.643396255911919, 0.14275744546541475], "isController": true}, {"data": ["TX_J08", 42, 0, 0.0, 154.21428571428572, 0, 417, 137.0, 188.8, 340.0000000000002, 417.0, 0.12139851084493364, 0.8545260598523562, 0.03286747256971743], "isController": true}, {"data": ["TX_J07", 18, 0, 0.0, 3651.4444444444443, 2914, 6290, 3216.5, 5424.200000000002, 6290.0, 6290.0, 0.05123694525332399, 5.535663804869786, 0.029471250736531087], "isController": true}, {"data": ["TX_J06", 42, 0, 0.0, 2113.928571428572, 1977, 2913, 2031.5, 2349.4, 2836.8500000000004, 2913.0, 0.11983907324450024, 1.5785498758809597, 0.06764353938996205], "isController": true}, {"data": ["TX_J05", 143, 0, 0.0, 472.9090909090909, 212, 1283, 447.0, 525.2, 610.4, 1134.2800000000007, 0.42827963365619026, 1.157161076943581, 0.2516704403193828], "isController": true}, {"data": ["J10 01 /api/documents", 41, 0, 0.0, 251.14634146341461, 195, 735, 227.0, 318.4000000000002, 446.1999999999999, 735.0, 0.12045679567295686, 1.385915915097056, 0.03258450429825103], "isController": false}, {"data": ["J10 02 /api/announcements", 40, 0, 0.0, 340.15000000000003, 249, 666, 273.0, 531.6999999999999, 611.7999999999997, 666.0, 0.1226196461197013, 1.5338053263675158, 0.0336485552340196], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 42, 0, 0.0, 1952.9999999999995, 1843, 2774, 1890.5, 2147.8000000000006, 2657.4000000000005, 2774.0, 0.11992016743139566, 0.15654199311601133, 0.03431309478261614], "isController": false}, {"data": ["J09 01 /api/inventory", 41, 0, 0.0, 153.4146341463415, 123, 279, 138.0, 213.8, 251.99999999999997, 279.0, 0.1204539645512796, 0.931486941761977, 0.03258373845771919], "isController": false}, {"data": ["J09 02 /api/pos/orders", 41, 0, 0.0, 148.99999999999994, 124, 293, 137.0, 186.80000000000004, 235.19999999999996, 293.0, 0.12046847545675182, 2.4838014892547995, 0.0327053087665791], "isController": false}, {"data": ["J01 01 /api/public/landing", 186, 0, 0.0, 192.72580645161298, 157, 591, 178.5, 221.7000000000001, 280.35000000000014, 465.71999999999935, 0.518400428098418, 5.64360072907028, 0.1427626178942909], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 18, 0, 0.0, 2423.444444444444, 1938, 4492, 2082.0, 3720.700000000001, 4492.0, 4492.0, 0.05148520515424109, 2.499887152653633, 0.014882442114897816], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 143, 0, 0.0, 1100.300699300699, 889, 2719, 1033.0, 1320.8, 1421.1999999999998, 2475.680000000001, 0.4271066362813647, 1.2349726319475764, 0.12012374145413383], "isController": false}, {"data": ["J04 01 /api/membership-applications", 42, 0, 0.0, 144.64285714285717, 116, 271, 133.0, 183.00000000000003, 208.55000000000004, 271.0, 0.12046292179948659, 1.2224712197587875, 0.03423311547231504], "isController": false}, {"data": ["J06 01 /api/financial-records", 42, 0, 0.0, 160.92857142857142, 127, 675, 139.5, 211.0000000000001, 235.95000000000002, 675.0, 0.12048331019288804, 1.4297588128521268, 0.03353295254391903], "isController": false}, {"data": ["J10 03 /api/activities", 40, 0, 0.0, 103.95000000000002, 78, 314, 91.5, 121.69999999999999, 183.09999999999974, 314.0, 0.1227054088544223, 0.1423185024034922, 0.03331260123196231], "isController": false}, {"data": ["TX_J10", 40, 0, 0.0, 696.25, 539, 1303, 617.0, 1023.2999999999997, 1118.1999999999998, 1303.0, 0.12248597535582174, 3.083336228021423, 0.09999831581783886], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 511.4, 350, 827, 416.0, 827.0, 827.0, 827.0, 0.10642373675024477, 0.17036112234472778, 0.03284170001277085], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 141, 0, 0.0, 238.2836879432624, 198, 546, 225.0, 274.4, 318.10000000000014, 496.4400000000015, 0.42703074318492246, 0.5087227323077529, 0.12719177409316537], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 143, 0, 0.0, 237.95804195804192, 195, 737, 221.0, 261.79999999999995, 329.99999999999983, 640.2000000000005, 0.4282757856464718, 0.6540804733570532, 0.12588965964803517], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 1210, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
