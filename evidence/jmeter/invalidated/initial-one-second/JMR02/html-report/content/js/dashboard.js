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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8586399627387051, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.47368421052631576, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.5034013605442177, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.9724137931034482, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [1.0, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.5, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.9, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 1242, 0, 0.0, 362.01690821256057, 37, 2690, 195.0, 1019.1000000000001, 1581.999999999971, 1986.7099999999998, 3.4189916452176785, 24.04894939386536, 0.9590966649690997], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 19, 0, 0.0, 1063.8947368421054, 925, 1630, 1027.0, 1234.0, 1630.0, 1630.0, 0.053653522494945274, 3.1915986481783216, 0.015352033292010707], "isController": false}, {"data": ["TX_J09", 42, 0, 0.0, 268.3809523809524, 235, 316, 263.5, 286.1, 304.15000000000003, 316.0, 0.12406214922904235, 3.517355777751521, 0.0672407156466001], "isController": true}, {"data": ["J02 01 /api/auth/me", 191, 0, 0.0, 45.565445026178004, 37, 87, 44.0, 50.80000000000001, 55.799999999999955, 87.0, 0.5317075886643283, 0.7043527034268693, 0.1427925653151272], "isController": false}, {"data": ["TX_J04", 44, 0, 0.0, 138.25, 116, 228, 132.0, 156.5, 184.5, 228.0, 0.12291326792857621, 1.2473776174939102, 0.03492945406954656], "isController": true}, {"data": ["TX_J03", 147, 0, 0.0, 1009.4353741496599, 0, 1310, 994.0, 1112.2, 1146.2, 1266.3200000000008, 0.4369641986611654, 1.2548090213785479, 0.12206015243213679], "isController": true}, {"data": ["TX_J02", 191, 0, 0.0, 45.570680628272235, 37, 87, 44.0, 50.80000000000001, 55.799999999999955, 87.0, 0.5317223908020379, 0.7043723118092481, 0.14279654049859414], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 42, 0, 0.0, 138.0714285714286, 116, 179, 134.5, 153.0, 169.95000000000002, 179.0, 0.12409330634796355, 0.8948290762435184, 0.03441650293244301], "isController": false}, {"data": ["TX_J01", 191, 0, 0.0, 178.6596858638743, 156, 339, 173.0, 193.0, 209.39999999999998, 298.5199999999993, 0.5314782608695653, 5.785934782608695, 0.1463641304347826], "isController": true}, {"data": ["TX_J08", 42, 0, 0.0, 138.0714285714286, 116, 179, 134.5, 153.0, 169.95000000000002, 179.0, 0.12409733958941509, 0.8948581596955478, 0.03441762152675184], "isController": true}, {"data": ["TX_J07", 18, 0, 0.0, 3068.5, 2830, 3734, 2982.0, 3557.6000000000004, 3734.0, 3734.0, 0.05349707400725777, 5.779878208709919, 0.030771266201440262], "isController": true}, {"data": ["TX_J06", 43, 0, 0.0, 2041.9767441860465, 1965, 2481, 1996.0, 2155.4, 2340.6, 2481.0, 0.12112266627606953, 1.5955309037088887, 0.06836806748785956], "isController": true}, {"data": ["TX_J05", 145, 0, 0.0, 443.7103448275863, 222, 625, 432.0, 491.0, 513.4, 603.3799999999997, 0.43396802403883566, 1.176048084218229, 0.255929485620694], "isController": true}, {"data": ["J10 01 /api/documents", 42, 0, 0.0, 223.49999999999997, 207, 259, 220.0, 245.8, 255.4, 259.0, 0.1240812081964501, 1.4274878282243388, 0.033564936201578785], "isController": false}, {"data": ["J10 02 /api/announcements", 42, 0, 0.0, 268.4285714285713, 244, 431, 264.0, 283.4, 296.25, 431.0, 0.12406947890818859, 1.5541917759659696, 0.034046409739454095], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 43, 0, 0.0, 1903.1860465116276, 1833, 2347, 1860.0, 2003.8, 2205.9999999999995, 2347.0, 0.12117386476996692, 0.15821236054438062, 0.034671818728125296], "isController": false}, {"data": ["J09 01 /api/inventory", 42, 0, 0.0, 134.45238095238096, 119, 166, 133.0, 148.4, 155.10000000000002, 166.0, 0.12410944088696879, 0.9597877562342831, 0.03357257336493199], "isController": false}, {"data": ["J09 02 /api/pos/orders", 42, 0, 0.0, 133.92857142857142, 116, 183, 131.0, 148.5, 161.35000000000002, 183.0, 0.12411200813229159, 2.558961745797922, 0.033694470957790094], "isController": false}, {"data": ["J01 01 /api/public/landing", 191, 0, 0.0, 178.6596858638743, 156, 339, 173.0, 193.0, 209.39999999999998, 298.5199999999993, 0.5314679087989939, 5.785822084856782, 0.14636127957159792], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 18, 0, 0.0, 2014.0555555555557, 1894, 2690, 1968.0, 2246.3000000000006, 2690.0, 2690.0, 0.05365862383516071, 2.605430112996119, 0.015510695952351142], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 146, 0, 0.0, 1016.3424657534249, 890, 1310, 994.0, 1112.8000000000002, 1146.3, 1267.23, 0.4345897740430839, 1.256538380825661, 0.12222837394961734], "isController": false}, {"data": ["J04 01 /api/membership-applications", 44, 0, 0.0, 138.25, 116, 228, 132.0, 156.5, 184.5, 228.0, 0.12291292457336644, 1.2473741329750236, 0.03492935649497035], "isController": false}, {"data": ["J06 01 /api/financial-records", 44, 0, 0.0, 138.8181818181818, 123, 238, 135.0, 144.0, 154.5, 238.0, 0.12292013543564013, 1.4587162947401355, 0.034211170506989685], "isController": false}, {"data": ["J10 03 /api/activities", 42, 0, 0.0, 89.83333333333334, 74, 127, 87.0, 104.7, 121.15000000000003, 127.0, 0.1241274138348869, 0.1440071949568805, 0.03369865336533062], "isController": false}, {"data": ["TX_J10", 42, 0, 0.0, 581.7619047619048, 540, 720, 571.5, 617.1, 660.5500000000001, 720.0, 0.12394718669397439, 3.1224039335525036, 0.10119125788687754], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 414.8, 334, 539, 396.0, 539.0, 539.0, 539.0, 0.10571718538565629, 0.16923008816813262, 0.03262366267760487], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 144, 0, 0.0, 223.30555555555551, 193, 332, 215.0, 254.5, 276.75, 324.3500000000002, 0.43648003103857996, 0.5199036741237058, 0.13000625924488957], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 145, 0, 0.0, 221.94482758620688, 195, 353, 215.0, 243.0, 259.9999999999999, 353.0, 0.43396802403883566, 0.6627014397263309, 0.12756286644110307], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 1242, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
