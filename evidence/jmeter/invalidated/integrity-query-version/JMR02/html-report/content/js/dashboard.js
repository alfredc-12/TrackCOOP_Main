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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8519121236777868, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.5, 500, 1500, "J07 01 /api/chairman/member-analytics"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J09"], "isController": true}, {"data": [1.0, 500, 1500, "J02 01 /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J04"], "isController": true}, {"data": [0.5, 500, 1500, "TX_J03"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J02"], "isController": true}, {"data": [1.0, 500, 1500, "J08 01 /api/rental/schedules"], "isController": false}, {"data": [1.0, 500, 1500, "TX_J01"], "isController": true}, {"data": [1.0, 500, 1500, "TX_J08"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J07"], "isController": true}, {"data": [0.0, 500, 1500, "TX_J06"], "isController": true}, {"data": [0.9074074074074074, 500, 1500, "TX_J05"], "isController": true}, {"data": [1.0, 500, 1500, "J10 01 /api/documents"], "isController": false}, {"data": [0.9791666666666666, 500, 1500, "J10 02 /api/announcements"], "isController": false}, {"data": [0.0, 500, 1500, "J06 02 /api/financial-records/summary"], "isController": false}, {"data": [1.0, 500, 1500, "J09 01 /api/inventory"], "isController": false}, {"data": [1.0, 500, 1500, "J09 02 /api/pos/orders"], "isController": false}, {"data": [1.0, 500, 1500, "J01 01 /api/public/landing"], "isController": false}, {"data": [0.0, 500, 1500, "J07 02 /api/chairman/financial-analytics"], "isController": false}, {"data": [0.5, 500, 1500, "J03 01 /api/members/me/dashboard"], "isController": false}, {"data": [1.0, 500, 1500, "J04 01 /api/membership-applications"], "isController": false}, {"data": [1.0, 500, 1500, "J06 01 /api/financial-records"], "isController": false}, {"data": [1.0, 500, 1500, "J10 03 /api/activities"], "isController": false}, {"data": [0.5, 500, 1500, "TX_J10"], "isController": true}, {"data": [0.8, 500, 1500, "SETUP login"], "isController": false}, {"data": [1.0, 500, 1500, "J05 02 /api/members/me/share-capital/transactions"], "isController": false}, {"data": [1.0, 500, 1500, "J05 01 /api/members/me/share-capital/overview"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 712, 0, 0.0, 377.43679775280896, 36, 4024, 196.0, 1038.7, 1822.1000000000006, 2119.9900000000002, 1.9652981346229221, 13.940115250796332, 0.5514004086205374], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["J07 01 /api/chairman/member-analytics", 11, 0, 0.0, 1059.7272727272727, 976, 1215, 1024.0, 1214.2, 1215.0, 1215.0, 0.03316919606914873, 1.9730724550934318, 0.00949079535962947], "isController": false}, {"data": ["TX_J09", 25, 0, 0.0, 271.59999999999997, 194, 338, 275.0, 295.6, 326.9, 338.0, 0.07458545404641005, 2.0530520274563973, 0.03961478197925928], "isController": true}, {"data": ["J02 01 /api/auth/me", 109, 0, 0.0, 47.66055045871563, 36, 118, 44.0, 58.0, 73.0, 115.90000000000012, 0.30951752181530606, 0.40998537423224035, 0.08312238134688395], "isController": false}, {"data": ["TX_J04", 25, 0, 0.0, 138.67999999999995, 117, 184, 133.0, 166.60000000000002, 179.5, 184.0, 0.07279228285334101, 0.7387080288796103, 0.02068608819367406], "isController": true}, {"data": ["TX_J03", 84, 0, 0.0, 1024.7500000000005, 881, 1482, 1011.0, 1122.0, 1161.0, 1482.0, 0.2541680534963236, 0.7348700036309722, 0.07148476504584102], "isController": true}, {"data": ["TX_J02", 109, 0, 0.0, 47.66055045871563, 36, 118, 44.0, 58.0, 73.0, 115.90000000000012, 0.3095201585651895, 0.409988866858058, 0.0831230894584249], "isController": true}, {"data": ["J08 01 /api/rental/schedules", 25, 0, 0.0, 137.00000000000003, 96, 178, 137.0, 166.8, 175.9, 178.0, 0.07458968215844639, 0.5378382269137475, 0.020686982161131618], "isController": false}, {"data": ["TX_J01", 109, 0, 0.0, 180.72477064220186, 150, 269, 175.0, 208.0, 235.0, 268.8, 0.30935939899131804, 3.36780899043824, 0.08519467823784345], "isController": true}, {"data": ["TX_J08", 25, 0, 0.0, 137.00000000000003, 96, 178, 137.0, 166.8, 175.9, 178.0, 0.07458945961428298, 0.5378366222312393, 0.020686920439898795], "isController": true}, {"data": ["TX_J07", 11, 0, 0.0, 3461.8181818181815, 2833, 5239, 3077.0, 5075.200000000001, 5239.0, 5239.0, 0.03294320591300598, 3.5591998769122033, 0.018948777619883322], "isController": true}, {"data": ["TX_J06", 25, 0, 0.0, 2055.32, 1963, 2279, 2042.0, 2201.0000000000005, 2278.1, 2279.0, 0.07239326337248361, 0.9535861224647879, 0.040862603739546415], "isController": true}, {"data": ["TX_J05", 81, 0, 0.0, 457.16049382716045, 382, 667, 444.0, 535.6, 542.0, 667.0, 0.25462409938513, 0.6920996389681752, 0.15068574631580933], "isController": true}, {"data": ["J10 01 /api/documents", 24, 0, 0.0, 236.79166666666663, 201, 370, 227.5, 299.0, 358.0, 370.0, 0.07277225921478732, 0.836972775405099, 0.019685464650875086], "isController": false}, {"data": ["J10 02 /api/announcements", 24, 0, 0.0, 307.875, 233, 645, 268.5, 449.0, 599.25, 645.0, 0.07275902211874272, 0.9222211974695018, 0.01996609884313155], "isController": false}, {"data": ["J06 02 /api/financial-records/summary", 25, 0, 0.0, 1912.3199999999997, 1839, 2158, 1886.0, 2064.6000000000004, 2149.6, 2158.0, 0.0724211550884552, 0.09453789690414047, 0.020722068789958373], "isController": false}, {"data": ["J09 01 /api/inventory", 25, 0, 0.0, 141.32000000000002, 115, 194, 139.0, 170.00000000000006, 192.2, 194.0, 0.07458567656667213, 0.5767774465966555, 0.02017600821188299], "isController": false}, {"data": ["J09 02 /api/pos/orders", 24, 0, 0.0, 135.70833333333334, 119, 162, 136.0, 150.5, 159.25, 162.0, 0.07279366937721983, 1.500845160092994, 0.019762343834831164], "isController": false}, {"data": ["J01 01 /api/public/landing", 109, 0, 0.0, 180.72477064220186, 150, 269, 175.0, 208.0, 235.0, 268.8, 0.30936291107661135, 3.3678472243902857, 0.08519564543320741], "isController": false}, {"data": ["J07 02 /api/chairman/financial-analytics", 11, 0, 0.0, 2402.0909090909095, 1813, 4024, 2053.0, 3892.6000000000004, 4024.0, 4024.0, 0.0330635150123387, 1.6054121216857584, 0.009557422308254156], "isController": false}, {"data": ["J03 01 /api/members/me/dashboard", 84, 0, 0.0, 1024.7500000000005, 881, 1482, 1011.0, 1122.0, 1161.0, 1482.0, 0.25416420823310487, 0.7348588859135539, 0.07148368356556074], "isController": false}, {"data": ["J04 01 /api/membership-applications", 25, 0, 0.0, 138.67999999999995, 117, 184, 133.0, 166.60000000000002, 179.5, 184.0, 0.07278952762508152, 0.7386800683712033, 0.020685305213768285], "isController": false}, {"data": ["J06 01 /api/financial-records", 25, 0, 0.0, 142.99999999999997, 121, 204, 138.0, 174.4, 196.2, 204.0, 0.07278211073943713, 0.8636990534322588, 0.02025673980540975], "isController": false}, {"data": ["J10 03 /api/activities", 23, 0, 0.0, 90.0, 79, 116, 89.0, 104.40000000000002, 114.79999999999998, 116.0, 0.07431364883246795, 0.08619020174540143, 0.02017499450725204], "isController": false}, {"data": ["TX_J10", 23, 0, 0.0, 634.3913043478259, 525, 962, 569.0, 806.2, 933.7999999999996, 962.0, 0.07419019786203204, 1.871135255182024, 0.06056934122329959], "isController": true}, {"data": ["SETUP login", 5, 0, 0.0, 444.0, 338, 582, 391.0, 582.0, 582.0, 582.0, 0.10540962179027702, 0.16791423346123036, 0.0325287504743433], "isController": false}, {"data": ["J05 02 /api/members/me/share-capital/transactions", 81, 0, 0.0, 229.17283950617292, 192, 341, 220.0, 269.6, 299.8999999999998, 341.0, 0.2548179467336114, 0.3035087458002227, 0.07589792358764794], "isController": false}, {"data": ["J05 01 /api/members/me/share-capital/overview", 82, 0, 0.0, 227.9512195121952, 189, 412, 221.0, 264.1, 293.4, 412.0, 0.24885058343322763, 0.38000629239184863, 0.07314846251308742], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 712, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
