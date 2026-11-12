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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8496732026143791, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.5, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.5059523809523809, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.8641975308641975, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [1.0, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.4876543209876543, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [1.0, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9938271604938271, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 707, 0, 0.0, 394.49929278642117, 37, 2672, 211.0, 1161.6000000000004, 1839.2000000000003, 2100.5199999999995, 1.9528822276668443, 13.900477521310448, 0.5479020888174704], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 11, 0, 0.0, 1171.4545454545455, 1011, 1383, 1102.0, 1381.8, 1383.0, 1383.0, 0.033254630707326, 1.9781545418267674, 0.00951524101293605], "isController": false}, {"data": ["TX_J09", 24, 0, 0.0, 298.41666666666663, 250, 371, 284.5, 354.5, 368.5, 371.0, 0.07254634653576081, 2.056752095342525, 0.039319553054050056], "isController": true}, {"data": ["J02 01 /api/auth/me", 109, 0, 0.0, 53.61467889908255, 37, 236, 48.0, 70.0, 81.5, 222.90000000000074, 0.3057520659302436, 0.4050031486852661, 0.08211115051837599], "isController": false}, {"data": ["TX_J04", 25, 0, 0.0, 165.32000000000002, 117, 427, 142.0, 235.4, 369.6999999999999, 427.0, 0.07245032805508543, 0.7352378154849535, 0.02058891158596666], "isController": true}, {"data": ["TX_J03", 84, 0, 0.0, 1091.0238095238094, 0, 1700, 1072.0, 1367.5, 1416.25, 1700.0, 0.2517495092383079, 0.7018787790523429, 0.0682758155635143], "isController": true}, {"data": ["TX_J02", 109, 0, 0.0, 53.61467889908255, 37, 236, 48.0, 70.0, 81.5, 222.90000000000074, 0.3057477777185606, 0.404997468464501, 0.0821099988990275], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 25, 0, 0.0, 161.16, 125, 263, 147.0, 236.20000000000005, 260.0, 263.0, 0.07397390792319733, 0.5333981098187047, 0.02051620102557426], "isController": false}, {"data": ["TX_J01", 109, 0, 0.0, 195.4954128440367, 155, 312, 186.0, 244.0, 256.0, 308.8000000000002, 0.3056577530509691, 3.327516883034032, 0.08417527964880205], "isController": true}, {"data": ["TX_J08", 25, 0, 0.0, 161.16, 125, 263, 147.0, 236.20000000000005, 260.0, 263.0, 0.07397412680940714, 0.5333996881250813, 0.020516261732296513], "isController": true}, {"data": ["TX_J07", 11, 0, 0.0, 3322.636363636364, 3011, 4000, 3124.0, 3944.2000000000003, 4000.0, 4000.0, 0.032986871225252345, 3.5639174983356625, 0.018973893702806284], "isController": true}, {"data": ["TX_J06", 25, 0, 0.0, 2073.0800000000004, 1972, 2414, 2030.0, 2286.0000000000005, 2397.2, 2414.0, 0.07207539663090766, 0.9493990848947267, 0.0406831828639303], "isController": true}, {"data": ["TX_J05", 81, 0, 0.0, 482.50617283950623, 397, 743, 458.0, 584.8, 597.9, 743.0, 0.2514021099154854, 0.6833388440701692, 0.1487789830163908], "isController": true}, {"data": ["J10 01 /api/documents", 24, 0, 0.0, 249.87499999999994, 203, 304, 250.0, 291.5, 302.0, 304.0, 0.07255424185351904, 0.8344653007448902, 0.01962648925139138], "isController": false}, {"data": ["J10 02 /api/announcements", 24, 0, 0.0, 297.5, 245, 387, 297.5, 352.5, 378.75, 387.0, 0.0725242049534032, 0.9192448879878764, 0.019901661710845998], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 25, 0, 0.0, 1921.1200000000001, 1835, 2257, 1877.0, 2147.8, 2245.3, 2257.0, 0.07210304390210137, 0.09412263754376655, 0.02063104674151924], "isController": false}, {"data": ["J09 01 /api/inventory", 24, 0, 0.0, 146.375, 126, 188, 144.5, 179.5, 186.75, 188.0, 0.07258715751715628, 0.5613217818937385, 0.019635393195558876], "isController": false}, {"data": ["J09 02 /api/pos/orders", 24, 0, 0.0, 152.04166666666669, 119, 218, 140.0, 201.0, 214.5, 218.0, 0.07258101099299895, 1.496460612515688, 0.01970461040630245], "isController": false}, {"data": ["J01 01 /api/public/landing", 109, 0, 0.0, 195.4954128440367, 155, 312, 186.0, 244.0, 256.0, 308.8000000000002, 0.30564832496305583, 3.3274142449645137, 0.08417268324177904], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 11, 0, 0.0, 2151.181818181818, 1985, 2672, 2085.0, 2605.2000000000003, 2672.0, 2672.0, 0.03308907579203215, 1.606653235509993, 0.009564810971134294], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 81, 0, 0.0, 1131.4320987654319, 928, 1700, 1075.0, 1371.3999999999999, 1417.3, 1700.0, 0.25095968843819416, 0.7255907089533741, 0.07058241237324211], "isController": false}, {"data": ["J04 01 /api/membership-applications", 25, 0, 0.0, 165.32000000000002, 117, 427, 142.0, 235.4, 369.6999999999999, 427.0, 0.07245242773594858, 0.7352591233908317, 0.020589508272618202], "isController": false}, {"data": ["J06 01 /api/financial-records", 25, 0, 0.0, 151.96, 126, 210, 143.0, 191.80000000000004, 207.6, 210.0, 0.07246586857590076, 0.8599462348546334, 0.020168723187628627], "isController": false}, {"data": ["J10 03 /api/activities", 23, 0, 0.0, 97.30434782608694, 83, 125, 93.0, 118.80000000000001, 123.99999999999999, 125.0, 0.07366482504604051, 0.08543768516294338, 0.019998848987108655], "isController": false}, {"data": ["TX_J10", 24, 0, 0.0, 640.6250000000001, 563, 746, 643.5, 739.0, 744.75, 746.0, 0.07246945714337477, 1.8325902697675542, 0.05834475419266005], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 390.8, 354, 439, 384.0, 439.0, 439.0, 439.0, 0.10538962544527117, 0.1678823799085218, 0.03252257972725165], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 81, 0, 0.0, 243.72839506172835, 197, 539, 230.0, 290.2, 336.29999999999995, 539.0, 0.25159655095296074, 0.2996687700345402, 0.07493842582095023], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 81, 0, 0.0, 238.7777777777778, 190, 332, 228.0, 295.6, 323.7, 332.0, 0.2515949879793506, 0.3841961996344107, 0.07395516736502394], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 707, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
