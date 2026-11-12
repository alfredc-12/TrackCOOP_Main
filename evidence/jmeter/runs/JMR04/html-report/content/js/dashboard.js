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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7865509761388286, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.325, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [0.8863636363636364, 500, 1500, "TX_J09"], "isController": true}, {"data": [0.9951456310679612, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [0.9479166666666666, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.3449367088607595, 500, 1500, "TX_J03"], "isController": true}, {"data": [0.9951456310679612, 500, 1500, "TX_J02"], "isController": true}, {"data": [0.9545454545454546, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [0.9492753623188406, 500, 1500, "TX_J01"], "isController": true}, {"data": [0.9545454545454546, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.010638297872340425, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.7532467532467533, 500, 1500, "TX_J05"], "isController": true}, {"data": [0.9204545454545454, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.8977272727272727, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [0.9545454545454546, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [0.9886363636363636, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [0.9490291262135923, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.3449367088607595, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [0.9479166666666666, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [0.9468085106382979, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.4659090909090909, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.55, 500, 1500, "SETUP login"], "isController": false}, {"data": [0.9281045751633987, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [0.9225806451612903, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 1333, 0, 0.0, 531.1507876969238, 37, 7217, 228.0, 1300.200000000001, 2069.2, 3620.7000000000116, 3.640534746214035, 25.52741922819571, 1.0219454320916006], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 20, 0, 0.0, 1810.45, 1021, 4800, 1287.5, 3496.1000000000004, 4736.249999999999, 4800.0, 0.058873571947920436, 3.5021065010037944, 0.016845660723379577], "isController": false}, {"data": ["TX_J09", 44, 0, 0.0, 418.47727272727275, 253, 1190, 320.0, 854.5, 992.0, 1190.0, 0.13805307513224857, 3.9139805554989047, 0.07482368818202925], "isController": true}, {"data": ["J02 01 /api/auth/me", 206, 0, 0.0, 72.64077669902912, 37, 564, 50.0, 128.0, 181.29999999999995, 534.770000000002, 0.5851857112420993, 0.7753743963496911, 0.15722371901853563], "isController": false}, {"data": ["TX_J04", 48, 0, 0.0, 235.85416666666663, 114, 1017, 152.5, 509.6, 613.1499999999997, 1017.0, 0.1364299133954279, 1.384525468160669, 0.03877061015436476], "isController": true}, {"data": ["TX_J03", 158, 0, 0.0, 1597.5379746835447, 912, 7094, 1101.5, 3021.2999999999997, 3966.999999999998, 6005.449999999993, 0.4541704633975975, 1.3133445854904036, 0.1278056209703151], "isController": true}, {"data": ["TX_J02", 206, 0, 0.0, 72.64077669902912, 37, 564, 50.0, 128.0, 181.29999999999995, 534.770000000002, 0.5851840489054786, 0.7753721937442121, 0.1572232723932323], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 44, 0, 0.0, 249.13636363636365, 120, 881, 183.5, 517.0, 756.75, 881.0, 0.138141060860556, 0.9961081601337457, 0.03831255984804483], "isController": false}, {"data": ["TX_J01", 207, 0, 0.0, 270.4057971014492, 0, 921, 194.0, 513.2, 651.5999999999999, 831.1199999999999, 0.5782155207570993, 6.264364278047643, 0.1585340778789267], "isController": true}, {"data": ["TX_J08", 44, 0, 0.0, 249.13636363636365, 120, 881, 183.5, 517.0, 756.75, 881.0, 0.13814019345906184, 0.9961019054712935, 0.03831231927966168], "isController": true}, {"data": ["TX_J07", 20, 0, 0.0, 4611.3, 2926, 12017, 3442.5, 7625.600000000002, 11802.299999999997, 12017.0, 0.057649347841752546, 6.228477201484471, 0.03315963464725805], "isController": true}, {"data": ["TX_J06", 47, 0, 0.0, 2211.914893617022, 781, 3270, 2069.0, 2755.0000000000005, 2966.399999999999, 3270.0, 0.134106012229327, 1.7627829601191547, 0.07488012937663531], "isController": true}, {"data": ["TX_J05", 154, 0, 0.0, 661.9090909090908, 397, 3114, 494.5, 1157.5, 1424.0, 2348.9499999999844, 0.4536750626012667, 1.2299106320886728, 0.2677441219251731], "isController": true}, {"data": ["J10 01 /api/documents", 44, 0, 0.0, 353.45454545454544, 195, 1296, 258.5, 674.5, 843.5, 1296.0, 0.137924549002398, 1.5866833260191529, 0.03730966804068774], "isController": false}, {"data": ["J10 02 /api/announcements", 44, 0, 0.0, 381.6136363636363, 236, 1136, 295.5, 686.5, 831.25, 1136.0, 0.13788564892433525, 1.7294770236285861, 0.03783776108177559], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 46, 0, 0.0, 2001.8478260869567, 1839, 2633, 1921.5, 2354.9000000000005, 2465.25, 2633.0, 0.1313778970968341, 0.17151029692118755, 0.03759152719665272], "isController": false}, {"data": ["J09 01 /api/inventory", 44, 0, 0.0, 214.9318181818182, 121, 753, 165.0, 468.0, 677.25, 753.0, 0.13819920158552174, 1.06873108594734, 0.037383963710146025], "isController": false}, {"data": ["J09 02 /api/pos/orders", 44, 0, 0.0, 203.54545454545453, 119, 654, 160.0, 342.0, 419.0, 654.0, 0.13816231560040945, 2.8486318251006386, 0.03750890989932991], "isController": false}, {"data": ["J01 01 /api/public/landing", 206, 0, 0.0, 271.71844660194165, 149, 921, 194.5, 513.8000000000001, 652.8999999999994, 831.23, 0.584728924212319, 6.36568232419103, 0.16109816296480273], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 20, 0, 0.0, 2800.8499999999995, 1905, 7217, 2153.5, 4306.0, 7072.049999999997, 7217.0, 0.058240948628571265, 2.827919404901267, 0.01683527421294638], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 158, 0, 0.0, 1597.5379746835447, 912, 7094, 1101.5, 3021.2999999999997, 3966.999999999998, 6005.449999999993, 0.45416785238969903, 1.3133370351247093, 0.12780488622089228], "isController": false}, {"data": ["J04 01 /api/membership-applications", 48, 0, 0.0, 235.85416666666663, 114, 1017, 152.5, 509.6, 613.1499999999997, 1017.0, 0.1364256480218281, 1.3844821820642907, 0.038769398021828105], "isController": false}, {"data": ["J06 01 /api/financial-records", 47, 0, 0.0, 252.65957446808505, 120, 875, 159.0, 523.6000000000001, 804.9999999999998, 875.0, 0.13493068295021632, 1.6012224818561294, 0.037553949844542626], "isController": false}, {"data": ["J10 03 /api/activities", 44, 0, 0.0, 120.02272727272728, 79, 256, 98.5, 209.5, 242.75, 256.0, 0.1379907295318978, 0.1600693687629758, 0.03746232696276132], "isController": false}, {"data": ["TX_J10", 44, 0, 0.0, 855.0909090909092, 551, 2085, 658.0, 1416.5, 2014.75, 2085.0, 0.13749785159606884, 3.4658851765988032, 0.11225410540460305], "isController": true}, {"data": ["SETUP login", 10, 0, 0.0, 749.9, 498, 1185, 697.0, 1172.9, 1185.0, 1185.0, 0.18965615339389685, 0.3021533678191439, 0.05854522469512774], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 153, 0, 0.0, 321.4705882352941, 194, 1063, 241.0, 598.4, 738.9999999999998, 944.7400000000017, 0.4558020925188875, 0.5429698206135751, 0.13583118807198694], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 155, 0, 0.0, 345.06451612903237, 190, 2287, 245.0, 665.2, 798.7999999999996, 1589.7999999999972, 0.4560379423568041, 0.6965927851487566, 0.13411917282808253], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 1333, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
